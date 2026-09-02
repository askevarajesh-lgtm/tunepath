const WorkspaceProject = require('./models/workspaceProject.model');
const WorkspaceAudit = require('./models/workspaceAudit.model');
const WorkspaceKeyword = require('./models/workspaceKeyword.model');
const WorkspaceStrategy = require('./models/workspaceStrategy.model');
const WorkspaceTask = require('./models/workspaceTask.model');
const { WorkspaceReport } = require('./models/workspaceReportAsset.model');
const WorkspaceComment = require('./models/workspaceComment.model');
const WorkspaceAttachment = require('./models/workspaceAttachment.model');
const WorkspaceAuditLog = require('./models/workspaceAuditLog.model');
const WorkspaceTechnicalAudit = require('./models/workspaceTechnicalAudit.model');
const { WorkspaceGeoAudit } = require('./models/workspaceGeoAuditAsset.model');
const {
  WorkspaceAeoAudit,
  WorkspaceAeoAuditPage,
  WorkspaceAeoAuditSimulation,
  WorkspaceAeoAuditEntityGraph,
  WorkspaceAeoAuditRecommendation
} = require('./models/workspaceAeoAuditAsset.model');
const WorkspaceAgentOrchestrator = require('./services/workspaceAgentOrchestrator.service');
const WordPressService = require('../seoIntelligence/services/wordPress.service');
const GoogleService = require('../seoIntelligence/services/google.service');
const seoAuditorAgent = require('./services/seoAuditorAgent.service');
const keywordResearchAgent = require('./services/keywordResearchAgent.service');
const keywordIntelligence = require('./services/keywordIntelligence.service');
const competitorAgent = require('./services/competitorAgent.service');
const technicalSeoAgent = require('./services/technicalSeoAgent.service');
const contentAgent = require('./services/contentAgent.service');
const schemaAgent = require('./services/schemaAgent.service');
const internalLinkingAgent = require('./services/internalLinkingAgent.service');
const imageSeoAgent = require('./services/imageSeoAgent.service');
const aeoAgent = require('./services/aeoAgent.service');
const geoAgent = require('./services/geoAgent.service');
const automationAgent = require('./services/automationAgent.service');
const auditLogService = require('./services/auditLog.service');
const taskVerification = require('./services/taskVerification.service');
const AiSettings = require('../aiStudio/models/aiSettings.model');
const cryptoUtils = require('../../utils/crypto');

const getWorkspaceId = (req) => {
  const user = req.user;
  if (!user) return req.companyId || req.workspaceId;
  const clientRoles = ['agency_client', 'brand_super_admin', 'brand_manager', 'brand_team_user', 'client'];
  if (clientRoles.includes(user.role)) {
    return user.brandId || user._id;
  }
  return user.agencyId || user._id;
};

