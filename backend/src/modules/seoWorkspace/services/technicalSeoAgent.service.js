const axios = require('axios');
const WorkspaceProject = require('../models/workspaceProject.model');
const WorkspaceTechnicalAudit = require('../models/workspaceTechnicalAudit.model');
const WorkspaceTask = require('../models/workspaceTask.model');
const dataForSeoService = require('../../seoIntelligence/dataForSeo.service');
const CrawlService = require('../../seoIntelligence/services/crawl.service');
const auditLogService = require('./auditLog.service');

const aiEngine = require('../../aiCore/aiEngine.service');
const executionQueue = require('../../aiCore/executionQueue.service');
const retry = require('../../aiCore/retry.service');
const logger = require('../../aiCore/logger.service');
const sharedMemory = require('../../aiCore/sharedMemory.service');
const agentLoader = require('../../aiCore/agentLoader.service');
const fixEngine = require('../../aiCore/fixEngine/fixEngine.service');
const verifierRegistry = require('../../aiCore/fixEngine/verification/verifierRegistry');

const AGENT_KEY = 'technical-seo-agent';
const TAG = 'TechnicalSeoAgent';

const VALID_CATEGORIES = [
  'robots_txt', 'sitemap', 'ssl_https', 'canonical_issues', 'redirect_chains',
  'indexability', 'core_web_vitals', 'mobile_usability', 'structured_data',
  'hreflang', 'other'
];
const VALID_SEVERITIES = ['critical', 'high', 'medium', 'low'];
const VALID_TASK_TYPES = ['Update Meta Tags', 'Content Edit', 'Schema Injection', 'Create Redirect', 'Internal Linking'];
const MAX_FINDINGS = 15;
const TECHNICAL_CRAWL_PAGE_LIMIT = 15; // small, targeted pass for infra stats — not a full content crawl

async function checkRobotsAndSitemap(rootUrl) {
  const result = {
    robotsTxt: { exists: false, accessible: false, disallowsAll: false, declaresSitemap: false },
    sitemap: { exists: false, urlCount: 0 }
  };

  let robotsText = '';
  try {
    const robotsRes = await axios.get(new URL('/robots.txt', rootUrl).href, {
      timeout: 8000, validateStatus: () => true
    });
    if (robotsRes.status === 200 && typeof robotsRes.data === 'string') {
      result.robotsTxt.exists = true;
      result.robotsTxt.accessible = true;
      robotsText = robotsRes.data;
      result.robotsTxt.disallowsAll = /Disallow:\s*\/\s*$/im.test(robotsText) && !/Allow:/i.test(robotsText);
      result.robotsTxt.declaresSitemap = /^Sitemap:/im.test(robotsText);
    }
  } catch (error) {
    logger.warn(TAG, `robots.txt fetch failed for ${rootUrl}: ${error.message}`);
  }

  let sitemapUrl = new URL('/sitemap.xml', rootUrl).href;
  const declaredMatch = robotsText.match(/Sitemap:\s*(\S+)/i);
  if (declaredMatch) sitemapUrl = declaredMatch[1].trim();

  try {
    const sitemapRes = await axios.get(sitemapUrl, { timeout: 10000, validateStatus: () => true });
    if (sitemapRes.status === 200 && typeof sitemapRes.data === 'string') {
      const cheerio = require('cheerio'); // same dependency CrawlService already uses
      const $ = cheerio.load(sitemapRes.data, { xmlMode: true });
      const urlCount = $('loc').length;
      if (urlCount > 0) {
        result.sitemap.exists = true;
        result.sitemap.urlCount = urlCount;
      }
    }
  } catch (error) {
    logger.warn(TAG, `sitemap.xml fetch failed for ${sitemapUrl}: ${error.message}`);
  }

  return result;
}

