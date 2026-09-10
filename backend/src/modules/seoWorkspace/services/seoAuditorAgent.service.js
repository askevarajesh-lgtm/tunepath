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

  // Aggregate Findings
  const allFindings = [];
  const uniqueFindingKeys = new Set();
  
  pages.forEach(p => {
    if (p.findings && Array.isArray(p.findings)) {
      p.findings.forEach(f => {
        const key = `${f.category}_${f.issue}_${f.affectedUrl}`;
        if (!uniqueFindingKeys.has(key)) {
          uniqueFindingKeys.add(key);
          allFindings.push(f);
        }
      });
    }
  });

  // Calculate Transparent Category Scores
  const calcScore = (category) => {
    const issues = allFindings.filter(f => f.category.toLowerCase() === category.toLowerCase());
    let pointsLost = 0;
    issues.forEach(i => {
      if (i.severity === 'critical') pointsLost += 15;
      else if (i.severity === 'high') pointsLost += 8;
      else if (i.severity === 'medium') pointsLost += 4;
      else if (i.severity === 'low') pointsLost += 1;
    });
    // Proportion points lost to total pages to get an average loss per page
    const avgLossPerPage = pointsLost / totalPages;
    // Cap the penalty at a maximum of 100 points
    const normalizedLoss = Math.min(100, Math.round(avgLossPerPage * 5)); // Multiply by 5 to scale it appropriately (e.g. 1 high issue = 40 points lost)
    return Math.max(0, 100 - normalizedLoss);
  };

  const scores = {
    technical: calcScore('Technical'),
    content: calcScore('Content'),
    performance: calcScore('Performance'),
    security: calcScore('Security'),
    accessibility: calcScore('Accessibility'),
    images: calcScore('Images'),
    indexability: calcScore('Indexability'),
    schema: null, // Unmeasured in initial crawl
    internalLinking: null // Unmeasured in initial crawl
  };

  const scoreValues = Object.values(scores).filter(v => typeof v === 'number');
  const overall = Math.round(scoreValues.reduce((a, b) => a + b, 0) / scoreValues.length);

  const scoreBreakdown = Object.keys(scores).map(cat => ({
    category: cat,
    maxScore: 100,
    earned: scores[cat],
    reason: `Based on ${allFindings.filter(f => f.category.toLowerCase() === cat.toLowerCase()).length} issues found.`
  }));

  const rawAudit = await WorkspaceAudit.create({
    projectId: project._id,
    agencyId,
    taskId: job._id,
    status: 'completed',
    metrics: {
      technical: scores.technical,
      content: scores.content,
      performance: scores.performance,
      security: scores.security,
      accessibility: scores.accessibility,
      schema: scores.schema,
      images: scores.images,
      internalLinking: scores.internalLinking,
      indexability: scores.indexability,
      overall: overall,
      scoreBreakdown: scoreBreakdown,
      pagesCrawled: pages.length
    },
    agent: {
      findings: allFindings
    },
    completedAt: new Date()
  });

  // Call the AI Analyzer to explain top issues
  return await analyzeAudit(project, rawAudit, agencyId);
}

async function analyzeAudit(project, audit, workspaceId) {
  const agentConfig = await agentLoader.resolve(AGENT_KEY);
  
  // Sort findings by severity and take top 15 for AI to explain
  const severityWeight = { critical: 4, high: 3, medium: 2, low: 1 };
  const topFindings = [...audit.agent.findings]
    .sort((a, b) => severityWeight[b.severity] - severityWeight[a.severity])
    .slice(0, 15);

  if (topFindings.length === 0) {
    audit.agent.summary = 'The site is fully optimized with no critical issues found.';
    audit.agent.approvalStatus = 'Not Requested';
    await audit.save();
    return audit;
  }

  const prompt = `You are the SEO Auditor. You are provided with a verified list of EXACT issues found on ${project.domain}. 
  Do NOT invent new issues, URLs, or HTML snippets. Your ONLY job is to explain the SEO impact of the provided issues and recommend a general fix strategy.
  
  Evidence:
  ${JSON.stringify(topFindings.map(f => ({ issueId: f.issueId, issue: f.issue, severity: f.severity })), null, 2)}
  
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

  audit.agent.findings = audit.agent.findings.map(f => {
    const exp = explanationMap.get(f.issueId);
    if (exp) {
      return {
        ...f,
        aiExplanation: exp.aiExplanation,
        recommendation: exp.recommendation
      };
    }
    return f;
  });

  audit.agent.summary = parsed.summary || '';
  audit.agent.approvalStatus = audit.agent.findings.length > 0 ? 'Pending Approval' : 'Not Requested';

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