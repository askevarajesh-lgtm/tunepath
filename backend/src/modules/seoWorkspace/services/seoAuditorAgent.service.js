const WorkspaceProject = require('../models/workspaceProject.model');
const WorkspaceAudit = require('../models/workspaceAudit.model');
const WorkspaceTask = require('../models/workspaceTask.model');
const auditLogService = require('./auditLog.service');

const aiEngine = require('../../aiCore/aiEngine.service');
const executionQueue = require('../../aiCore/executionQueue.service');
const retry = require('../../aiCore/retry.service');
const logger = require('../../aiCore/logger.service');
const sharedMemory = require('../../aiCore/sharedMemory.service');
const agentLoader = require('../../aiCore/agentLoader.service');
const WorkspaceAuditJob = require('../models/workspaceAuditJob.model');
const WorkspaceAuditQueue = require('../models/workspaceAuditQueue.model');
const WorkspaceAuditPage = require('../models/workspaceAuditPage.model');

const AGENT_KEY = 'seo-auditor';
const TAG = 'SeoAuditorAgent';

// Start worker immediately on boot so it resumes interrupted jobs
try {
  const enterpriseCrawlWorker = require('./enterpriseCrawl.worker.js');
  if (!enterpriseCrawlWorker.isRunning && process.env.NODE_ENV !== 'test') {
    enterpriseCrawlWorker.start();
  }
} catch (e) {
  logger.error(TAG, `Failed to initialize enterprise crawl worker: ${e.message}`);
}

async function run(projectId, workspaceId, options = {}, userId = 'system') {
  logger.info(TAG, `[Audit Start Request] Project ID: ${projectId} | User ID: ${userId} | Profile: ${options.profile || 'standard'}`);
  
  try {
    const project = await WorkspaceProject.findById(projectId);
    if (!project) throw new Error('Project not found');
    if (!project.domain) throw new Error('Project domain is not configured');

    const agencyId = workspaceId || project.createdBy || project.companyId;
    const profile = options.profile || 'standard';

    const existingJob = await WorkspaceAuditJob.findOne({ projectId: project._id, status: 'running' });
    if (existingJob) {
      logger.info(TAG, `Existing running job found: ${existingJob._id}`);
      return { status: 'running', jobId: existingJob._id, progress: existingJob.progress };
    }

    const job = await WorkspaceAuditJob.create({
      projectId: project._id,
      agencyId,
      profile,
      status: 'running',
      startedAt: new Date(),
      progress: { urlsDiscovered: 1, urlsRemaining: 1, currentStage: 'Initializing', currentAnalyzer: 'None' }
    });

    const siteUrl = project.domain.startsWith('http') ? project.domain : `https://${project.domain}`;
    await WorkspaceAuditQueue.create({
      jobId: job._id,
      url: siteUrl,
      depth: 0,
      status: 'pending'
    });

    try {
      const enterpriseCrawlWorker = require('./enterpriseCrawl.worker.js');
      if (!enterpriseCrawlWorker.isRunning) enterpriseCrawlWorker.start();
    } catch(e) {
      logger.error(TAG, `Failed to nudge enterprise crawl worker: ${e.message}`);
    }

    logger.logExecution({ 
      executionId: `seoAuditorAgent:${projectId}:${Date.now()}`, 
      source: 'seoAuditorAgent', 
      agentKey: AGENT_KEY, 
      projectId, 
      status: 'started',
      meta: { jobId: job._id, profile }
    });

    return { status: 'queued', jobId: job._id };
  } catch (error) {
    logger.error(TAG, `[Audit Start Failed] Project: ${projectId} | Error: ${error.message}`);
    throw error;
  }
}