async function checkHreflang(rootUrl) {
  try {
    const res = await axios.get(rootUrl, { timeout: 8000, validateStatus: () => true });
    if (res.status !== 200 || typeof res.data !== 'string') return 0;
    const cheerio = require('cheerio');
    const $ = cheerio.load(res.data);
    return $('link[rel="alternate"][hreflang]').length;
  } catch (error) {
    logger.warn(TAG, `hreflang check failed for ${rootUrl}: ${error.message}`);
    return 0;
  }
}

/**
 * @param {Object} project - a WorkspaceProject document
 * @returns {Promise<Object>} signals object matching WorkspaceTechnicalAudit.signals
 */
async function collectTechnicalSignals(project) {
  const rootUrl = /^https?:\/\//i.test(project.domain) ? project.domain : `https://${project.domain}`;
  const domain = project.domain.replace(/^https?:\/\/(www\.)?/, '').split('/')[0];

  const [robotsSitemap, crawlResult, hreflangCount] = await Promise.all([
    checkRobotsAndSitemap(rootUrl),
    retry.withRetry(() => new CrawlService(rootUrl, TECHNICAL_CRAWL_PAGE_LIMIT).run(), { retries: 1 })
      .catch((error) => {
        logger.warn(TAG, `Technical crawl pass failed for ${rootUrl}, continuing with zeroed crawl stats: ${error.message}`, { projectId: project._id });
        return { summary: {}, pages: [] };
      }),
    (project.languages || []).length > 1 ? checkHreflang(rootUrl) : Promise.resolve(0)
  ]);

  const pages = crawlResult.pages || [];
  const okPages = pages.filter((p) => p.status === 200);
  const canonicalMissing = okPages.filter((p) => !p.canonical).length;
  const canonicalCrossDomain = okPages.filter((p) => {
    if (!p.canonical) return false;
    try {
      return new URL(p.canonical).hostname.replace(/^www\./, '') !== domain;
    } catch (error) {
      return false; // unparseable canonical is a finding candidate too, but not this specific one
    }
  }).length;

  let coreWebVitals = { desktop: null, mobile: null };
  let dataSource = 'internal-only';
  if (dataForSeoService.isConfigured) {
    dataSource = 'dataforseo';
    const [desktop, mobile] = await Promise.allSettled([
      retry.withRetry(() => dataForSeoService.getPageSpeed(rootUrl, 'desktop'), { retries: 1 }),
      retry.withRetry(() => dataForSeoService.getPageSpeed(rootUrl, 'mobile'), { retries: 1 })
    ]);
    
    const extractCWV = (res) => {
      if (!res) return null;
      const audits = res.audits || res.lighthouseResult?.audits;
      const categories = res.categories || res.lighthouseResult?.categories;
      if (!audits) return null;
      
      const getAudit = (key) => audits[key] ? { score: audits[key].score, displayValue: audits[key].displayValue } : null;
      
      return {
        performanceScore: categories?.performance?.score || null,
        lcp: getAudit('largest-contentful-paint'),
        cls: getAudit('cumulative-layout-shift'),
        tbt: getAudit('total-blocking-time'),
        fcp: getAudit('first-contentful-paint'),
        speedIndex: getAudit('speed-index')
      };
    };

    coreWebVitals = {
      desktop: desktop.status === 'fulfilled' ? extractCWV(desktop.value) : null,
      mobile: mobile.status === 'fulfilled' ? extractCWV(mobile.value) : null
    };
    if (desktop.status === 'rejected') {
      logger.warn(TAG, `getPageSpeed(desktop) failed for ${rootUrl}: ${desktop.reason?.message}`, { projectId: project._id });
    }
    if (mobile.status === 'rejected') {
      logger.warn(TAG, `getPageSpeed(mobile) failed for ${rootUrl}: ${mobile.reason?.message}`, { projectId: project._id });
    }
  }

  return {
    robotsTxt: robotsSitemap.robotsTxt,
    sitemap: robotsSitemap.sitemap,
    ssl: { isHttps: /^https:\/\//i.test(rootUrl) },
    crawl: {
      pagesCrawled: pages.length,
      redirectedPages: crawlResult.summary?.redirected || 0,
      noindexPages: crawlResult.summary?.noindex_pages || 0,
      clientErrors4xx: crawlResult.summary?.client_errors_4xx || 0,
      serverErrors5xx: crawlResult.summary?.server_errors_5xx || 0,
      canonicalMissing,
      canonicalCrossDomain
    },
    coreWebVitals,
    hreflang: {
      checked: (project.languages || []).length > 1,
      tagsFound: hreflangCount
    },
    dataSource
  };
}

/**
 * @param {Object} project
 * @param {Object} signals - from collectTechnicalSignals
 * @param {string} workspaceId
 * @returns {Promise<{ summary: string, findings: Array }>}
 */
async function analyzeTechnicalFindings(project, signals, workspaceId) {
  const agentConfig = await agentLoader.resolve(AGENT_KEY);
  const skillsBlock = agentLoader.loadSkillsForAgent(agentConfig);
  const memoryBlock = await sharedMemory.recallAsPromptContext({ agencyId: workspaceId, projectId: project._id });

  const prompt = `You are the Technical SEO Agent for ${project.name} (${project.domain}). Analyze the following measured technical signals and produce a prioritized set of infrastructure findings a human reviewer can act on. Do not analyze content quality, titles, or meta descriptions — that is a different agent's job.

Technical Signals (a null/false/0 value means that check found nothing wrong OR could not be performed — treat conservatively per the skill's guidance, do not invent detail beyond what's given):
${JSON.stringify(signals, null, 2)}
${skillsBlock}
${memoryBlock}

Respond with a JSON object of this exact shape:
{
  "summary": "2-4 sentence plain-language summary of overall technical/infrastructure health",
  "findings": [
    {
      "category": "robots_txt | sitemap | ssl_https | canonical_issues | redirect_chains | indexability | core_web_vitals | mobile_usability | structured_data | hreflang | other",
      "severity": "critical | high | medium | low",
      "issue": "specific description of the problem, grounded in the signals given",
      "recommendation": "specific, actionable next step",
      "taskType": "Update Meta Tags | Content Edit | Schema Injection | Create Redirect | Internal Linking",
      "pageUrl": "affected page path, or the site root if not page-specific"
    }
  ]
}
Return at most ${MAX_FINDINGS} findings, ranked by likely impact. Respond ONLY with valid JSON, no markdown formatting or commentary.`;

  const raw = await aiEngine.complete({
    workspaceId,
    agentKey: AGENT_KEY,
    projectId: project._id,
    messages: [{ role: 'user', content: prompt }],
    model: agentConfig.modelName,
    temperature: 0.3,
    maxTokens: 4096,
    jsonMode: true,
    retryOptions: { retries: 2 }
  });

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    logger.error(TAG, `Failed to parse AI findings JSON for project ${project._id}: ${error.message}`, { projectId: project._id });
    parsed = { summary: 'Automated analysis did not return structured output; manual review recommended.', findings: [] };
  }

  const findings = Array.isArray(parsed.findings)
    ? parsed.findings.slice(0, MAX_FINDINGS).map((f) => ({
      category: VALID_CATEGORIES.includes(f.category) ? f.category : 'other',
      severity: VALID_SEVERITIES.includes(f.severity) ? f.severity : 'medium',
      issue: f.issue || 'Unspecified issue',
      recommendation: f.recommendation || '',
      taskType: VALID_TASK_TYPES.includes(f.taskType) ? f.taskType : 'Content Edit',
      pageUrl: f.pageUrl || project.domain
    }))
    : [];

  return { summary: parsed.summary || '', findings };
}