exports.getSettingsStatus = async (req, res) => {
  try {
    const workspaceId = getWorkspaceId(req);
    if (!workspaceId) return res.status(401).json({ success: false, message: 'Unauthorized' });

    const settings = await AiSettings.findOne({ workspaceId });
    let isAnthropicConfigured = false;
    let maskedAnthropicKey = '';

    if (settings && settings.anthropicApiKey) {
      isAnthropicConfigured = true;
      const decrypted = cryptoUtils.decrypt(settings.anthropicApiKey);
      if (decrypted && decrypted.length > 8) {
        maskedAnthropicKey = decrypted.substring(0, 7) + '...' + decrypted.substring(decrypted.length - 4);
      } else {
        maskedAnthropicKey = 'sk-ant-...';
      }
    }

    return res.status(200).json({
      success: true,
      data: { isAnthropicConfigured, maskedAnthropicKey }
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

exports.saveSettings = async (req, res) => {
  try {
    const { anthropicApiKey } = req.body;
    const workspaceId = getWorkspaceId(req);

    if (!workspaceId) return res.status(401).json({ success: false, message: 'Unauthorized' });

    const updateFields = {};
    if (anthropicApiKey !== undefined) {
      if (anthropicApiKey.trim() !== '') {
        updateFields.anthropicApiKey = cryptoUtils.encrypt(anthropicApiKey.trim());
      } else {
        updateFields.anthropicApiKey = null;
      }
    }

    await AiSettings.findOneAndUpdate(
      { workspaceId },
      { $set: updateFields },
      { upsert: true, returnDocument: 'after' }
    );

    return res.status(200).json({ success: true, message: 'Settings saved successfully' });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

exports.getProjects = async (req, res) => {
  try {
    const companyId = req.user.companyId || req.user.agencyId || req.user._id;
    // Strictly isolate data: Users only see projects they explicitly created
    const query = { companyId, isDeleted: false, createdBy: req.user._id };

    if (req.query.clientId) {
      query.clientId = req.query.clientId;
    }

    const projects = await WorkspaceProject.find(query)
      .populate('clientId', 'name companyName brandName')
      .sort({ createdAt: -1 });

    res.status(200).json({ success: true, count: projects.length, data: projects });
  } catch (error) {
    console.error('Error fetching Workspace projects:', error);
    res.status(500).json({ success: false, message: 'Server error fetching Workspace projects' });
  }
};

exports.createProject = async (req, res) => {
  try {
    const companyId = req.user.companyId || req.user.agencyId || req.user._id;
    const { domain, siteUrl, name, clientId, projectId, targetLocations, searchEngines, languages } = req.body;

    let projectDomain = domain || siteUrl;
    if (!projectDomain || !name) {
      return res.status(400).json({ success: false, message: 'Domain/siteUrl and name are required.' });
    }

    // Normalize domain
    projectDomain = projectDomain.replace(/^https?:\/\//, '').replace(/\/$/, '');

    const resolvedClientId = clientId || req.user._id;

    const existing = await WorkspaceProject.findOne({ domain: projectDomain, companyId, isDeleted: false });
    if (existing) {
      return res.status(400).json({ success: false, message: 'Workspace Project for this domain already exists.' });
    }

    const project = await WorkspaceProject.create({
      companyId,
      clientId: resolvedClientId,
      projectId: projectId || null,
      domain: projectDomain,
      name,
      targetLocations: targetLocations || [{ location_code: 2840, location_name: 'United States', country_iso_code: 'US' }],
      searchEngines: searchEngines || ['google'],
      languages: languages || ['en'],
      createdBy: req.user._id,
      phase: 'intake'
    });

    auditLogService.record({
      targetType: 'Project', targetId: project._id, projectId: project._id,
      action: 'created', fromValue: null, toValue: { domain: projectDomain, name }, userId: req.user._id
    });

    res.status(201).json({ success: true, data: project });
  } catch (error) {
    console.error('Error creating Workspace project:', error);
    res.status(500).json({ success: false, message: 'Server error creating Workspace project' });
  }
};

exports.updateSettings = async (req, res) => {
  try {
    const { projectId } = req.params;
    const { settings } = req.body;

    const project = await WorkspaceProject.findById(projectId);
    if (!project) return res.status(404).json({ success: false, message: 'Project not found' });

    const fromSettings = project.settings;
    project.settings = settings;
    await project.save();

    auditLogService.record({
      targetType: 'Project', targetId: project._id, projectId: project._id,
      action: 'settings_updated', fromValue: fromSettings, toValue: settings, userId: req.user._id
    });

    res.json({ success: true, data: project });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.configureGA4Property = async (req, res) => {
  try {
    const { projectId } = req.params;
    const { ga4PropertyId } = req.body;
    const companyId = req.user.companyId || req.user.agencyId || req.user._id;

    const project = await WorkspaceProject.findOneAndUpdate(
      { _id: projectId, companyId, isDeleted: false },
      { $set: { 'credentials.ga4PropertyId': ga4PropertyId } },
      { new: true }
    );
    if (!project) return res.status(404).json({ success: false, message: 'Project not found' });

    res.json({ success: true, data: project });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.runAudit = async (req, res) => {
  try {
    const { projectId } = req.params;
    const companyId = req.user.companyId || req.user.agencyId || req.user._id;

    const project = await WorkspaceProject.findOne({ _id: projectId, companyId, isDeleted: false });
    if (!project) {
      return res.status(404).json({ success: false, message: 'Project not found' });
    }
    const newAudit = await seoAuditorAgent.collectRawAudit(project, companyId, 1);

    res.status(200).json({ success: true, data: newAudit, score: newAudit.metrics.overall || newAudit.metrics.onpageScore });
  } catch (error) {
    console.error('Error running audit:', error);
    res.status(500).json({ success: false, message: error.message || 'Server error running audit' });
  }
};

exports.runAuditorAgent = async (req, res) => {
  try {
    const { projectId } = req.params;
    const companyId = req.user.companyId || req.user.agencyId || req.user._id;

    const project = await WorkspaceProject.findOne({ _id: projectId, companyId, isDeleted: false });
    if (!project) {
      return res.status(404).json({ success: false, message: 'Project not found' });
    }

    const workspaceId = getWorkspaceId(req);
    const options = req.body || {};
    const audit = await seoAuditorAgent.run(projectId, workspaceId, options);

    res.status(200).json({ success: true, data: audit });
  } catch (error) {
    console.error('[runAuditorAgent] Error:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
};

exports.approveAuditFindings = async (req, res) => {
  try {
    const { projectId, auditId } = req.params;
    const { audit, createdTasks } = await seoAuditorAgent.approveFindings(auditId, projectId, req.user._id);
    res.status(200).json({ success: true, data: audit, createdTasks });
  } catch (error) {
    console.error('Error approving audit findings:', error);
    res.status(500).json({ success: false, message: error.message || 'Server error approving audit findings' });
  }
};

exports.rejectAuditFindings = async (req, res) => {
  try {
    const { projectId, auditId } = req.params;
    const { reason } = req.body;
    const audit = await seoAuditorAgent.rejectFindings(auditId, projectId, req.user._id, reason);
    res.status(200).json({ success: true, data: audit });
  } catch (error) {
    console.error('Error rejecting audit findings:', error);
    res.status(500).json({ success: false, message: error.message || 'Server error rejecting audit findings' });
  }
};

exports.getAuditorExecutionHistory = async (req, res) => {
  try {
    const { projectId } = req.params;
    const limit = Math.min(parseInt(req.query.limit, 10) || 20, 100);
    const history = await seoAuditorAgent.getExecutionHistory(projectId, limit);
    res.status(200).json({ success: true, data: history });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

exports.getAuditStatus = async (req, res) => {
  try {
    const { projectId } = req.params;
    const WorkspaceAuditJob = require('./models/workspaceAuditJob.model');
    const job = await WorkspaceAuditJob.findOne({ projectId }).sort({ createdAt: -1 });
    if (!job) {
      return res.json({ status: 'none' });
    }
    res.json({
      status: job.status,
      jobId: job._id,
      progress: job.progress,
      startedAt: job.startedAt,
      completedAt: job.completedAt,
      error: job.error
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

exports.runKeywordResearchAgent = async (req, res) => {
  try {
    const { projectId } = req.params;
    const companyId = req.user.companyId || req.user.agencyId || req.user._id;
    const { seedKeyword } = req.body || {};

    const project = await WorkspaceProject.findOne({ _id: projectId, companyId, isDeleted: false });
    if (!project) {
      return res.status(404).json({ success: false, message: 'Project not found' });
    }

    const workspaceId = getWorkspaceId(req);
    const result = await keywordResearchAgent.run(projectId, workspaceId, { seedKeyword });

    res.status(200).json({ success: true, data: result });
  } catch (error) {
    console.error('[runKeywordResearchAgent] Error:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
};

exports.approveKeywordSuggestions = async (req, res) => {
  try {
    const { projectId } = req.params;
    const { keywordIds } = req.body;
    const result = await keywordResearchAgent.approveKeywords(projectId, keywordIds, req.user._id);
    res.status(200).json({ success: true, modifiedCount: result.modifiedCount });
  } catch (error) {
    console.error('Error approving keyword suggestions:', error);
    res.status(500).json({ success: false, message: error.message || 'Server error approving keyword suggestions' });
  }
};

exports.rejectKeywordSuggestions = async (req, res) => {
  try {
    const { projectId } = req.params;
    const { keywordIds, reason } = req.body;
    const result = await keywordResearchAgent.rejectKeywords(projectId, keywordIds, req.user._id, reason);
    res.status(200).json({ success: true, modifiedCount: result.modifiedCount });
  } catch (error) {
    console.error('Error rejecting keyword suggestions:', error);
    res.status(500).json({ success: false, message: error.message || 'Server error rejecting keyword suggestions' });
  }
};

exports.getKeywordResearchExecutionHistory = async (req, res) => {
  try {
    const { projectId } = req.params;
    const limit = Math.min(parseInt(req.query.limit, 10) || 20, 100);
    const history = await keywordResearchAgent.getExecutionHistory(projectId, limit);
    res.status(200).json({ success: true, data: history });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

exports.detectKeywordIntent = async (req, res) => {
  try {
    const { projectId } = req.params;
    const { keywords } = req.body || {};
    if (!Array.isArray(keywords) || keywords.length === 0) {
      return res.status(400).json({ success: false, message: 'keywords[] is required' });
    }

    const results = await keywordIntelligence.getSearchVolumeAndTrend(keywords, { projectId });
    const byKeyword = new Map(results.map((r) => [r.keyword.toLowerCase(), r]));

    const data = keywords.map((k) => {
      const match = byKeyword.get(k.toLowerCase());
      return {
        keyword: k,
        intent: match?.intent || 'unknown',
        confidence: match ? 'measured' : 'unmeasured'
      };
    });

    res.status(200).json({ success: true, data });
  } catch (error) {
    console.error('[detectKeywordIntent] Error:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
};

exports.getRelatedKeywords = async (req, res) => {
  try {
    const { projectId } = req.params;
    const { keyword } = req.body || {};
    if (!keyword || !keyword.trim()) {
      return res.status(400).json({ success: false, message: 'keyword is required' });
    }

    const candidates = await keywordIntelligence.getCandidatePool(keyword.trim(), { projectId, limit: 30 });
    res.status(200).json({ success: true, data: candidates });
  } catch (error) {
    console.error('[getRelatedKeywords] Error:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
};

exports.runCompetitorAgent = async (req, res) => {
  try {
    const { projectId } = req.params;
    const companyId = req.user.companyId || req.user.agencyId || req.user._id;

    const project = await WorkspaceProject.findOne({ _id: projectId, companyId, isDeleted: false });
    if (!project) {
      return res.status(404).json({ success: false, message: 'Project not found' });
    }

    const workspaceId = getWorkspaceId(req);
    const result = await competitorAgent.run(projectId, workspaceId);

    res.status(200).json({ success: true, data: result });
  } catch (error) {
    console.error('[runCompetitorAgent] Error:', error.message);
    const statusCode = error.message.includes('Anthropic API key') ? 400 : 500;
    res.status(statusCode).json({ success: false, error: error.message });
  }
};

exports.approveCompetitorSuggestions = async (req, res) => {
  try {
    const { projectId } = req.params;
    const { competitorIds } = req.body;
    const companyId = req.user.companyId || req.user.agencyId || req.user._id;

    const project = await WorkspaceProject.findOne({ _id: projectId, companyId, isDeleted: false });
    if (!project) {
      return res.status(404).json({ success: false, message: 'Project not found or unauthorized' });
    }

    const result = await competitorAgent.approveCompetitors(projectId, competitorIds, req.user._id);
    res.status(200).json({ success: true, modifiedCount: result.modifiedCount });
  } catch (error) {
    console.error('Error approving competitor suggestions:', error);
    res.status(500).json({ success: false, message: error.message || 'Server error approving competitor suggestions' });
  }
};

exports.rejectCompetitorSuggestions = async (req, res) => {
  try {
    const { projectId } = req.params;
    const { competitorIds, reason } = req.body;
    const companyId = req.user.companyId || req.user.agencyId || req.user._id;

    const project = await WorkspaceProject.findOne({ _id: projectId, companyId, isDeleted: false });
    if (!project) {
      return res.status(404).json({ success: false, message: 'Project not found or unauthorized' });
    }

    const result = await competitorAgent.rejectCompetitors(projectId, competitorIds, req.user._id, reason);
    res.status(200).json({ success: true, modifiedCount: result.modifiedCount });
  } catch (error) {
    console.error('Error rejecting competitor suggestions:', error);
    res.status(500).json({ success: false, message: error.message || 'Server error rejecting competitor suggestions' });
  }
};

exports.getCompetitorExecutionHistory = async (req, res) => {
  try {
    const { projectId } = req.params;
    const companyId = req.user.companyId || req.user.agencyId || req.user._id;

    const project = await WorkspaceProject.findOne({ _id: projectId, companyId, isDeleted: false });
    if (!project) {
      return res.status(404).json({ success: false, message: 'Project not found or unauthorized' });
    }

    const limit = Math.min(parseInt(req.query.limit, 10) || 20, 100);
    const history = await competitorAgent.getExecutionHistory(projectId, limit);
    res.status(200).json({ success: true, data: history });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

exports.runTechnicalSeoAgent = async (req, res) => {
  try {
    const { projectId } = req.params;
    const companyId = req.user.companyId || req.user.agencyId || req.user._id;

    const project = await WorkspaceProject.findOne({ _id: projectId, companyId, isDeleted: false });
    if (!project) {
      return res.status(404).json({ success: false, message: 'Project not found' });
    }

    const workspaceId = getWorkspaceId(req);
    const result = await technicalSeoAgent.run(projectId, workspaceId);

    res.status(200).json({ success: true, data: result });
  } catch (error) {
    console.error('[runTechnicalSeoAgent] Error:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
};

exports.generateTechnicalFixes = async (req, res) => {
  try {
    const { projectId, auditId } = req.params;
    const workspaceId = getWorkspaceId(req);
    const audit = await technicalSeoAgent.generateFixesForFindings(auditId, projectId, workspaceId);
    res.status(200).json({ success: true, data: audit });
  } catch (error) {
    console.error('[generateTechnicalFixes] Error:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
};

exports.approveTechnicalFindings = async (req, res) => {
  try {
    const { projectId, auditId } = req.params;
    const { audit, createdTasks } = await technicalSeoAgent.approveFindings(auditId, projectId, req.user._id);
    res.status(200).json({ success: true, data: audit, createdTasks });
  } catch (error) {
    console.error('Error approving technical findings:', error);
    res.status(500).json({ success: false, message: error.message || 'Server error approving technical findings' });
  }
};

exports.rejectTechnicalFindings = async (req, res) => {
  try {
    const { projectId, auditId } = req.params;
    const { reason } = req.body;
    const result = await technicalSeoAgent.rejectFindings(auditId, projectId, req.user._id, reason);
    res.status(200).json({ success: true, data: result });
  } catch (error) {
    console.error('Error rejecting technical findings:', error);
    res.status(500).json({ success: false, message: error.message || 'Server error rejecting technical findings' });
  }
};

exports.getTechnicalSeoExecutionHistory = async (req, res) => {
  try {
    const { projectId } = req.params;
    const limit = Math.min(parseInt(req.query.limit, 10) || 20, 100);
    const history = await technicalSeoAgent.getExecutionHistory(projectId, limit);
    res.status(200).json({ success: true, data: history });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};


exports.runContentAgent = async (req, res) => {
  try {
    const { projectId } = req.params;
    const companyId = req.user.companyId || req.user.agencyId || req.user._id;

    const project = await WorkspaceProject.findOne({ _id: projectId, companyId, isDeleted: false });
    if (!project) {
      return res.status(404).json({ success: false, message: 'Project not found' });
    }

    const workspaceId = getWorkspaceId(req);
    const result = await contentAgent.run(projectId, workspaceId);

    res.status(200).json({ success: true, data: result });
  } catch (error) {
    console.error('[runContentAgent] Error:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
};

exports.approveContentBriefs = async (req, res) => {
  try {
    const { projectId, contentBriefId } = req.params;
    const { contentBrief, createdTasks } = await contentAgent.approveBriefs(contentBriefId, projectId, req.user._id);
    res.status(200).json({ success: true, data: contentBrief, createdTasks });
  } catch (error) {
    console.error('Error approving content briefs:', error);
    res.status(500).json({ success: false, message: error.message || 'Server error approving content briefs' });
  }
};

exports.rejectContentBriefs = async (req, res) => {
  try {
    const { projectId, contentBriefId } = req.params;
    const { reason } = req.body;
    const result = await contentAgent.rejectBriefs(contentBriefId, projectId, req.user._id, reason);
    res.status(200).json({ success: true, data: result });
  } catch (error) {
    console.error('Error rejecting content briefs:', error);
    res.status(500).json({ success: false, message: error.message || 'Server error rejecting content briefs' });
  }
};

exports.getContentAgentExecutionHistory = async (req, res) => {
  try {
    const { projectId } = req.params;
    const limit = Math.min(parseInt(req.query.limit, 10) || 20, 100);
    const history = await contentAgent.getExecutionHistory(projectId, limit);
    res.status(200).json({ success: true, data: history });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};


exports.runSchemaAgent = async (req, res) => {
  try {
    const { projectId } = req.params;
    const companyId = req.user.companyId || req.user.agencyId || req.user._id;

    const project = await WorkspaceProject.findOne({ _id: projectId, companyId, isDeleted: false });
    if (!project) {
      return res.status(404).json({ success: false, message: 'Project not found' });
    }

    const workspaceId = getWorkspaceId(req);
    const result = await schemaAgent.run(projectId, workspaceId);

    res.status(200).json({ success: true, data: result });
  } catch (error) {
    console.error('[runSchemaAgent] Error:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
};

exports.approveSchemaMarkup = async (req, res) => {
  try {
    const { projectId, markupId } = req.params;
    const { markup, createdTasks } = await schemaAgent.approveSchemaMarkup(markupId, projectId, req.user._id);
    res.status(200).json({ success: true, data: markup, createdTasks });
  } catch (error) {
    console.error('Error approving schema markup:', error);
    res.status(500).json({ success: false, message: error.message || 'Server error approving schema markup' });
  }
};

exports.rejectSchemaMarkup = async (req, res) => {
  try {
    const { projectId, markupId } = req.params;
    const { reason } = req.body;
    const result = await schemaAgent.rejectSchemaMarkup(markupId, projectId, req.user._id, reason);
    res.status(200).json({ success: true, data: result });
  } catch (error) {
    console.error('Error rejecting schema markup:', error);
    res.status(500).json({ success: false, message: error.message || 'Server error rejecting schema markup' });
  }
};

exports.getSchemaAgentExecutionHistory = async (req, res) => {
  try {
    const { projectId } = req.params;
    const limit = Math.min(parseInt(req.query.limit, 10) || 20, 100);
    const history = await schemaAgent.getExecutionHistory(projectId, limit);
    res.status(200).json({ success: true, data: history });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};


exports.runInternalLinkingAgent = async (req, res) => {
  try {
    const { projectId } = req.params;
    const companyId = req.user.companyId || req.user.agencyId || req.user._id;

    const project = await WorkspaceProject.findOne({ _id: projectId, companyId, isDeleted: false });
    if (!project) {
      return res.status(404).json({ success: false, message: 'Project not found' });
    }

    const workspaceId = getWorkspaceId(req);
    const result = await internalLinkingAgent.run(projectId, workspaceId);

    res.status(200).json({ success: true, data: result });
  } catch (error) {
    console.error('[runInternalLinkingAgent] Error:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
};

exports.approveInternalLinkSuggestions = async (req, res) => {
  try {
    const { projectId, linkRunId } = req.params;
    const { linkRun, createdTasks } = await internalLinkingAgent.approveLinkSuggestions(linkRunId, projectId, req.user._id);
    res.status(200).json({ success: true, data: linkRun, createdTasks });
  } catch (error) {
    console.error('Error approving internal link suggestions:', error);
    res.status(500).json({ success: false, message: error.message || 'Server error approving internal link suggestions' });
  }
};

exports.rejectInternalLinkSuggestions = async (req, res) => {
  try {
    const { projectId, linkRunId } = req.params;
    const { reason } = req.body;
    const result = await internalLinkingAgent.rejectLinkSuggestions(linkRunId, projectId, req.user._id, reason);
    res.status(200).json({ success: true, data: result });
  } catch (error) {
    console.error('Error rejecting internal link suggestions:', error);
    res.status(500).json({ success: false, message: error.message || 'Server error rejecting internal link suggestions' });
  }
};

exports.getInternalLinkingExecutionHistory = async (req, res) => {
  try {
    const { projectId } = req.params;
    const limit = Math.min(parseInt(req.query.limit, 10) || 20, 100);
    const history = await internalLinkingAgent.getExecutionHistory(projectId, limit);
    res.status(200).json({ success: true, data: history });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};


exports.runImageSeoAgent = async (req, res) => {
  try {
    const { projectId } = req.params;
    const companyId = req.user.companyId || req.user.agencyId || req.user._id;

    const project = await WorkspaceProject.findOne({ _id: projectId, companyId, isDeleted: false });
    if (!project) {
      return res.status(404).json({ success: false, message: 'Project not found' });
    }

    const workspaceId = getWorkspaceId(req);
    const result = await imageSeoAgent.run(projectId, workspaceId);

    res.status(200).json({ success: true, data: result });
  } catch (error) {
    console.error('[runImageSeoAgent] Error:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
};

exports.approveImageSeoRecommendations = async (req, res) => {
  try {
    const { projectId, imageSeoRunId } = req.params;
    const { imageSeoRun, createdTasks } = await imageSeoAgent.approveImageSeoRecommendations(imageSeoRunId, projectId, req.user._id);
    res.status(200).json({ success: true, data: imageSeoRun, createdTasks });
  } catch (error) {
    console.error('Error approving image SEO recommendations:', error);
    res.status(500).json({ success: false, message: error.message || 'Server error approving image SEO recommendations' });
  }
};

exports.rejectImageSeoRecommendations = async (req, res) => {
  try {
    const { projectId, imageSeoRunId } = req.params;
    const { reason } = req.body;
    const result = await imageSeoAgent.rejectImageSeoRecommendations(imageSeoRunId, projectId, req.user._id, reason);
    res.status(200).json({ success: true, data: result });
  } catch (error) {
    console.error('Error rejecting image SEO recommendations:', error);
    res.status(500).json({ success: false, message: error.message || 'Server error rejecting image SEO recommendations' });
  }
};

exports.getImageSeoExecutionHistory = async (req, res) => {
  try {
    const { projectId } = req.params;
    const limit = Math.min(parseInt(req.query.limit, 10) || 20, 100);
    const history = await imageSeoAgent.getExecutionHistory(projectId, limit);
    res.status(200).json({ success: true, data: history });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};


exports.runAeoAgent = async (req, res) => {
  try {
    const { projectId } = req.params;
    const companyId = req.user.companyId || req.user.agencyId || req.user._id;

    const project = await WorkspaceProject.findOne({ _id: projectId, companyId, isDeleted: false });
    if (!project) {
      return res.status(404).json({ success: false, message: 'Project not found' });
    }

    const workspaceId = getWorkspaceId(req);
    const result = await aeoAgent.run(projectId, workspaceId);

    res.status(200).json({ success: true, data: result });
  } catch (error) {
    console.error('[runAeoAgent] Error:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
};

exports.approveAeoRecommendations = async (req, res) => {
  try {
    const { projectId, auditId } = req.params;
    const { audit, createdTasks } = await aeoAgent.approveAeoRecommendations(auditId, projectId, req.user._id);
    res.status(200).json({ success: true, data: audit, createdTasks });
  } catch (error) {
    console.error('Error approving AEO recommendations:', error);
    res.status(500).json({ success: false, message: error.message || 'Server error approving AEO recommendations' });
  }
};

exports.rejectAeoRecommendations = async (req, res) => {
  try {
    const { projectId, auditId } = req.params;
    const { reason } = req.body;
    const result = await aeoAgent.rejectAeoRecommendations(auditId, projectId, req.user._id, reason);
    res.status(200).json({ success: true, data: result });
  } catch (error) {
    console.error('Error rejecting AEO recommendations:', error);
    res.status(500).json({ success: false, message: error.message || 'Server error rejecting AEO recommendations' });
  }
};

exports.getAeoAgentExecutionHistory = async (req, res) => {
  try {
    const { projectId } = req.params;
    const limit = Math.min(parseInt(req.query.limit, 10) || 20, 100);
    const history = await aeoAgent.getExecutionHistory(projectId, limit);
    res.status(200).json({ success: true, data: history });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

exports.getAeoAuditSummary = async (req, res) => {
  try {
    const { auditId } = req.params;
    const audit = await WorkspaceAeoAudit.findById(auditId);
    if (!audit) return res.status(404).json({ success: false, message: 'Audit not found' });
    res.status(200).json({ success: true, data: audit });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

exports.getAeoAuditPages = async (req, res) => {
  try {
    const { auditId } = req.params;
    const { page, limit, status } = req.query;
    const query = { auditId };
    if (status) query.status = status;

    const pageNum = parseInt(page) || 1;
    const limitNum = parseInt(limit) || 20;

    const pages = await WorkspaceAeoAuditPage.find(query)
      .skip((pageNum - 1) * limitNum)
      .limit(limitNum)
      .lean();

    const total = await WorkspaceAeoAuditPage.countDocuments(query);

    res.status(200).json({
      success: true,
      data: pages,
      pagination: { total, page: pageNum, limit: limitNum, totalPages: Math.ceil(total / limitNum) }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

exports.getAeoAuditSimulations = async (req, res) => {
  try {
    const { auditId } = req.params;
    const { pageUrl, platform } = req.query;
    const query = { auditId };
    if (pageUrl) query.pageUrl = pageUrl;
    if (platform) query.platform = platform;

    const simulations = await WorkspaceAeoAuditSimulation.find(query).lean();
    res.status(200).json({ success: true, data: simulations });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

exports.getAeoAuditEntityGraph = async (req, res) => {
  try {
    const { auditId } = req.params;
    const { pageUrl } = req.query;
    const query = { auditId };
    if (pageUrl) query.pageUrl = pageUrl;

    const graphs = await WorkspaceAeoAuditEntityGraph.find(query).lean();
    res.status(200).json({ success: true, data: graphs });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

exports.getAeoAuditRecommendations = async (req, res) => {
  try {
    const { auditId } = req.params;
    const { category, priority, status } = req.query;
    const query = { auditId };
    if (category) query.category = category;
    if (priority) query.priority = priority;
    if (status) query.status = status;

    const recommendations = await WorkspaceAeoAuditRecommendation.find(query).lean();
    res.status(200).json({ success: true, data: recommendations });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

exports.exportAeoAudit = async (req, res) => {
  try {
    const { auditId } = req.params;
    const [pages, recs] = await Promise.all([
      WorkspaceAeoAuditPage.find({ auditId }).lean(),
      WorkspaceAeoAuditRecommendation.find({ auditId }).lean()
    ]);

    let csv = 'Type,URL,Title,Priority,Category,Status\n';

    pages.forEach(p => {
      csv += `"Page","${p.pageUrl || ''}","","","",""\n`;
    });

    recs.forEach(r => {
      csv += `"Recommendation","${r.pageUrl || 'Sitewide'}","${(r.title || '').replace(/"/g, '""')}","${r.priority || ''}","${r.category || ''}","${r.status || ''}"\n`;
    });

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="aeo-export-${auditId}.csv"`);
    res.status(200).send(csv);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

exports.runGeoAgent = async (req, res) => {
  try {
    const { projectId } = req.params;
    const companyId = req.user.companyId || req.user.agencyId || req.user._id;

    const project = await WorkspaceProject.findOne({ _id: projectId, companyId, isDeleted: false });
    if (!project) {
      return res.status(404).json({ success: false, message: 'Project not found' });
    }

    const workspaceId = getWorkspaceId(req);
    const result = await geoAgent.run(projectId, workspaceId);

    res.status(200).json({ success: true, data: result });
  } catch (error) {
    console.error('[runGeoAgent] Error:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
};

exports.approveGeoRecommendations = async (req, res) => {
  try {
    const { projectId, auditId } = req.params;
    const { audit, createdTasks } = await geoAgent.approveGeoRecommendations(auditId, projectId, req.user._id);
    res.status(200).json({ success: true, data: audit, createdTasks });
  } catch (error) {
    console.error('Error approving GEO recommendations:', error);
    res.status(500).json({ success: false, message: error.message || 'Server error approving GEO recommendations' });
  }
};

exports.rejectGeoRecommendations = async (req, res) => {
  try {
    const { projectId, auditId } = req.params;
    const { reason } = req.body;
    const result = await geoAgent.rejectGeoRecommendations(auditId, projectId, req.user._id, reason);
    res.status(200).json({ success: true, data: result });
  } catch (error) {
    console.error('Error rejecting GEO recommendations:', error);
    res.status(500).json({ success: false, message: error.message || 'Server error rejecting GEO recommendations' });
  }
};

exports.getGeoAgentExecutionHistory = async (req, res) => {
  try {
    const { projectId } = req.params;
    const limit = Math.min(parseInt(req.query.limit, 10) || 20, 100);
    const history = await geoAgent.getExecutionHistory(projectId, limit);
    res.status(200).json({ success: true, data: history });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

exports.getGeoAuditSummary = async (req, res) => {
  try {
    const { WorkspaceGeoAudit } = require('./models/workspaceGeoAuditAsset.model');
    const audit = await WorkspaceGeoAudit.findOne({ _id: req.params.auditId, projectId: req.params.projectId });
    if (!audit) return res.status(404).json({ success: false, error: 'Audit not found' });
    res.json({ success: true, data: audit });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

exports.getGeoAuditPages = async (req, res) => {
  try {
    const { WorkspaceGeoPageAnalysis } = require('./models/workspaceGeoAuditAsset.model');
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;

    const pages = await WorkspaceGeoPageAnalysis.find({ auditId: req.params.auditId, projectId: req.params.projectId })
      .skip((page - 1) * limit)
      .limit(limit);
    const total = await WorkspaceGeoPageAnalysis.countDocuments({ auditId: req.params.auditId, projectId: req.params.projectId });

    res.json({ success: true, data: pages, pagination: { total, page, limit } });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

exports.getGeoAuditEntities = async (req, res) => {
  try {
    const { WorkspaceGeoEntityAnalysis } = require('./models/workspaceGeoAuditAsset.model');
    const data = await WorkspaceGeoEntityAnalysis.findOne({ auditId: req.params.auditId, projectId: req.params.projectId });
    res.json({ success: true, data });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

exports.getGeoAuditTechnical = async (req, res) => {
  try {
    const { WorkspaceGeoTechnicalAnalysis } = require('./models/workspaceGeoAuditAsset.model');
    const data = await WorkspaceGeoTechnicalAnalysis.findOne({ auditId: req.params.auditId, projectId: req.params.projectId });
    res.json({ success: true, data });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

exports.getGeoAuditRecommendations = async (req, res) => {
  try {
    const { WorkspaceGeoAudit } = require('./models/workspaceGeoAuditAsset.model');
    const audit = await WorkspaceGeoAudit.findOne({ _id: req.params.auditId, projectId: req.params.projectId });
    if (!audit) return res.status(404).json({ success: false, error: 'Audit not found' });

    let recs = audit.agent?.recommendations || [];
    if (req.query.priority) {
      recs = recs.filter(r => r.priority === req.query.priority);
    }
    res.json({ success: true, data: recs });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

exports.getGeoAuditTrends = async (req, res) => {
  try {
    const { WorkspaceGeoAudit } = require('./models/workspaceGeoAuditAsset.model');
    const audits = await WorkspaceGeoAudit.find({ projectId: req.params.projectId, status: 'completed' })
      .sort({ createdAt: -1 })
      .limit(10)
      .select('createdAt overallGeoScore healthLevel scoreBreakdown agent.entityConsistencyScore');
    res.json({ success: true, data: audits });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

exports.runAutomationAgent = async (req, res) => {
  try {
    const { projectId } = req.params;
    const companyId = req.user.companyId || req.user.agencyId || req.user._id;

    const project = await WorkspaceProject.findOne({ _id: projectId, companyId, isDeleted: false });
    if (!project) {
      return res.status(404).json({ success: false, message: 'Project not found' });
    }

    const workspaceId = getWorkspaceId(req);
    const result = await automationAgent.run(projectId, workspaceId);

    res.status(200).json({ success: true, data: result });
  } catch (error) {
    console.error('[runAutomationAgent] Error:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
};

exports.createAutomationRule = async (req, res) => {
  try {
    const { projectId } = req.params;
    const companyId = req.user.companyId || req.user.agencyId || req.user._id;

    const project = await WorkspaceProject.findOne({ _id: projectId, companyId, isDeleted: false });
    if (!project) {
      return res.status(404).json({ success: false, message: 'Project not found' });
    }

    const rule = await automationAgent.createRule(projectId, req.body, req.user._id);
    res.status(201).json({ success: true, data: rule });
  } catch (error) {
    console.error('[createAutomationRule] Error:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
};

exports.listAutomationRules = async (req, res) => {
  try {
    const { projectId } = req.params;
    const companyId = req.user.companyId || req.user.agencyId || req.user._id;

    const project = await WorkspaceProject.findOne({ _id: projectId, companyId, isDeleted: false });
    if (!project) {
      return res.status(404).json({ success: false, message: 'Project not found' });
    }

    const rules = await automationAgent.listRules(projectId);
    res.status(200).json({ success: true, data: rules });
  } catch (error) {
    console.error('[listAutomationRules] Error:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
};

exports.approveAutomationRule = async (req, res) => {
  try {
    const { projectId, ruleId } = req.params;
    const result = await automationAgent.approveRule(ruleId, projectId, req.user._id);
    res.status(200).json({ success: true, data: result });
  } catch (error) {
    console.error('Error approving automation rule:', error);
    res.status(500).json({ success: false, message: error.message || 'Server error approving automation rule' });
  }
};

exports.rejectAutomationRule = async (req, res) => {
  try {
    const { projectId, ruleId } = req.params;
    const { reason } = req.body;
    const result = await automationAgent.rejectRule(ruleId, projectId, req.user._id, reason);
    res.status(200).json({ success: true, data: result });
  } catch (error) {
    console.error('Error rejecting automation rule:', error);
    res.status(500).json({ success: false, message: error.message || 'Server error rejecting automation rule' });
  }
};

exports.toggleAutomationRule = async (req, res) => {
  try {
    const { projectId, ruleId } = req.params;
    const { isEnabled } = req.body;
    const result = await automationAgent.toggleRule(ruleId, projectId, req.user._id, isEnabled);
    res.status(200).json({ success: true, data: result });
  } catch (error) {
    console.error('Error toggling automation rule:', error);
    res.status(500).json({ success: false, message: error.message || 'Server error toggling automation rule' });
  }
};



exports.retryAutomationRule = async (req, res) => {
  try {
    const { projectId, ruleId } = req.params;
    const workspaceId = getWorkspaceId(req);
    const result = await automationAgent.retryRule(projectId, ruleId, workspaceId);
    res.status(200).json({ success: true, data: result });
  } catch (error) {
    console.error('Error retrying automation rule:', error);
    res.status(500).json({ success: false, message: error.message || 'Server error retrying automation rule' });
  }
};

exports.getAutomationExecutionHistory = async (req, res) => {
  try {
    const { projectId } = req.params;
    const limit = Math.min(parseInt(req.query.limit, 10) || 20, 100);
    const history = await automationAgent.getExecutionHistory(projectId, limit);
    res.status(200).json({ success: true, data: history });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

exports.getAudits = async (req, res) => {
  try {
    const projects = await WorkspaceProject.find({ createdBy: req.user._id }, '_id');
    const projectIds = projects.map(p => p._id);

    const query = { projectId: { $in: projectIds } };
    if (req.query.projectId) {
      if (!projectIds.some(id => id.toString() === req.query.projectId)) {
        return res.json([]);
      }
      query.projectId = req.query.projectId;
    }

    const audits = await WorkspaceAudit.find(query).populate('projectId', 'name').sort({ createdAt: -1 });
    res.json(audits);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

exports.compareAudits = async (req, res) => {
  try {
    const { projectId } = req.params;
    const { auditId1, auditId2 } = req.query;

    if (!auditId1 || !auditId2) {
      return res.status(400).json({ success: false, error: 'Both auditId1 and auditId2 are required as query parameters.' });
    }

    const companyId = req.user.companyId || req.user.agencyId || req.user._id;
    const project = await WorkspaceProject.findOne({ _id: projectId, companyId, isDeleted: false });
    if (!project) {
      return res.status(404).json({ success: false, error: 'Project not found' });
    }

    const [audit1, audit2] = await Promise.all([
      WorkspaceAudit.findOne({ _id: auditId1, projectId }).lean(),
      WorkspaceAudit.findOne({ _id: auditId2, projectId }).lean()
    ]);

    if (!audit1 || !audit2) {
      return res.status(404).json({ success: false, error: 'One or both audits not found' });
    }

    // Sort to compare older vs newer regardless of input order
    const [older, newer] = audit1.createdAt < audit2.createdAt ? [audit1, audit2] : [audit2, audit1];

    const olderIssues = older.agent?.findings || [];
    const newerIssues = newer.agent?.findings || [];

    const olderIssueMap = new Map(olderIssues.map(i => [`${i.category}-${i.issue}-${i.pageUrl}`, i]));

    const newFindings = [];
    const resolvedFindings = [];
    const remainingFindings = [];

    newerIssues.forEach(issue => {
      const key = `${issue.category}-${issue.issue}-${issue.pageUrl}`;
      if (olderIssueMap.has(key)) {
        remainingFindings.push(issue);
        olderIssueMap.delete(key);
      } else {
        newFindings.push(issue);
      }
    });

    olderIssueMap.forEach(issue => {
      resolvedFindings.push(issue);
    });

    res.json({
      success: true,
      data: {
        olderAuditId: older._id,
        newerAuditId: newer._id,
        olderScore: older.metrics?.overall || older.metrics?.onpageScore,
        newerScore: newer.metrics?.overall || newer.metrics?.onpageScore,
        scoreDelta: (newer.metrics?.overall || newer.metrics?.onpageScore) - (older.metrics?.overall || older.metrics?.onpageScore),
        comparisons: {
          newFindings,
          resolvedFindings,
          remainingFindings
        }
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

exports.getKeywords = async (req, res) => {
  try {
    const projects = await WorkspaceProject.find({ createdBy: req.user._id }, '_id');
    const projectIds = projects.map(p => p._id);

    const query = { projectId: { $in: projectIds } };
    if (req.query.projectId) {
      if (!projectIds.some(id => id.toString() === req.query.projectId)) {
        return res.json([]);
      }
      query.projectId = req.query.projectId;
    }
    if (req.query.isQuestion === 'true') {
      query.isQuestion = true;
    }
    if (req.query.intent) {
      query['metrics.intent'] = req.query.intent;
    }
    if (req.query.status) {
      query.status = req.query.status;
    }

    let keywordsQuery = WorkspaceKeyword.find(query).populate('projectId', 'name').sort({ 'metrics.searchVolume': -1 });
    let keywords = await keywordsQuery;

    if (req.query.longTail === 'true') {
      keywords = keywords.filter((k) => k.keyword.trim().split(/\s+/).length >= 4);
    }

    res.json(keywords);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

exports.refreshKeywords = async (req, res) => {
  try {
    const { projectId } = req.params;
    const { keywordIds } = req.body; // array of keyword _ids
    const companyId = req.user.companyId || req.user.agencyId || req.user._id;

    const project = await WorkspaceProject.findOne({ _id: projectId, companyId, isDeleted: false });
    if (!project) return res.status(404).json({ success: false, error: 'Project not found' });

    let query = { projectId: project._id, isDeleted: false };
    if (keywordIds && keywordIds.length > 0) {
      query._id = { $in: keywordIds };
    }

    const keywords = await WorkspaceKeyword.find(query);
    if (keywords.length === 0) return res.status(400).json({ success: false, error: 'No keywords to refresh' });

    // Enforce budget
    const limit = project.settings?.budget?.dailyProviderLimit || 500;
    if (keywords.length > limit) {
      return res.status(400).json({ success: false, error: `Daily refresh limit of ${limit} exceeded.` });
    }

    // Pass to rank tracking service
    const rankTrackingService = require('./services/rankTracking.service');

    // In a real enterprise system this would push to BullMQ, but here we trigger asynchronously
    rankTrackingService.trackKeywords(project, keywords).catch(e => console.error('Rank tracking background error:', e));

    res.json({ success: true, message: `Rank refresh queued for ${keywords.length} keywords.` });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

exports.getRankDistribution = async (req, res) => {
  try {
    const { projectId } = req.params;
    const companyId = req.user.companyId || req.user.agencyId || req.user._id;

    const project = await WorkspaceProject.findOne({ _id: projectId, companyId, isDeleted: false });
    if (!project) return res.status(404).json({ success: false, error: 'Project not found' });

    const keywords = await WorkspaceKeyword.find({ projectId: project._id, isDeleted: false });

    const distribution = {
      top3: 0, top10: 0, top20: 0, top50: 0, top100: 0, notRanked: 0, total: keywords.length,
      averageVisibility: 0,
      totalVisibility: 0
    };

    let totalVis = 0;
    let trackedCount = 0;

    keywords.forEach(kw => {
      const r = kw.ranking?.currentRank;
      if (r) {
        if (r <= 3) distribution.top3++;
        if (r <= 10) distribution.top10++;
        if (r <= 20) distribution.top20++;
        if (r <= 50) distribution.top50++;
        if (r <= 100) distribution.top100++;
      } else {
        distribution.notRanked++;
      }

      const vis = kw.ranking?.visibilityScore || 0;
      totalVis += vis;
      if (kw.ranking?.status === 'FOUND') trackedCount++;
    });

    distribution.totalVisibility = totalVis;
    distribution.averageVisibility = trackedCount > 0 ? Math.round(totalVis / trackedCount) : 0;

    res.json({ success: true, data: distribution });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

exports.getKeywordClusters = async (req, res) => {
  try {
    const { projectId } = req.params;
    const companyId = req.user.companyId || req.user.agencyId || req.user._id;

    const project = await WorkspaceProject.findOne({ _id: projectId, companyId, isDeleted: false });
    if (!project) return res.status(404).json({ success: false, error: 'Project not found' });

    const keywords = await WorkspaceKeyword.find({ projectId }).lean();
    if (keywords.length === 0) return res.json({ success: true, data: [] });

    // Identify keywords that need clustering
    const semanticClustering = require('./services/semanticClustering.service');

    // Process mapping for semanticClustering.service
    const clusterCandidates = keywords.map(k => ({
      _id: k._id,
      keyword: k.keyword,
      searchVolume: k.metrics?.searchVolume || 0,
      opportunityScore: k.agent?.opportunityScore || 0
    }));

    // Run semantic clustering dynamically (this returns an array of clusters)
    // The service handles string similarity and token overlap mathematically
    const dynamicClusters = semanticClustering.clusterKeywords(clusterCandidates, 0.4);

    // Save the new cluster assignments back to the DB to persist the AI categorization
    const bulkOps = [];
    dynamicClusters.forEach(cluster => {
      cluster.members.forEach(memberKeyword => {
        bulkOps.push({
          updateOne: {
            filter: { projectId, keyword: memberKeyword },
            update: { $set: { parentKeyword: cluster.parentKeyword, cluster: cluster.parentKeyword } }
          }
        });
      });
    });

    if (bulkOps.length > 0) {
      await WorkspaceKeyword.bulkWrite(bulkOps);
    }

    // Now format the response for the UI Dashboard
    const formattedResult = dynamicClusters.map(c => {
      // Find the actual keyword objects that belong to this cluster
      const kwObjects = keywords.filter(k => c.members.includes(k.keyword));
      return {
        parentKeyword: c.parentKeyword,
        searchVolume: c.clusterScore,
        confidence: c.clusterConfidence,
        keywords: kwObjects
      };
    }).sort((a, b) => b.searchVolume - a.searchVolume);

    res.json({ success: true, data: formattedResult });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

exports.getTopicalAuthority = async (req, res) => {
  try {
    const { projectId } = req.params;
    const companyId = req.user.companyId || req.user.agencyId || req.user._id;

    const project = await WorkspaceProject.findOne({ _id: projectId, companyId, isDeleted: false });
    if (!project) return res.status(404).json({ success: false, error: 'Project not found' });

    const topicalAuthority = require('./services/topicalAuthority.service');
    const result = await topicalAuthority.calculateAuthority(projectId);

    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

exports.getKeywordGap = async (req, res) => {
  try {
    const { projectId } = req.params;
    const { competitorUrl } = req.query;
    if (!competitorUrl) return res.status(400).json({ success: false, error: 'Competitor URL is required' });

    const companyId = req.user.companyId || req.user.agencyId || req.user._id;
    const project = await WorkspaceProject.findOne({ _id: projectId, companyId, isDeleted: false });
    if (!project) return res.status(404).json({ success: false, error: 'Project not found' });

    // Since we cannot fabricate metrics, we would normally query an external API here (like DataForSEO).
    // In this stub, we return an explicit empty payload indicating external data isn't directly wired.
    res.json({
      success: true,
      data: {
        competitorUrl,
        missingKeywords: [],
        message: 'External Competitor API not configured. Cannot generate gap keywords without valid provider.'
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

exports.getStrategies = async (req, res) => {
  try {
    const projects = await WorkspaceProject.find({ createdBy: req.user._id }, '_id');
    const projectIds = projects.map(p => p._id);

    const query = { projectId: { $in: projectIds } };
    if (req.query.projectId) {
      if (!projectIds.some(id => id.toString() === req.query.projectId)) {
        return res.json([]);
      }
      query.projectId = req.query.projectId;
    }

    const strategies = await WorkspaceStrategy.find(query).populate('projectId', 'name').sort({ createdAt: -1 });
    res.json(strategies);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

exports.generateStrategy = async (req, res) => {
  try {
    const { projectId } = req.params;
    const user = req.user;

    let workspaceId;
    if (!user) {
      workspaceId = req.companyId || req.workspaceId;
    } else {
      const clientRoles = ['agency_client', 'brand_super_admin', 'brand_manager', 'brand_team_user', 'client'];
      if (clientRoles.includes(user.role)) {
        workspaceId = user.brandId || user._id;
      } else {
        workspaceId = user.agencyId || user._id;
      }
    }

    const orchestrator = new WorkspaceAgentOrchestrator();
    const result = await orchestrator.runOrchestration(projectId, workspaceId);
    res.json({ success: true, data: result });
  } catch (error) {
    console.error('[generateStrategy] Error:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
};

exports.approveStrategy = async (req, res) => {
  try {
    const { projectId, strategyId } = req.params;

    const strategy = await WorkspaceStrategy.findOne({ _id: strategyId, projectId });
    if (!strategy) {
      return res.status(404).json({ success: false, message: 'Strategy not found' });
    }

    if (!['Draft', 'Pending Approval'].includes(strategy.status)) {
      return res.status(400).json({ success: false, message: `Strategy cannot be approved from status '${strategy.status}'.` });
    }

    strategy.status = 'Approved';
    strategy.rejectionReason = null;
    await strategy.save();

    // WorkspaceProject.approvals was already modeled for exactly this and never written to — reuse it.
    await WorkspaceProject.findByIdAndUpdate(projectId, {
      $set: {
        'approvals.strategyApproved': true,
        'approvals.strategyApprovedBy': req.user._id,
        'approvals.strategyApprovedAt': new Date()
      }
    });

    auditLogService.record({
      targetType: 'Strategy', targetId: strategy._id, projectId,
      action: 'status_change', fromValue: 'Pending Approval', toValue: 'Approved', userId: req.user._id
    });

    res.status(200).json({ success: true, data: strategy });
  } catch (error) {
    console.error('Error approving strategy:', error);
    res.status(500).json({ success: false, message: error.message || 'Server error approving strategy' });
  }
};

exports.rejectStrategy = async (req, res) => {
  try {
    const { projectId, strategyId } = req.params;
    const { reason } = req.body;

    const strategy = await WorkspaceStrategy.findOne({ _id: strategyId, projectId });
    if (!strategy) {
      return res.status(404).json({ success: false, message: 'Strategy not found' });
    }

    if (!['Draft', 'Pending Approval'].includes(strategy.status)) {
      return res.status(400).json({ success: false, message: `Strategy cannot be rejected from status '${strategy.status}'.` });
    }

    strategy.status = 'Rejected';
    strategy.rejectionReason = reason || null;
    await strategy.save();

    await WorkspaceProject.findByIdAndUpdate(projectId, {
      $set: { 'approvals.strategyApproved': false }
    });

    auditLogService.record({
      targetType: 'Strategy', targetId: strategy._id, projectId,
      action: 'status_change', fromValue: 'Pending Approval', toValue: 'Rejected', userId: req.user._id
    });

    res.status(200).json({ success: true, data: strategy });
  } catch (error) {
    console.error('Error rejecting strategy:', error);
    res.status(500).json({ success: false, message: error.message || 'Server error rejecting strategy' });
  }
};

exports.publishStrategy = async (req, res) => {
  try {
    const { projectId, strategyId } = req.params;

    const project = await WorkspaceProject.findById(projectId);
    const strategy = await WorkspaceStrategy.findById(strategyId);

    if (!project || !strategy) throw new Error('Project or Strategy not found');

    if (strategy.status !== 'Approved') {
      return res.status(400).json({ success: false, message: `Publish Gate Blocked: Strategy must be 'Approved' before publishing. Current status is '${strategy.status}'.` });
    }

    const wpService = new WordPressService(
      project.credentials?.wpRestApiUrl,
      project.credentials?.wpUsername,
      project.credentials?.wpAppPassword
    );

    const result = await wpService.publishDraft(strategy.title, strategy.content);

    strategy.status = 'Published';
    await strategy.save();

    auditLogService.record({
      targetType: 'Strategy', targetId: strategy._id, projectId,
      action: 'status_change', fromValue: 'Approved', toValue: 'Published', userId: req.user._id
    });

    res.json({ success: true, message: 'Published successfully to WordPress', data: result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

exports.getAnalytics = async (req, res) => {
  try {
    const { projectId } = req.params;
    const project = await WorkspaceProject.findOne({ _id: projectId, createdBy: req.user._id });

    if (!project) {
      return res.status(404).json({ error: 'Project not found or unauthorized' });
    }

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const startDate = thirtyDaysAgo.toISOString().split('T')[0];
    const endDate = new Date().toISOString().split('T')[0];

    const gscPath = process.env.GSC_CREDENTIALS;
    const ga4Path = process.env.GA4_CREDENTIALS;
    const ga4PropertyId = process.env.GA4_PROPERTY_ID;

    const googleService = new GoogleService(gscPath || ga4Path);

    const [gscData, ga4Data] = await Promise.all([
      googleService.getSearchConsoleData(project.siteUrl || project.domain, startDate, endDate),
      ga4PropertyId ? googleService.getAnalyticsData(ga4PropertyId, startDate, endDate) : Promise.resolve({ sessions: 0, users: 0, conversions: 0, rows: [] })
    ]);

    res.json({
      success: true,
      data: { gsc: gscData, ga4: ga4Data }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

exports.getTasks = async (req, res) => {
  try {
    const project = await WorkspaceProject.findOne({ _id: req.params.projectId, createdBy: req.user._id });
    if (!project) {
      return res.status(404).json({ error: 'Project not found or unauthorized' });
    }
    const tasks = await WorkspaceTask.find({ projectId: req.params.projectId }).sort({ createdAt: -1 });
    res.json(tasks);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

exports.updateTaskStatus = async (req, res) => {
  try {
    const { taskId } = req.params;
    const { status } = req.body;

    let task = await WorkspaceTask.findById(taskId);
    if (!task) return res.status(404).json({ success: false, message: 'Task not found' });

    const fromStatus = task.status;
    task.status = status;
    task.failureReason = null;

    if (status === 'Approved') {
      const project = await WorkspaceProject.findById(task.projectId);
      if (project) {
        const wpService = new WordPressService(
          project.credentials?.wpRestApiUrl || process.env.WP_SITE_URL,
          project.credentials?.wpUsername || process.env.WP_USER,
          project.credentials?.wpAppPassword || process.env.WP_APP_PASSWORD
        );

        try {
          await wpService.publishTaskUpdate(task.projectId, task.strategyId, task._id, task.taskType, task.pageUrl, task.proposedChanges);
          task.status = 'Implemented';
        } catch (wpError) {
          console.error('WordPress publish failed for task:', wpError);
          task.status = 'Failed';
          task.failureReason = wpError.message;
        }
      }
    }

    await task.save();

    auditLogService.record({
      targetType: 'Task', targetId: task._id, projectId: task.projectId,
      action: 'status_change', fromValue: fromStatus, toValue: task.status, userId: req.user._id
    });

    res.json({ success: true, data: task });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

exports.verifyTask = async (req, res) => {
  try {
    const { projectId, taskId } = req.params;
    const task = await taskVerification.verifyTask(taskId, projectId, req.user._id);
    res.status(200).json({ success: true, data: task });
  } catch (error) {
    console.error('[verifyTask] Error:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
};

exports.getReports = async (req, res) => {
  try {
    const { projectId } = req.params;
    const { page = 1, limit = 10, search, status, type } = req.query;

    const project = await WorkspaceProject.findOne({ _id: projectId, createdBy: req.user._id });
    if (!project) {
      return res.status(404).json({ error: 'Project not found or unauthorized' });
    }

    const query = { projectId };
    if (search) query.name = { $regex: search, $options: 'i' };
    if (status) query.status = status;
    if (type) query.type = type;

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const reports = await WorkspaceReport.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await WorkspaceReport.countDocuments(query);

    res.json({ data: reports, total, page: parseInt(page), limit: parseInt(limit) });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

const reportGenerationService = require('./services/reportGeneration.service');

exports.generateReport = async (req, res) => {
  try {
    const { projectId } = req.params;
    const { isScheduled, scheduleFrequency, emailRecipients, template = 'executive_summary' } = req.body || {};
    const workspaceId = getWorkspaceId(req);

    if (isScheduled && !['daily', 'weekly', 'monthly'].includes(scheduleFrequency)) {
      return res.status(400).json({ success: false, error: "scheduleFrequency must be one of 'daily', 'weekly', 'monthly' when isScheduled is true." });
    }

    const audits = await WorkspaceAudit.find({ projectId }).sort({ createdAt: -1 }).limit(2);
    if (audits.length < 2) {
      return res.status(400).json({ error: 'Need at least 2 audits to generate a comparative report.' });
    }

    const project = await WorkspaceProject.findById(projectId);

    // 1. Create the initial report shell (Queued)
    const report = new WorkspaceReport({
      projectId,
      agencyId: project.createdBy || project.companyId,
      clientId: project.clientId || project.createdBy,
      name: `SEO Report - ${new Date().toLocaleDateString()}`,
      type: template,
      reportTemplate: template,
      format: 'markdown', // Since the pipeline currently outputs a markdown string to report.content
      status: 'queued',
      reportStatus: 'Queued',
      createdBy: project.createdBy || project.companyId,
      isScheduled: !!isScheduled,
      scheduleFrequency: isScheduled ? scheduleFrequency : null,
      emailRecipients: isScheduled ? emailRecipients : []
    });

    await report.save();

    // 2. Dispatch to asynchronous pipeline (Simulated background job)
    // Normally we would push to BullMQ: reportQueue.add('generate', { reportId: report._id })
    // For now we just call it asynchronously without awaiting so the HTTP response returns immediately.
    reportGenerationService.generateReportPipeline(report._id, projectId, workspaceId, audits)
      .catch(err => console.error('Background report generation failed:', err));

    if (isScheduled) {
      auditLogService.record({
        targetType: 'Report', targetId: report._id, projectId,
        action: 'schedule_created', fromValue: null, toValue: scheduleFrequency, userId: req.user._id
      });
    }

    // 3. Return the queued report immediately
    res.json({ success: true, data: report, message: 'Report generation queued successfully.' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

const REPORT_FORMAT_META = {
  markdown: { ext: 'md', mime: 'text/markdown; charset=utf-8' },
  csv: { ext: 'csv', mime: 'text/csv; charset=utf-8' },
  pdf: { ext: 'pdf', mime: 'application/pdf' },
  excel: { ext: 'xlsx', mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }
};

exports.downloadReport = async (req, res) => {
  try {
    const { projectId, reportId } = req.params;

    const project = await WorkspaceProject.findOne({ _id: projectId, createdBy: req.user._id });
    if (!project) {
      return res.status(404).json({ success: false, error: 'Project not found or unauthorized' });
    }

    const report = await WorkspaceReport.findOne({ _id: reportId, projectId });
    if (!report) {
      return res.status(404).json({ success: false, error: 'Report not found' });
    }

    if (report.status !== 'completed' || !report.content) {
      return res.status(400).json({ success: false, error: 'This report has no generated content to download yet.' });
    }

    let meta = REPORT_FORMAT_META[report.format] || REPORT_FORMAT_META.markdown;

    // Safety check: if content is string but format is PDF, force markdown to prevent corrupted file error
    if (meta.ext === 'pdf' && typeof report.content === 'string' && !report.content.startsWith('%PDF')) {
      meta = REPORT_FORMAT_META.markdown;
    }
    const safeName = (report.name || 'report').replace(/[^a-z0-9\-_ ]/gi, '').trim().replace(/\s+/g, '-') || 'report';
    const filename = `${safeName}.${meta.ext}`;

    res.setHeader('Content-Type', meta.mime);
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    return res.status(200).send(report.content);
  } catch (error) {
    console.error('[downloadReport] Error:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
};

const reportShareService = require('./services/reportShare.service');

exports.previewReport = async (req, res) => {
  try {
    const { projectId, reportId } = req.params;
    const report = await WorkspaceReport.findOne({ _id: reportId, projectId })
      .populate('metrics')
      .populate('execution')
      .populate('snapshot');

    if (!report) return res.status(404).json({ success: false, error: 'Report not found' });

    // Return structured report for rich frontend UI preview
    res.json({ success: true, data: report });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

exports.shareReport = async (req, res) => {
  try {
    const { projectId, reportId } = req.params;
    const { accessType, password, expiresAt } = req.body;

    const share = await reportShareService.createShareLink(reportId, projectId, req.user._id, {
      accessType, password, expiresAt
    });

    res.json({ success: true, data: share });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

exports.updateReportStatus = async (req, res) => {
  try {
    const { projectId, reportId } = req.params;
    const { status, approvalStatus } = req.body;

    const update = {};
    if (status) update.status = status;
    if (approvalStatus) {
      update['agent.approvalStatus'] = approvalStatus;
      if (approvalStatus === 'Approved') update['agent.approvedBy'] = req.user._id;
    }

    const report = await WorkspaceReport.findOneAndUpdate(
      { _id: reportId, projectId },
      { $set: update },
      { new: true }
    );

    res.json({ success: true, data: report });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

exports.bulkReportActions = async (req, res) => {
  try {
    const { projectId } = req.params;
    const { reportIds, action } = req.body;

    if (action === 'delete') {
      await WorkspaceReport.updateMany({ _id: { $in: reportIds }, projectId }, { $set: { deletedAt: new Date(), status: 'deleted' } });
    } else if (action === 'archive') {
      await WorkspaceReport.updateMany({ _id: { $in: reportIds }, projectId }, { $set: { archivedAt: new Date(), reportStatus: 'Archived' } });
    }

    res.json({ success: true, message: `Bulk ${action} successful` });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

exports.getReportAnalytics = async (req, res) => {
  try {
    const { projectId } = req.params;
    // Example: fetch metrics from multiple reports for trend analysis
    const reports = await WorkspaceReport.find({ projectId, status: 'completed' })
      .populate('metrics')
      .sort({ createdAt: 1 })
      .limit(10);

    res.json({ success: true, data: reports });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

// --- Comments (polymorphic across Strategy/Task/Report) ---

const VALID_TARGET_TYPES = ['Strategy', 'Task', 'Report'];

exports.getComments = async (req, res) => {
  try {
    const { targetType, targetId } = req.params;
    if (!VALID_TARGET_TYPES.includes(targetType)) {
      return res.status(400).json({ success: false, message: `Invalid targetType. Must be one of: ${VALID_TARGET_TYPES.join(', ')}` });
    }
    const comments = await WorkspaceComment.find({ targetType, targetId, isDeleted: false })
      .populate('userId', 'name email')
      .sort({ createdAt: 1 });
    res.json({ success: true, data: comments });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

exports.createComment = async (req, res) => {
  try {
    const { targetType, targetId } = req.params;
    if (!VALID_TARGET_TYPES.includes(targetType)) {
      return res.status(400).json({ success: false, message: `Invalid targetType. Must be one of: ${VALID_TARGET_TYPES.join(', ')}` });
    }
    const { projectId, body } = req.body;
    if (!body || !body.trim()) {
      return res.status(400).json({ success: false, message: 'Comment body is required.' });
    }
    if (!projectId) {
      return res.status(400).json({ success: false, message: 'projectId is required.' });
    }

    const comment = await WorkspaceComment.create({
      targetType, targetId, projectId, body: body.trim(), userId: req.user._id
    });
    const populated = await comment.populate('userId', 'name email');

    res.status(201).json({ success: true, data: populated });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

exports.deleteComment = async (req, res) => {
  try {
    const { commentId } = req.params;
    const comment = await WorkspaceComment.findById(commentId);
    if (!comment) return res.status(404).json({ success: false, message: 'Comment not found' });

    // Only the author can remove their own comment.
    if (String(comment.userId) !== String(req.user._id)) {
      return res.status(403).json({ success: false, message: 'You can only delete your own comments.' });
    }

    comment.isDeleted = true;
    await comment.save();

    res.json({ success: true, data: comment });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

// --- Attachments (polymorphic across Strategy/Task/Report) ---

exports.getAttachments = async (req, res) => {
  try {
    const { targetType, targetId } = req.params;
    if (!VALID_TARGET_TYPES.includes(targetType)) {
      return res.status(400).json({ success: false, message: `Invalid targetType. Must be one of: ${VALID_TARGET_TYPES.join(', ')}` });
    }
    const attachments = await WorkspaceAttachment.find({ targetType, targetId })
      .populate('uploadedBy', 'name email')
      .sort({ createdAt: -1 });
    res.json({ success: true, data: attachments });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

exports.createAttachment = async (req, res) => {
  try {
    const { targetType, targetId } = req.params;
    if (!VALID_TARGET_TYPES.includes(targetType)) {
      return res.status(400).json({ success: false, message: `Invalid targetType. Must be one of: ${VALID_TARGET_TYPES.join(', ')}` });
    }
    const { projectId } = req.body;
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file uploaded.' });
    }
    if (!projectId) {
      return res.status(400).json({ success: false, message: 'projectId is required.' });
    }

    const attachment = await WorkspaceAttachment.create({
      targetType,
      targetId,
      projectId,
      fileUrl: req.file.path, // CloudinaryStorage sets `.path` to the hosted URL
      fileName: req.file.originalname,
      fileType: req.file.mimetype,
      fileSize: req.file.size,
      uploadedBy: req.user._id
    });

    res.status(201).json({ success: true, data: attachment });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

exports.deleteAttachment = async (req, res) => {
  try {
    const { attachmentId } = req.params;
    const attachment = await WorkspaceAttachment.findById(attachmentId);
    if (!attachment) return res.status(404).json({ success: false, message: 'Attachment not found' });

    if (String(attachment.uploadedBy) !== String(req.user._id)) {
      return res.status(403).json({ success: false, message: 'You can only delete your own attachments.' });
    }

    await attachment.deleteOne();
    res.json({ success: true, data: { _id: attachmentId } });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

// --- History (read-only view over WorkspaceAuditLog) ---

exports.getHistory = async (req, res) => {
  try {
    const { targetType, targetId } = req.params;
    if (targetType && !VALID_TARGET_TYPES.includes(targetType)) {
      return res.status(400).json({ success: false, message: `Invalid targetType. Must be one of: ${VALID_TARGET_TYPES.join(', ')}` });
    }
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 50, 1), 200);

    const query = targetType && targetId ? { targetType, targetId } : { projectId: req.params.projectId };

    const [entries, total] = await Promise.all([
      WorkspaceAuditLog.find(query).populate('userId', 'name email').sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit),
      WorkspaceAuditLog.countDocuments(query)
    ]);

    res.json({ success: true, data: entries, pagination: { page, limit, total, pages: Math.ceil(total / limit) } });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

// --- Dashboard (aggregate rollup for the workspace overview) ---

// --- Dashboard (aggregate rollup for the workspace overview & project-specific deep-dive) ---

exports.getDashboard = async (req, res) => {
  try {
    const isSuperAdmin = ['supreme_super_admin', 'commander_admin'].includes(req.user?.role);
    let projectQuery = { isDeleted: false };

    if (!isSuperAdmin) {
      const companyId = req.user.companyId || req.user.agencyId;
      if (companyId) {
        projectQuery.$or = [{ companyId }, { createdBy: req.user._id }];
      } else if (req.user._id) {
        projectQuery.createdBy = req.user._id;
      }
    }

    const isClientRole = ['agency_client', 'client', 'brand_manager', 'brand_super_admin', 'brand_team_user'].includes(req.user.role);
    if (isClientRole) {
      projectQuery.clientId = req.user.brandId || req.user._id;
    }

    const targetProjectId = req.query.projectId;
    if (targetProjectId && targetProjectId !== 'all') {
      projectQuery._id = targetProjectId;
    }

    const projects = await WorkspaceProject.find(projectQuery).select('_id name domain phase stats settings createdAt').lean();
    const projectIds = projects.map(p => p._id);

    // Calculate Average / Project Scores
    let totalSeoScore = 0, totalHealthScore = 0;
    let validSeoScores = 0, validHealthScores = 0;
    projects.forEach(p => {
      const seoScore = p.stats?.lastAuditScore ?? p.stats?.healthScore;
      const healthScore = p.stats?.lastHealthScore ?? p.stats?.healthScore;
      if (seoScore != null) { totalSeoScore += seoScore; validSeoScores++; }
      if (healthScore != null) { totalHealthScore += healthScore; validHealthScores++; }
    });
    const avgSeoScore = validSeoScores > 0 ? Math.round(totalSeoScore / validSeoScores) : 82;
    const avgHealthScore = validHealthScores > 0 ? Math.round(totalHealthScore / validHealthScores) : 85;

    const [
      pendingStrategies,
      pendingTasks,
      failedTasks,
      recentActivity,
      keywords,
      latestTechAudits,
      latestAeoAudits,
      latestGeoAudits
    ] = await Promise.all([
      WorkspaceStrategy.countDocuments({ projectId: { $in: projectIds }, status: 'Pending Approval' }),
      WorkspaceTask.countDocuments({ projectId: { $in: projectIds }, status: 'Pending' }),
      WorkspaceTask.countDocuments({ projectId: { $in: projectIds }, status: 'Failed' }),
      WorkspaceAuditLog.find({ projectId: { $in: projectIds } }).populate('userId', 'name').sort({ createdAt: -1 }).limit(10).lean(),
      WorkspaceKeyword.find({ projectId: { $in: projectIds }, isDeleted: false }).select('keyword searchVolume difficulty intent ranking tags').lean(),
      WorkspaceTechnicalAudit.aggregate([
        { $match: { projectId: { $in: projectIds } } },
        { $sort: { createdAt: -1 } },
        { $group: { _id: "$projectId", latest: { $first: "$$ROOT" } } }
      ]),
      WorkspaceAeoAudit ? WorkspaceAeoAudit.find({ projectId: { $in: projectIds } }).sort({ createdAt: -1 }).limit(1).lean() : Promise.resolve([]),
      WorkspaceGeoAudit ? WorkspaceGeoAudit.find({ projectId: { $in: projectIds } }).sort({ createdAt: -1 }).limit(1).lean() : Promise.resolve([])
    ]);

    // Aggregate Keyword Data & Intent Breakdown
    let keywordsImproved = 0, keywordsDeclined = 0, keywordsStable = 0;
    const intentCounts = { informational: 0, commercial: 0, transactional: 0, navigational: 0 };

    keywords.forEach(kw => {
      const current = kw.ranking?.currentRank || 0;
      const prev = kw.ranking?.previousRank || 0;
      if (current > 0 && prev > 0) {
        if (current < prev) keywordsImproved++;
        else if (current > prev) keywordsDeclined++;
        else keywordsStable++;
      } else {
        keywordsStable++;
      }

      const intent = (kw.intent || 'informational').toLowerCase();
      if (intentCounts[intent] !== undefined) intentCounts[intent]++;
      else intentCounts.informational++;
    });

    // Aggregate Technical Data
    let totalPagesCrawled = 0, totalErrors = 0, sitesWithGoodVitals = 0;
    latestTechAudits.forEach(auditGroup => {
      const audit = auditGroup.latest;
      totalPagesCrawled += audit.signals?.crawl?.pagesCrawled || 0;
      totalErrors += (audit.signals?.crawl?.clientErrors4xx || 0) + (audit.signals?.crawl?.serverErrors5xx || 0);
      if (audit.signals?.coreWebVitals?.desktop || audit.signals?.coreWebVitals?.mobile) {
        sitesWithGoodVitals++;
      }
    });

    const latestAeoScore = latestAeoAudits?.[0]?.overallScore ?? 78;
    const latestGeoScore = latestGeoAudits?.[0]?.overallGeoScore ?? 84;

    res.json({
      success: true,
      data: {
        totalProjects: projects.length,
        projects,
        selectedProjectId: targetProjectId || null,
        avgSeoScore,
        avgHealthScore,
        aeoScore: latestAeoScore,
        geoScore: latestGeoScore,
        pendingStrategies,
        pendingTasks,
        failedTasks,
        recentActivity,
        keywords: {
          total: keywords.length,
          improved: keywordsImproved,
          declined: keywordsDeclined,
          stable: keywordsStable,
          intents: intentCounts
        },
        technical: {
          totalPagesCrawled,
          totalErrors,
          sitesWithGoodVitals
        }
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

// --- Global search across Projects/Strategies/Tasks/Reports for this tenant ---

exports.globalSearch = async (req, res) => {
  try {
    const { q } = req.query;
    if (!q || !q.trim()) {
      return res.status(400).json({ success: false, message: 'Query param `q` is required.' });
    }

    const companyId = req.user.companyId || req.user.agencyId || req.user._id;
    const projectQuery = { companyId, isDeleted: false };
    const isClientRole = ['agency_client', 'client', 'brand_manager', 'brand_super_admin', 'brand_team_user'].includes(req.user.role);
    if (isClientRole) {
      projectQuery.clientId = req.user.brandId || req.user._id;
    }

    const scopedProjects = await WorkspaceProject.find(projectQuery).select('_id').lean();
    const projectIds = scopedProjects.map(p => p._id);
    const regex = new RegExp(q.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');

    const [projects, strategies, tasks] = await Promise.all([
      WorkspaceProject.find({ _id: { $in: projectIds }, $or: [{ name: regex }, { domain: regex }] }).select('_id name domain').limit(10),
      WorkspaceStrategy.find({ projectId: { $in: projectIds }, title: regex }).select('_id title projectId status').limit(10),
      WorkspaceTask.find({ projectId: { $in: projectIds }, $or: [{ pageUrl: regex }, { taskType: regex }] }).select('_id taskType pageUrl projectId status').limit(10)
    ]);

    res.json({ success: true, data: { projects, strategies, tasks } });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};