async function synthesizeSiteAudit(jobId) {
  const job = await WorkspaceAuditJob.findById(jobId).populate('projectId');
  if (!job || !job.projectId) throw new Error('Job/Project not found');

  const project = job.projectId;
  const agencyId = job.agencyId;

  const pages = await WorkspaceAuditPage.find({ jobId: job._id }).lean();
  const totalPages = pages.length || 1;

  let indexableCount = 0;
  let nonIndexableCount = 0;

  // Track occurrences of issues across pages
  const issueTracker = {
    missingTitle: { count: 0, urls: [] },
    missingDescription: { count: 0, urls: [] },
    missingH1: { count: 0, urls: [] },
    multipleH1: { count: 0, urls: [] },
    thinContent: { count: 0, urls: [] },
    slowPages: { count: 0, urls: [] },
    brokenLinks: { count: 0, urls: [] },
    missingAlt: { count: 0, urls: [] },
    noindexPages: { count: 0, urls: [] },
    notHttps: { count: 0, urls: [] },
    error4xx5xx: { count: 0, urls: [] },
  };

  pages.forEach(p => {
    if (p.checks?.isIndexable && !p.checks?.isNoindex) {
      indexableCount++;
    } else {
      nonIndexableCount++;
    }

    if (p.checks?.missingTitle || !p.title) {
      issueTracker.missingTitle.count++;
      issueTracker.missingTitle.urls.push(p.url);
    }
    if (p.checks?.missingDescription || !p.metaDescription) {
      issueTracker.missingDescription.count++;
      issueTracker.missingDescription.urls.push(p.url);
    }
    if (p.checks?.missingH1 || !p.h1 || p.h1.length === 0) {
      issueTracker.missingH1.count++;
      issueTracker.missingH1.urls.push(p.url);
    }
    if (p.checks?.multipleH1 || (p.h1 && p.h1.length > 1)) {
      issueTracker.multipleH1.count++;
      issueTracker.multipleH1.urls.push(p.url);
    }
    if (p.checks?.thinContent || (p.wordCount < 300)) {
      issueTracker.thinContent.count++;
      issueTracker.thinContent.urls.push(p.url);
    }
    if (p.responseTimeMs > 1500 || (p.performance && p.performance.lcp > 2500)) {
      issueTracker.slowPages.count++;
      issueTracker.slowPages.urls.push(p.url);
    }
    if (p.checks?.missingAltCount > 0 || (p.images && p.images.some(img => !img.alt || img.alt.trim() === ''))) {
      issueTracker.missingAlt.count++;
      issueTracker.missingAlt.urls.push(p.url);
    }
    if (p.checks?.isNoindex || (p.robots && p.robots.toLowerCase().includes('noindex'))) {
      issueTracker.noindexPages.count++;
      issueTracker.noindexPages.urls.push(p.url);
    }
    if (!p.url.startsWith('https:')) {
      issueTracker.notHttps.count++;
      issueTracker.notHttps.urls.push(p.url);
    }
    if (p.statusCode >= 400) {
      issueTracker.error4xx5xx.count++;
      issueTracker.error4xx5xx.urls.push(p.url);
    }
  });

  // Group Issues
  const groupedIssues = [];
  let idCounter = 1;

  const createGroupedIssue = (key, category, title, severity, impact, description, recommendation, rootCauseCandidate) => {
    const data = issueTracker[key];
    if (data.count === 0) return null;

    const percentageAffected = Math.round((data.count / totalPages) * 100);
    const scope = percentageAffected > 50 ? 'sitewide' : 'page-specific';
    const rootCause = percentageAffected > 50 ? rootCauseCandidate : null;

    return {
      id: `${category.substring(0,3).toUpperCase()}-${String(idCounter++).padStart(3, '0')}`,
      category,
      severity,
      impact,
      confidence: 'High',
      scope,
      affectedUrls: data.urls,
      affectedCount: data.count,
      analyzedCount: totalPages,
      percentageAffected,
      title,
      description,
      evidence: [{ metric: `${percentageAffected}% affected`, total: totalPages, count: data.count }],
      rootCause,
      recommendation,
      priority: severity === 'Critical' ? 0 : severity === 'High' ? 1 : 2,
      status: 'open'
    };
  };

  const addIssue = (issue) => { if (issue) groupedIssues.push(issue); };

  addIssue(createGroupedIssue('missingTitle', 'On-Page', 'Missing Title Tags', 'High', 'High', 'Title tags are missing.', 'Add descriptive title tags.', 'Template/CMS configuration issue.'));
  addIssue(createGroupedIssue('missingDescription', 'On-Page', 'Missing Meta Descriptions', 'Medium', 'Medium', 'Meta descriptions are missing.', 'Add compelling meta descriptions.', 'Template/CMS configuration issue.'));
  addIssue(createGroupedIssue('missingH1', 'On-Page', 'Missing H1 Headings', 'High', 'High', 'H1 tags are missing.', 'Add exactly one H1 per page.', 'Theme/Template heading structure is flawed.'));
  addIssue(createGroupedIssue('multipleH1', 'On-Page', 'Multiple H1 Headings', 'Medium', 'Low', 'Multiple H1 tags found.', 'Use only one H1 per page.', 'Theme/Template heading structure is flawed.'));
  addIssue(createGroupedIssue('thinContent', 'Content', 'Thin Content', 'Low', 'Low', 'Pages have less than 300 words.', 'Expand content to satisfy search intent.', null));
  addIssue(createGroupedIssue('slowPages', 'Performance', 'Slow Pages (TTFB/LCP)', 'High', 'High', 'Pages load too slowly.', 'Optimize server response and LCP resources.', 'Server or global resource blocking.'));
  addIssue(createGroupedIssue('missingAlt', 'Images', 'Missing Image Alt Text', 'Medium', 'Low', 'Images are missing alt text.', 'Add descriptive alt text.', null));
  addIssue(createGroupedIssue('notHttps', 'Security', 'Insecure HTTP URLs', 'Critical', 'High', 'Pages are not using HTTPS.', 'Migrate all pages to HTTPS.', 'SSL Certificate missing or mixed content.'));
  addIssue(createGroupedIssue('error4xx5xx', 'Technical', 'Broken Pages (4xx/5xx)', 'Critical', 'High', 'Pages return errors.', 'Fix broken links or restore pages.', null));
  
  // Calculate Transparent Category Scores with distinct penalty stacking
  const calcScoreBreakdown = (category) => {
    const issues = groupedIssues.filter(f => f.category.toLowerCase() === category.toLowerCase());
    let pointsLost = 0;
    const rawPenalties = [];

    issues.forEach(i => {
      const weight = i.percentageAffected / 100;
      let penalty = 0;
      if (i.severity === 'Critical') penalty = 100 * weight;
      else if (i.severity === 'High') penalty = 60 * weight;
      else if (i.severity === 'Medium') penalty = 30 * weight;
      else if (i.severity === 'Low') penalty = 10 * weight;

      // Safety Cap: single issue cannot subtract more than 100 points
      penalty = Math.min(100, penalty);

      rawPenalties.push({
        issueId: i.id,
        name: i.title,
        severity: i.severity,
        affectedPercentage: i.percentageAffected,
        penalty: Number(penalty.toFixed(1))
      });

      pointsLost += penalty;
    });
    
    return {
      baseScore: 100,
      rawPenalties,
      rawImpact: Number(pointsLost.toFixed(1)),
      finalScore: Math.max(0, Math.round(100 - pointsLost))
    };
  };

  const rawScores = {
    technical: calcScoreBreakdown('Technical'),
    indexability: calcScoreBreakdown('Indexability'),
    onpage: calcScoreBreakdown('On-Page'),
    content: calcScoreBreakdown('Content'),
    internalLinking: calcScoreBreakdown('Internal Linking'),
    performance: calcScoreBreakdown('Performance'),
    structuredData: calcScoreBreakdown('Structured Data'),
    authority: null // Unmeasured by default in this crawler
  };

  const scores = {
    technical: rawScores.technical.finalScore,
    indexability: rawScores.indexability.finalScore,
    onpage: rawScores.onpage.finalScore,
    content: rawScores.content.finalScore,
    internalLinking: rawScores.internalLinking.finalScore,
    performance: rawScores.performance.finalScore,
    structuredData: rawScores.structuredData.finalScore,
    authority: null
  };

  const intendedWeights = {
    technical: 20,
    indexability: 15,
    onpage: 20,
    content: 15,
    internalLinking: 10,
    performance: 10,
    structuredData: 5,
    authority: 5
  };

  let earnedWeighted = 0;
  let availableWeight = 0;
  let measuredCategories = 0;

  const scoreBreakdown = [];

  Object.keys(scores).forEach(cat => {
    if (scores[cat] !== null && scores[cat] !== undefined) {
      const weightFraction = intendedWeights[cat] / 100;
      const contribution = scores[cat] * weightFraction;
      earnedWeighted += contribution;
      availableWeight += intendedWeights[cat];
      measuredCategories++;

      scoreBreakdown.push({
        category: cat,
        baseScore: rawScores[cat].baseScore,
        rawPenalties: rawScores[cat].rawPenalties,
        rawImpact: rawScores[cat].rawImpact,
        earned: scores[cat],
        weight: intendedWeights[cat],
        weightedContribution: Number(contribution.toFixed(2)),
        reason: 'Based on distinct grouped findings.'
      });
    } else {
      scoreBreakdown.push({
        category: cat,
        earned: null,
        weight: intendedWeights[cat],
        reason: 'Not Measured'
      });
    }
  });

  const overall = availableWeight > 0 ? Math.round((earnedWeighted / (availableWeight / 100))) : 0;
  const measurementCoverage = Math.round((availableWeight / 100) * 100);

  // Confidence Logic
  const crawlCoverage = Math.round((totalPages / Math.max(1, job.progress.urlsDiscovered || totalPages)) * 100);
  let confidence = 'High';
  let confidenceReason = `${crawlCoverage}% of discovered URLs crawled.`;

  if (crawlCoverage < 30 || measuredCategories < 4) {
    confidence = 'Low';
    confidenceReason = `Insufficient evidence: ${crawlCoverage}% crawled, ${measuredCategories}/8 categories measured.`;
  } else if (crawlCoverage < 80 || measuredCategories < 6) {
    confidence = 'Partial';
    confidenceReason = `Partial evidence: ${crawlCoverage}% crawled, ${8 - measuredCategories} categories unmeasured.`;
  } else if (crawlCoverage < 95 || measurementCoverage < 90) {
    confidence = 'Medium';
    confidenceReason = `Good coverage, but some measurement gaps exist (Coverage: ${measurementCoverage}%).`;
  } else {
    confidence = 'High';
    confidenceReason = `High coverage (${crawlCoverage}% crawled, ${measurementCoverage}% metrics measured).`;
  }
  
  if (scores.authority === null) {
     confidenceReason += ' Authority data unavailable, score normalized across measured categories.';
  }
  
  let healthStatus = 'Good';
  if (overall >= 90) healthStatus = 'Excellent';
  else if (overall >= 70) healthStatus = 'Good';
  else if (overall >= 50) healthStatus = 'Needs Improvement';
  else if (overall >= 30) healthStatus = 'Poor';
  else healthStatus = 'Critical';

  const rawAudit = await WorkspaceAudit.create({
    projectId: project._id,
    agencyId,
    taskId: job._id,
    status: 'completed',
    metrics: {
      technical: scores.technical,
      indexability: scores.indexability,
      onpage: scores.onpage,
      content: scores.content,
      performance: scores.performance,
      structuredData: scores.structuredData,
      internalLinking: scores.internalLinking,
      authority: scores.authority,
      overall: overall,
      healthStatus: healthStatus,
      scoreConfidence: confidence,
      confidenceReason: confidenceReason,
      measurementCoverage: measurementCoverage,
      sitemapUrls: job.progress.urlsDiscovered, // approximate
      discoveredUrls: job.progress.urlsDiscovered,
      indexableUrls: indexableCount,
      nonIndexableUrls: nonIndexableCount,
      scoreBreakdown: scoreBreakdown,
      pagesCrawled: pages.length
    },
    groupedIssues,
    agent: {
      findings: [] // Legacy findings left empty
    },
    completedAt: new Date()
  });

  // Call the AI Analyzer to explain top issues
  return await analyzeAudit(project, rawAudit, agencyId, job);
}