/**
 * @param {string} projectId
 * @param {string} [workspaceId]
 * @returns {Promise<Object>} the saved WorkspaceTechnicalAudit document
 */
async function run(projectId, workspaceId) {
  const project = await WorkspaceProject.findById(projectId);
  if (!project) throw new Error('Project not found');

  const agencyId = workspaceId || project.createdBy || project.companyId;

  return executionQueue.run(`technical-seo-agent:${projectId}`, async () => {
    const executionId = `technicalSeoAgent:${projectId}:${Date.now()}`;
    const startedAt = Date.now();

    logger.logExecution({ executionId, source: 'technicalSeoAgent', agentKey: AGENT_KEY, projectId, status: 'started' });

    try {
      const signals = await collectTechnicalSignals(project);
      const { summary, findings } = await analyzeTechnicalFindings(project, signals, agencyId);

      const audit = await WorkspaceTechnicalAudit.create({
        projectId: project._id,
        agencyId,
        status: 'completed',
        signals,
        completedAt: new Date(),
        agent: {
          agentKey: AGENT_KEY,
          summary,
          findings,
          approvalStatus: findings.length > 0 ? 'Pending Approval' : 'Not Requested'
        }
      });

      logger.logExecution({
        executionId, source: 'technicalSeoAgent', agentKey: AGENT_KEY, projectId,
        status: 'succeeded', durationMs: Date.now() - startedAt,
        meta: { auditId: audit._id, findingsCount: findings.length }
      });

      return audit;
    } catch (error) {
      logger.logExecution({
        executionId, source: 'technicalSeoAgent', agentKey: AGENT_KEY, projectId,
        status: 'failed', durationMs: Date.now() - startedAt, error: error.message
      });
      throw error;
    }
  });
}

/**
 * @param {string} auditId
 * @param {string} projectId
 * @param {string} [workspaceId]
 */
async function generateFixesForFindings(auditId, projectId, workspaceId) {
  const audit = await WorkspaceTechnicalAudit.findOne({ _id: auditId, projectId });
  if (!audit) throw new Error('Technical audit not found');

  const project = await WorkspaceProject.findById(projectId);
  const agencyId = workspaceId || project?.createdBy || project?.companyId;

  const findings = audit.agent?.findings || [];
  for (const finding of findings) {
    if (finding.generatedFix) continue; // already generated, don't redo the work
    try {
      finding.generatedFix = await fixEngine.generateFix({
        taskType: finding.taskType,
        finding: { ...finding.toObject?.() || finding, issue: finding.issue, recommendation: finding.recommendation },
        context: { workspaceId: agencyId, projectId, project }
      });
    } catch (error) {
      logger.warn(TAG, `Fix generation failed for finding (${finding.category}) on audit ${auditId}: ${error.message}`, { projectId });
      finding.generatedFix = { payload: {}, autoFixable: false, confidence: 0, risk: 'high', affectedPages: [], verificationStatus: 'Not Verified', errors: [error.message] };
    }
  }

  await audit.save();
  return audit;
}

/**
 * @param {string} auditId
 * @param {string} projectId
 * @param {string} userId
 */
async function approveFindings(auditId, projectId, userId) {
  const audit = await WorkspaceTechnicalAudit.findOne({ _id: auditId, projectId });
  if (!audit) throw new Error('Technical audit not found');

  if (!audit.agent || audit.agent.approvalStatus !== 'Pending Approval') {
    throw new Error(`Publish Gate Blocked: Findings must be 'Pending Approval' to approve. Current status is '${audit.agent?.approvalStatus || 'Not Requested'}'.`);
  }

  audit.agent.approvalStatus = 'Approved';
  audit.agent.approvedBy = userId;
  audit.agent.approvedAt = new Date();
  audit.agent.rejectionReason = null;

  const tasksToCreate = (audit.agent.findings || [])
    .filter((f) => f.severity === 'critical' || f.severity === 'high')
    .map((f) => ({
      projectId,
      pageUrl: f.pageUrl || '/',
      taskType: f.taskType,
      description: `[Technical SEO Agent] ${f.issue}${f.recommendation ? ' — ' + f.recommendation : ''}`,
      proposedChanges: { category: f.category, severity: f.severity, recommendation: f.recommendation },
      status: 'Pending',
      generatedFix: f.generatedFix || null
    }));

  let createdTasks = [];
  if (tasksToCreate.length > 0) {
    createdTasks = await WorkspaceTask.insertMany(tasksToCreate);
    audit.agent.generatedTaskIds = createdTasks.map((t) => t._id);
  }

  await audit.save();

  auditLogService.record({
    targetType: 'TechnicalAudit', targetId: audit._id, projectId,
    action: 'technical_findings_approved', fromValue: 'Pending Approval', toValue: 'Approved', userId
  });

  await recordRecurringIssuesIfAny(audit, projectId, userId);

  return { audit, createdTasks };
}