async function analyzeAudit(project, audit, workspaceId, job) {
  const agentConfig = await agentLoader.resolve(AGENT_KEY);
  
  // Sort findings by severity and take top 15 for AI to explain
  const severityWeight = { critical: 4, high: 3, medium: 2, low: 1 };
  const topFindings = [...(audit.groupedIssues || [])]
    .sort((a, b) => severityWeight[b.severity?.toLowerCase()] - severityWeight[a.severity?.toLowerCase()])
    .slice(0, 15);

  if (topFindings.length === 0) {
    audit.agent.summary = 'The site is fully optimized with no critical issues found.';
    audit.agent.approvalStatus = 'Not Requested';
    await audit.save();
    return audit;
  }

  const coverageWarning = job?.status === 'completed_with_warnings'
    ? `\nWARNING: This audit completed with partial coverage due to timeouts or errors. Out of ${job.progress.urlsDiscovered} discovered URLs, only ${job.progress.urlsCrawled} were successfully analyzed, ${job.progress.failedUrls} failed, and ${job.progress.timedOutUrls} timed out. Do NOT assume the site is fully healthy for unscanned pages. Explicitly mention the partial coverage in your summary.`
    : '';

  const prompt = `You are the SEO Auditor. You are provided with a verified list of EXACT issues found on ${project.domain}. 
  Do NOT invent new issues, URLs, or HTML snippets. Your ONLY job is to explain the SEO impact of the provided issues and recommend a general fix strategy.
  ${coverageWarning}
  
  Evidence:
  ${JSON.stringify(topFindings.map(f => ({ issueId: f.id, issue: f.title, severity: f.severity, affectedCount: f.affectedCount })), null, 2)}
  
  Respond with a JSON object of this exact shape:
  {
    "summary": "2-4 sentence plain-language summary of overall site health",
    "explanations": [
      {
        "issueId": "MUST match exactly the provided issueId",
        "aiExplanation": "detailed explanation of why this is an issue and how it impacts SEO",
        "recommendation": "strategic next step to fix this class of issue"
      }
    ]
  }
  Respond ONLY with valid JSON.`;

  const raw = await aiEngine.complete({
    workspaceId,
    agentKey: AGENT_KEY,
    projectId: project._id,
    messages: [{ role: 'user', content: prompt }],
    model: agentConfig.modelName,
    temperature: 0.1,
    maxTokens: 4096,
    jsonMode: true,
    retryOptions: { retries: 2 }
  });

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    logger.error(TAG, `Failed to parse AI findings JSON for project ${project._id}`);
    parsed = { summary: 'Analysis completed.', explanations: [] };
  }

  // Merge AI explanations back into the deterministic findings
  const explanationMap = new Map();
  if (Array.isArray(parsed.explanations)) {
    parsed.explanations.forEach(exp => explanationMap.set(exp.issueId, exp));
  }

  if (audit.groupedIssues && audit.groupedIssues.length > 0) {
    audit.groupedIssues = audit.groupedIssues.map(f => {
      const exp = explanationMap.get(f.id);
      if (exp) {
        return {
          ...f,
          aiExplanation: exp.aiExplanation,
          recommendation: exp.recommendation
        };
      }
      return f;
    });
    audit.markModified('groupedIssues');
  }

  audit.agent.summary = parsed.summary || '';
  audit.agent.approvalStatus = (audit.groupedIssues && audit.groupedIssues.length > 0) ? 'Pending Approval' : 'Not Requested';

  await WorkspaceProject.findByIdAndUpdate(project._id, {
    $set: {
      'stats.lastAuditScore': audit.metrics.overall,
      lastAuditSync: new Date(),
      phase: 'audit'
    }
  });

  await audit.save();
  return audit;
}

async function approveFindings(auditId, projectId, userId) {
  const audit = await WorkspaceAudit.findOne({ _id: auditId, projectId });
  if (!audit) throw new Error('Audit not found');

  if (!audit.agent || audit.agent.approvalStatus !== 'Pending Approval') {
    throw new Error(`Findings must be 'Pending Approval' to approve.`);
  }

  audit.agent.approvalStatus = 'Approved';
  audit.agent.approvedBy = userId;
  audit.agent.approvedAt = new Date();

  const tasksToCreate = (audit.agent.findings || [])
    .filter((f) => f.severity === 'critical' || f.severity === 'high')
    .map((f) => ({
      projectId,
      pageUrl: f.affectedUrl || '/',
      taskType: f.taskType,
      description: `[SEO Auditor] ${f.issue}${f.recommendation ? ' — ' + f.recommendation : ''}`,
      proposedChanges: { category: f.category, severity: f.severity, recommendation: f.recommendation },
      status: 'Pending'
    }));

  let createdTasks = [];
  if (tasksToCreate.length > 0) {
    createdTasks = await WorkspaceTask.insertMany(tasksToCreate);
    audit.agent.generatedTaskIds = createdTasks.map((t) => t._id);
  }

  await audit.save();
  return { audit, createdTasks };
}

async function rejectFindings(auditId, projectId, userId, reason) {
  const audit = await WorkspaceAudit.findOne({ _id: auditId, projectId });
  if (!audit) throw new Error('Audit not found');
  audit.agent.approvalStatus = 'Rejected';
  audit.agent.rejectionReason = reason || null;
  await audit.save();
  return audit;
}

module.exports = {
  AGENT_KEY,
  run,
  synthesizeSiteAudit,
  analyzeAudit,
  approveFindings,
  rejectFindings
};