/**
 * Human Approval Gate — reject path.
 */
async function rejectFindings(auditId, projectId, userId, reason) {
  const audit = await WorkspaceTechnicalAudit.findOne({ _id: auditId, projectId });
  if (!audit) throw new Error('Technical audit not found');

  if (!audit.agent || audit.agent.approvalStatus !== 'Pending Approval') {
    throw new Error(`Findings must be 'Pending Approval' to reject. Current status is '${audit.agent?.approvalStatus || 'Not Requested'}'.`);
  }

  audit.agent.approvalStatus = 'Rejected';
  audit.agent.rejectionReason = reason || null;
  await audit.save();

  auditLogService.record({
    targetType: 'TechnicalAudit', targetId: audit._id, projectId,
    action: 'technical_findings_rejected', fromValue: 'Pending Approval', toValue: 'Rejected', userId
  });

  return audit;
}

async function recordRecurringIssuesIfAny(audit, projectId, userId) {
  try {
    const previous = await WorkspaceTechnicalAudit.findOne({
      projectId,
      _id: { $ne: audit._id },
      'agent.approvalStatus': 'Approved'
    }).sort({ createdAt: -1 });

    if (!previous) return;

    const previousCategories = new Set((previous.agent?.findings || []).map((f) => f.category));
    const repeated = (audit.agent.findings || []).filter(
      (f) => previousCategories.has(f.category) && (f.severity === 'critical' || f.severity === 'high')
    );

    if (repeated.length === 0) return;

    const project = await WorkspaceProject.findById(projectId);
    const agencyId = project?.createdBy || project?.companyId || userId;

    for (const finding of repeated.slice(0, 3)) {
      await sharedMemory.remember({
        agencyId,
        projectId,
        title: `Recurring technical issue: ${finding.category}`,
        description: `The Technical SEO Agent flagged "${finding.category}" as ${finding.severity} severity in consecutive approved technical audits.`,
        content: `Issue: ${finding.issue}\nRecommendation: ${finding.recommendation}`,
        type: 'recurring_issue'
      });
    }
  } catch (error) {
    logger.warn(TAG, `Failed to record recurring-technical-issue memory for project ${projectId}: ${error.message}`, { projectId });
  }
}

/**
 * @param {string} projectId
 * @param {number} [limit=20]
 */
async function getExecutionHistory(projectId, limit = 20) {
  const ExecutionLog = require('../../aiCore/executionLog.model');

  return ExecutionLog.find({
    projectId,
    $or: [{ agentKey: AGENT_KEY }, { source: 'technicalSeoAgent' }]
  })
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean();
}

module.exports = {
  AGENT_KEY,
  run,
  collectTechnicalSignals,
  analyzeTechnicalFindings,
  checkRobotsAndSitemap,
  generateFixesForFindings,
  approveFindings,
  rejectFindings,
  getExecutionHistory
};

verifierRegistry.register('robots_txt', (url) => checkRobotsAndSitemap(url));
verifierRegistry.register('sitemap', (url) => checkRobotsAndSitemap(url));
verifierRegistry.register('canonical_issues', (url) => new CrawlService(url, 1).fetchAndParse(url));
verifierRegistry.register('core_web_vitals', (url) => dataForSeoService.getPageSpeed(url));
verifierRegistry.register('broken_links', (url) => new CrawlService(url, 1).fetchAndParse(url));
verifierRegistry.register('missing_meta', (url) => new CrawlService(url, 1).fetchAndParse(url));