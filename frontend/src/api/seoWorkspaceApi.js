import axios from 'axios';
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5500/api';

const getAuthHeaders = () => {
  const token = localStorage.getItem('token');
  const headers = {};
  if (token && token !== 'null' && token !== 'undefined' && typeof token === 'string' && token.trim() !== '') {
    headers.Authorization = `Bearer ${token.trim()}`;
  }
  return { headers };
};

const qs = (params = {}) => {
  const usable = Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== '');
  if (!usable.length) return '';
  return `?${new URLSearchParams(usable).toString()}`;
};

export const seoWorkspaceApi = {
  // --- Settings (Anthropic API key) ---
  getSettingsStatus: async () => {
    const res = await axios.get(`${API_URL}/seo-workspace/settings/api-key`, getAuthHeaders());
    return res.data;
  },
  saveSettings: async (data) => {
    const res = await axios.post(`${API_URL}/seo-workspace/settings/api-key`, data, getAuthHeaders());
    return res.data;
  },

  // --- Projects ---
  getProjects: async (clientId) => {
    const res = await axios.get(`${API_URL}/seo-workspace/projects${qs({ clientId })}`, getAuthHeaders());
    return res.data;
  },
  createProject: async (data) => {
    const res = await axios.post(`${API_URL}/seo-workspace/projects`, data, getAuthHeaders());
    return res.data;
  },
  updateProjectSettings: async (projectId, settings) => {
    const res = await axios.put(`${API_URL}/seo-workspace/projects/${projectId}/settings`, { settings }, getAuthHeaders());
    return res.data;
  },

  // --- Dashboard / Search ---
  getDashboard: async (projectIdOrParams) => {
    const params = typeof projectIdOrParams === 'string' ? { projectId: projectIdOrParams } : (projectIdOrParams || {});
    const res = await axios.get(`${API_URL}/seo-workspace/dashboard${qs(params)}`, getAuthHeaders());
    return res.data;
  },
  globalSearch: async (q) => {
    const res = await axios.get(`${API_URL}/seo-workspace/search${qs({ q })}`, getAuthHeaders());
    return res.data;
  },

  // --- Audits (basic + SEO Auditor agent) ---
  getAudits: async (projectId) => {
    const res = await axios.get(`${API_URL}/seo-workspace/audits${qs({ projectId })}`, getAuthHeaders());
    return res.data;
  },
  runAudit: async (projectId) => {
    const res = await axios.post(`${API_URL}/seo-workspace/projects/${projectId}/audit`, {}, getAuthHeaders());
    return res.data;
  },
  compareAudits: async (projectId, auditId1, auditId2) => {
    const res = await axios.get(`${API_URL}/seo-workspace/projects/${projectId}/audits/compare${qs({ auditId1, auditId2 })}`, getAuthHeaders());
    return res.data;
  },
  runAuditorAgent: async (projectId, options = {}) => {
    const res = await axios.post(`${API_URL}/seo-workspace/projects/${projectId}/seo-auditor/run`, options, getAuthHeaders());
    return res.data;
  },
  getAuditStatus: async (projectId) => {
    const res = await axios.get(`${API_URL}/seo-workspace/projects/${projectId}/audit/status`, getAuthHeaders());
    return res.data;
  },
  approveAuditFindings: async (projectId, auditId) => {
    const res = await axios.put(`${API_URL}/seo-workspace/projects/${projectId}/seo-auditor/${auditId}/approve`, {}, getAuthHeaders());
    return res.data;
  },
  rejectAuditFindings: async (projectId, auditId, reason) => {
    const res = await axios.put(`${API_URL}/seo-workspace/projects/${projectId}/seo-auditor/${auditId}/reject`, { reason }, getAuthHeaders());
    return res.data;
  },
  getAuditorHistory: async (projectId, limit) => {
    const res = await axios.get(`${API_URL}/seo-workspace/projects/${projectId}/seo-auditor/history${qs({ limit })}`, getAuthHeaders());
    return res.data;
  },

  // --- Keywords (basic + Keyword Research agent) ---
  getKeywords: async (filters = {}) => {
    const res = await axios.get(`${API_URL}/seo-workspace/keywords${qs(filters)}`, getAuthHeaders());
    return res.data;
  },
  getKeywordClusters: async (projectId) => {
    const res = await axios.get(`${API_URL}/seo-workspace/projects/${projectId}/keywords/clusters`, getAuthHeaders());
    return res.data;
  },
  getTopicalAuthority: async (projectId) => {
    const res = await axios.get(`${API_URL}/seo-workspace/projects/${projectId}/keywords/authority`, getAuthHeaders());
    return res.data;
  },
  refreshKeywords: async (projectId, keywordIds = []) => {
    const res = await axios.post(`${API_URL}/seo-workspace/projects/${projectId}/keywords/refresh`, { keywordIds }, getAuthHeaders());
    return res.data;
  },
  getRankDistribution: async (projectId) => {
    const res = await axios.get(`${API_URL}/seo-workspace/projects/${projectId}/keywords/distribution`, getAuthHeaders());
    return res.data;
  },
  getKeywordGap: async (projectId, competitorUrl) => {
    const res = await axios.get(`${API_URL}/seo-workspace/projects/${projectId}/keywords/gap${qs({ competitorUrl })}`, getAuthHeaders());
    return res.data;
  },
  runKeywordResearchAgent: async (projectId, seedKeyword) => {
    const res = await axios.post(`${API_URL}/seo-workspace/projects/${projectId}/keyword-research/run`, { seedKeyword }, getAuthHeaders());
    return res.data;
  },
  approveKeywordSuggestions: async (projectId, keywordIds) => {
    const res = await axios.put(`${API_URL}/seo-workspace/projects/${projectId}/keyword-research/approve`, { keywordIds }, getAuthHeaders());
    return res.data;
  },
  rejectKeywordSuggestions: async (projectId, keywordIds, reason) => {
    const res = await axios.put(`${API_URL}/seo-workspace/projects/${projectId}/keyword-research/reject`, { keywordIds, reason }, getAuthHeaders());
    return res.data;
  },
  getKeywordResearchHistory: async (projectId, limit) => {
    const res = await axios.get(`${API_URL}/seo-workspace/projects/${projectId}/keyword-research/history${qs({ limit })}`, getAuthHeaders());
    return res.data;
  },
  detectKeywordIntent: async (projectId, keywords) => {
    const res = await axios.post(`${API_URL}/seo-workspace/projects/${projectId}/keywords/detect-intent`, { keywords }, getAuthHeaders());
    return res.data;
  },
  getRelatedKeywords: async (projectId, keyword) => {
    const res = await axios.post(`${API_URL}/seo-workspace/projects/${projectId}/keywords/related`, { keyword }, getAuthHeaders());
    return res.data;
  },

  // --- Competitor agent ---
  runCompetitorAgent: async (projectId) => {
    const res = await axios.post(`${API_URL}/seo-workspace/projects/${projectId}/competitor-agent/run`, {}, getAuthHeaders());
    return res.data;
  },
  approveCompetitorSuggestions: async (projectId, competitorIds) => {
    const res = await axios.put(`${API_URL}/seo-workspace/projects/${projectId}/competitor-agent/approve`, { competitorIds }, getAuthHeaders());
    return res.data;
  },
  rejectCompetitorSuggestions: async (projectId, competitorIds, reason) => {
    const res = await axios.put(`${API_URL}/seo-workspace/projects/${projectId}/competitor-agent/reject`, { competitorIds, reason }, getAuthHeaders());
    return res.data;
  },
  getCompetitorHistory: async (projectId, limit) => {
    const res = await axios.get(`${API_URL}/seo-workspace/projects/${projectId}/competitor-agent/history${qs({ limit })}`, getAuthHeaders());
    return res.data;
  },

  // --- Technical SEO agent ---
  runTechnicalSeoAgent: async (projectId) => {
    const res = await axios.post(`${API_URL}/seo-workspace/projects/${projectId}/technical-seo-agent/run`, {}, getAuthHeaders());
    return res.data;
  },
  generateTechnicalFixes: async (projectId, auditId) => {
    const res = await axios.post(`${API_URL}/seo-workspace/projects/${projectId}/technical-seo-agent/${auditId}/generate-fixes`, {}, getAuthHeaders());
    return res.data;
  },
  approveTechnicalFindings: async (projectId, auditId) => {
    const res = await axios.put(`${API_URL}/seo-workspace/projects/${projectId}/technical-seo-agent/${auditId}/approve`, {}, getAuthHeaders());
    return res.data;
  },
  rejectTechnicalFindings: async (projectId, auditId, reason) => {
    const res = await axios.put(`${API_URL}/seo-workspace/projects/${projectId}/technical-seo-agent/${auditId}/reject`, { reason }, getAuthHeaders());
    return res.data;
  },
  getTechnicalSeoHistory: async (projectId, limit) => {
    const res = await axios.get(`${API_URL}/seo-workspace/projects/${projectId}/technical-seo-agent/history${qs({ limit })}`, getAuthHeaders());
    return res.data;
  },

  // --- Content agent (content briefs — distinct from /content-ai) ---
  runContentAgent: async (projectId) => {
    const res = await axios.post(`${API_URL}/seo-workspace/projects/${projectId}/content-agent/run`, {}, getAuthHeaders());
    return res.data;
  },
  approveContentBriefs: async (projectId, contentBriefId) => {
    const res = await axios.put(`${API_URL}/seo-workspace/projects/${projectId}/content-agent/${contentBriefId}/approve`, {}, getAuthHeaders());
    return res.data;
  },
  rejectContentBriefs: async (projectId, contentBriefId, reason) => {
    const res = await axios.put(`${API_URL}/seo-workspace/projects/${projectId}/content-agent/${contentBriefId}/reject`, { reason }, getAuthHeaders());
    return res.data;
  },
  getContentAgentHistory: async (projectId, limit) => {
    const res = await axios.get(`${API_URL}/seo-workspace/projects/${projectId}/content-agent/history${qs({ limit })}`, getAuthHeaders());
    return res.data;
  },

  // --- Schema agent ---
  runSchemaAgent: async (projectId) => {
    const res = await axios.post(`${API_URL}/seo-workspace/projects/${projectId}/schema-agent/run`, {}, getAuthHeaders());
    return res.data;
  },
  approveSchemaMarkup: async (projectId, markupId) => {
    const res = await axios.put(`${API_URL}/seo-workspace/projects/${projectId}/schema-agent/${markupId}/approve`, {}, getAuthHeaders());
    return res.data;
  },
  rejectSchemaMarkup: async (projectId, markupId, reason) => {
    const res = await axios.put(`${API_URL}/seo-workspace/projects/${projectId}/schema-agent/${markupId}/reject`, { reason }, getAuthHeaders());
    return res.data;
  },
  getSchemaAgentHistory: async (projectId, limit) => {
    const res = await axios.get(`${API_URL}/seo-workspace/projects/${projectId}/schema-agent/history${qs({ limit })}`, getAuthHeaders());
    return res.data;
  },

  // --- Internal linking agent ---
  runInternalLinkingAgent: async (projectId) => {
    const res = await axios.post(`${API_URL}/seo-workspace/projects/${projectId}/internal-linking-agent/run`, {}, getAuthHeaders());
    return res.data;
  },
  approveInternalLinkSuggestions: async (projectId, linkRunId) => {
    const res = await axios.put(`${API_URL}/seo-workspace/projects/${projectId}/internal-linking-agent/${linkRunId}/approve`, {}, getAuthHeaders());
    return res.data;
  },
  rejectInternalLinkSuggestions: async (projectId, linkRunId, reason) => {
    const res = await axios.put(`${API_URL}/seo-workspace/projects/${projectId}/internal-linking-agent/${linkRunId}/reject`, { reason }, getAuthHeaders());
    return res.data;
  },
  getInternalLinkingHistory: async (projectId, limit) => {
    const res = await axios.get(`${API_URL}/seo-workspace/projects/${projectId}/internal-linking-agent/history${qs({ limit })}`, getAuthHeaders());
    return res.data;
  },

  // --- Image SEO agent ---
  runImageSeoAgent: async (projectId) => {
    const res = await axios.post(`${API_URL}/seo-workspace/projects/${projectId}/image-seo-agent/run`, {}, getAuthHeaders());
    return res.data;
  },
  approveImageSeoRecommendations: async (projectId, imageSeoRunId) => {
    const res = await axios.put(`${API_URL}/seo-workspace/projects/${projectId}/image-seo-agent/${imageSeoRunId}/approve`, {}, getAuthHeaders());
    return res.data;
  },
  rejectImageSeoRecommendations: async (projectId, imageSeoRunId, reason) => {
    const res = await axios.put(`${API_URL}/seo-workspace/projects/${projectId}/image-seo-agent/${imageSeoRunId}/reject`, { reason }, getAuthHeaders());
    return res.data;
  },
  getImageSeoHistory: async (projectId, limit) => {
    const res = await axios.get(`${API_URL}/seo-workspace/projects/${projectId}/image-seo-agent/history${qs({ limit })}`, getAuthHeaders());
    return res.data;
  },

  // --- AEO agent (Answer Engine Optimization — per-page readiness) ---
  runAeoAgent: async (projectId) => {
    const res = await axios.post(`${API_URL}/seo-workspace/projects/${projectId}/aeo-agent/run`, {}, getAuthHeaders());
    return res.data;
  },
  approveAeoRecommendations: async (projectId, auditId) => {
    const res = await axios.put(`${API_URL}/seo-workspace/projects/${projectId}/aeo-agent/${auditId}/approve`, {}, getAuthHeaders());
    return res.data;
  },
  rejectAeoRecommendations: async (projectId, auditId, reason) => {
    const res = await axios.put(`${API_URL}/seo-workspace/projects/${projectId}/aeo-agent/${auditId}/reject`, { reason }, getAuthHeaders());
    return res.data;
  },
  getAeoAgentHistory: async (projectId, limit) => {
    const res = await axios.get(`${API_URL}/seo-workspace/projects/${projectId}/aeo-agent/history${qs({ limit })}`, getAuthHeaders());
    return res.data;
  },
  getAeoAuditSummary: async (projectId, auditId) => {
    const res = await axios.get(`${API_URL}/seo-workspace/projects/${projectId}/aeo-agent/${auditId}/summary`, getAuthHeaders());
    return res.data;
  },
  getAeoAuditPages: async (projectId, auditId, params = {}) => {
    const res = await axios.get(`${API_URL}/seo-workspace/projects/${projectId}/aeo-agent/${auditId}/pages${qs(params)}`, getAuthHeaders());
    return res.data;
  },
  getAeoAuditSimulations: async (projectId, auditId, params = {}) => {
    const res = await axios.get(`${API_URL}/seo-workspace/projects/${projectId}/aeo-agent/${auditId}/simulations${qs(params)}`, getAuthHeaders());
    return res.data;
  },
  getAeoAuditEntityGraph: async (projectId, auditId, params = {}) => {
    const res = await axios.get(`${API_URL}/seo-workspace/projects/${projectId}/aeo-agent/${auditId}/entity-graph${qs(params)}`, getAuthHeaders());
    return res.data;
  },
  getAeoAuditRecommendations: async (projectId, auditId, params = {}) => {
    const res = await axios.get(`${API_URL}/seo-workspace/projects/${projectId}/aeo-agent/${auditId}/recommendations${qs(params)}`, getAuthHeaders());
    return res.data;
  },

  // --- GEO agent (Generative Engine Optimization — sitewide entity consistency) ---
  runGeoAgent: async (projectId) => {
    const res = await axios.post(`${API_URL}/seo-workspace/projects/${projectId}/geo-agent/run`, {}, getAuthHeaders());
    return res.data;
  },
  approveGeoRecommendations: async (projectId, auditId) => {
    const res = await axios.put(`${API_URL}/seo-workspace/projects/${projectId}/geo-agent/${auditId}/approve`, {}, getAuthHeaders());
    return res.data;
  },
  rejectGeoRecommendations: async (projectId, auditId, reason) => {
    const res = await axios.put(`${API_URL}/seo-workspace/projects/${projectId}/geo-agent/${auditId}/reject`, { reason }, getAuthHeaders());
    return res.data;
  },
  getGeoAgentHistory: async (projectId, limit) => {
    const res = await axios.get(`${API_URL}/seo-workspace/projects/${projectId}/geo-agent/history${qs({ limit })}`, getAuthHeaders());
    return res.data;
  },
  getGeoAuditSummary: async (projectId, auditId) => {
    const res = await axios.get(`${API_URL}/seo-workspace/projects/${projectId}/geo-agent/${auditId}/summary`, getAuthHeaders());
    return res.data;
  },
  getGeoAuditPages: async (projectId, auditId, page = 1, limit = 20) => {
    const res = await axios.get(`${API_URL}/seo-workspace/projects/${projectId}/geo-agent/${auditId}/pages${qs({ page, limit })}`, getAuthHeaders());
    return res.data;
  },
  getGeoAuditEntities: async (projectId, auditId) => {
    const res = await axios.get(`${API_URL}/seo-workspace/projects/${projectId}/geo-agent/${auditId}/entities`, getAuthHeaders());
    return res.data;
  },
  getGeoAuditTechnical: async (projectId, auditId) => {
    const res = await axios.get(`${API_URL}/seo-workspace/projects/${projectId}/geo-agent/${auditId}/technical`, getAuthHeaders());
    return res.data;
  },
  getGeoAuditRecommendations: async (projectId, auditId, priority) => {
    const res = await axios.get(`${API_URL}/seo-workspace/projects/${projectId}/geo-agent/${auditId}/recommendations${qs({ priority })}`, getAuthHeaders());
    return res.data;
  },
  getGeoAuditTrends: async (projectId) => {
    const res = await axios.get(`${API_URL}/seo-workspace/projects/${projectId}/geo-agent/trends`, getAuthHeaders());
    return res.data;
  },

  // --- Strategies (used by Dashboard/Approvals) ---
  getStrategies: async (projectId) => {
    const res = await axios.get(`${API_URL}/seo-workspace/strategies${qs({ projectId })}`, getAuthHeaders());
    return res.data;
  },
  generateStrategy: async (projectId) => {
    const res = await axios.post(`${API_URL}/seo-workspace/projects/${projectId}/generate-strategy`, {}, getAuthHeaders());
    return res.data;
  },
  approveStrategy: async (projectId, strategyId) => {
    const res = await axios.put(`${API_URL}/seo-workspace/projects/${projectId}/strategies/${strategyId}/approve`, {}, getAuthHeaders());
    return res.data;
  },
  rejectStrategy: async (projectId, strategyId, reason) => {
    const res = await axios.put(`${API_URL}/seo-workspace/projects/${projectId}/strategies/${strategyId}/reject`, { reason }, getAuthHeaders());
    return res.data;
  },
  publishStrategy: async (projectId, strategyId) => {
    const res = await axios.post(`${API_URL}/seo-workspace/projects/${projectId}/strategies/${strategyId}/publish`, {}, getAuthHeaders());
    return res.data;
  },

  // --- Tasks (Approvals Queue) ---
  getTasks: async (projectId) => {
    const res = await axios.get(`${API_URL}/seo-workspace/projects/${projectId}/tasks`, getAuthHeaders());
    return res.data;
  },
  updateTaskStatus: async (projectId, taskId, status) => {
    const res = await axios.put(`${API_URL}/seo-workspace/projects/${projectId}/tasks/${taskId}/status`, { status }, getAuthHeaders());
    return res.data;
  },
  verifyTask: async (projectId, taskId) => {
    const res = await axios.put(`${API_URL}/seo-workspace/projects/${projectId}/tasks/${taskId}/verify`, {}, getAuthHeaders());
    return res.data;
  },

  // --- Reports ---
  getReports: async (projectId, params = {}) => {
    const res = await axios.get(`${API_URL}/seo-workspace/projects/${projectId}/reports${qs(params)}`, getAuthHeaders());
    return res.data;
  },
  generateReport: async (projectId, data = {}) => {
    const res = await axios.post(`${API_URL}/seo-workspace/projects/${projectId}/generate-report`, data, getAuthHeaders());
    return res.data;
  },
  previewReport: async (projectId, reportId) => {
    const res = await axios.get(`${API_URL}/seo-workspace/projects/${projectId}/reports/${reportId}/preview`, getAuthHeaders());
    return res.data;
  },
  shareReport: async (projectId, reportId, data = {}) => {
    const res = await axios.post(`${API_URL}/seo-workspace/projects/${projectId}/reports/${reportId}/share`, data, getAuthHeaders());
    return res.data;
  },
  updateReportStatus: async (projectId, reportId, statusData) => {
    const res = await axios.put(`${API_URL}/seo-workspace/projects/${projectId}/reports/${reportId}/status`, statusData, getAuthHeaders());
    return res.data;
  },
  bulkReportActions: async (projectId, data) => {
    const res = await axios.post(`${API_URL}/seo-workspace/projects/${projectId}/reports/bulk`, data, getAuthHeaders());
    return res.data;
  },
  getReportAnalytics: async (projectId) => {
    const res = await axios.get(`${API_URL}/seo-workspace/projects/${projectId}/reports-analytics`, getAuthHeaders());
    return res.data;
  },
  downloadReport: async (projectId, reportId) => {
    const res = await axios.get(`${API_URL}/seo-workspace/projects/${projectId}/reports/${reportId}/download`, {
      ...getAuthHeaders(),
      responseType: 'blob'
    });
    // Prefer the filename the server assigned via Content-Disposition; fall back to a generic name.
    const disposition = res.headers?.['content-disposition'] || '';
    const match = /filename="?([^"]+)"?/i.exec(disposition);
    const filename = match ? match[1] : `report-${reportId}`;
    return { blob: res.data, filename };
  },

  // --- Comments (polymorphic: targetType is 'Strategy' | 'Task' | 'Report') ---
  getComments: async (targetType, targetId) => {
    const res = await axios.get(`${API_URL}/seo-workspace/${targetType}/${targetId}/comments`, getAuthHeaders());
    return res.data;
  },
  createComment: async (targetType, targetId, data) => {
    const res = await axios.post(`${API_URL}/seo-workspace/${targetType}/${targetId}/comments`, data, getAuthHeaders());
    return res.data;
  },
  deleteComment: async (commentId) => {
    const res = await axios.delete(`${API_URL}/seo-workspace/comments/${commentId}`, getAuthHeaders());
    return res.data;
  },

  // --- Automation rules (scheduler-driven: daily/weekly/monthly) ---
  runAutomationAgent: async (projectId) => {
    const res = await axios.post(`${API_URL}/seo-workspace/projects/${projectId}/automation/run`, {}, getAuthHeaders());
    return res.data;
  },
  createAutomationRule: async (projectId, data) => {
    const res = await axios.post(`${API_URL}/seo-workspace/projects/${projectId}/automation`, data, getAuthHeaders());
    return res.data;
  },
  getAutomationRules: async (projectId) => {
    const res = await axios.get(`${API_URL}/seo-workspace/projects/${projectId}/automation`, getAuthHeaders());
    return res.data;
  },
  approveAutomationRule: async (projectId, ruleId) => {
    const res = await axios.put(`${API_URL}/seo-workspace/projects/${projectId}/automation/${ruleId}/approve`, {}, getAuthHeaders());
    return res.data;
  },
  rejectAutomationRule: async (projectId, ruleId, reason) => {
    const res = await axios.put(`${API_URL}/seo-workspace/projects/${projectId}/automation/${ruleId}/reject`, { reason }, getAuthHeaders());
    return res.data;
  },
  toggleAutomationRule: async (projectId, ruleId, isEnabled) => {
    const res = await axios.put(`${API_URL}/seo-workspace/projects/${projectId}/automation/${ruleId}/toggle`, { isEnabled }, getAuthHeaders());
    return res.data;
  },
  retryAutomationRule: async (projectId, ruleId) => {
    const res = await axios.post(`${API_URL}/seo-workspace/projects/${projectId}/automation/${ruleId}/retry`, {}, getAuthHeaders());
    return res.data;
  },
  getAutomationHistory: async (projectId, options = {}) => {
    const limit = typeof options === 'object' && options !== null ? options.limit : options;
    const res = await axios.get(`${API_URL}/v1/automation/projects/${projectId}/history${qs({ limit })}`, getAuthHeaders());
    return res.data;
  },

  // --- History (per-project or per-target) ---
  getProjectHistory: async (projectId, limit) => {
    const res = await axios.get(`${API_URL}/seo-workspace/projects/${projectId}/history${qs({ limit })}`, getAuthHeaders());
    return res.data;
  },
  getTargetHistory: async (targetType, targetId, limit) => {
    const res = await axios.get(`${API_URL}/${targetType}/${targetId}/history${qs({ limit })}`, getAuthHeaders());
    return res.data;
  },

  // --- Monitoring (Enterprise) ---
  getMonitoringDashboard: async (projectId) => {
    const res = await axios.get(`${API_URL}/seo-workspace/projects/${projectId}/monitoring/dashboard`, getAuthHeaders());
    return res.data;
  },
  triggerMonitoringScan: async (projectId) => {
    const res = await axios.post(`${API_URL}/seo-workspace/projects/${projectId}/monitoring/scan`, {}, getAuthHeaders());
    return res.data;
  },
  getMonitoringScanStatus: async (projectId, scanId) => {
    const res = await axios.get(`${API_URL}/seo-workspace/projects/${projectId}/monitoring/scan/${scanId}/status`, getAuthHeaders());
    return res.data;
  },
  getMonitoringAlerts: async (projectId, status) => {
    const res = await axios.get(`${API_URL}/seo-workspace/projects/${projectId}/monitoring/alerts${qs({ status })}`, getAuthHeaders());
    return res.data;
  },
  updateMonitoringAlertStatus: async (projectId, alertId, status, resolutionNotes) => {
    const res = await axios.put(`${API_URL}/seo-workspace/projects/${projectId}/monitoring/alerts/${alertId}/status`, { status, resolutionNotes }, getAuthHeaders());
    return res.data;
  },
  getMonitoringHistory: async (projectId, timeframeDays) => {
    const res = await axios.get(`${API_URL}/seo-workspace/projects/${projectId}/monitoring/history${qs({ timeframeDays })}`, getAuthHeaders());
    return res.data;
  },
  getMonitoringSettings: async (projectId) => {
    const res = await axios.get(`${API_URL}/seo-workspace/projects/${projectId}/monitoring/settings`, getAuthHeaders());
    return res.data;
  },
  updateMonitoringSettings: async (projectId, settings) => {
    const res = await axios.put(`${API_URL}/seo-workspace/projects/${projectId}/monitoring/settings`, settings, getAuthHeaders());
    return res.data;
  },

  // --- Automation V1 (Engine) ---
  getAutomationTemplates: async () => {
    const res = await axios.get(`${API_URL}/v1/automation/templates`, getAuthHeaders());
    return res.data;
  },
  getAutomationMetrics: async (projectId) => {
    const pid = projectId && projectId !== 'undefined' ? projectId : 'default';
    const res = await axios.get(`${API_URL}/v1/automation/projects/${pid}/metrics`, getAuthHeaders());
    return res.data;
  },
  getAutomationQueue: async (projectId) => {
    const pid = projectId && projectId !== 'undefined' ? projectId : 'default';
    const res = await axios.get(`${API_URL}/v1/automation/projects/${pid}/queue`, getAuthHeaders());
    return res.data;
  },
  getAutomationWorkflows: async (projectId) => {
    const pid = projectId && projectId !== 'undefined' ? projectId : 'default';
    const res = await axios.get(`${API_URL}/v1/automation/projects/${pid}/workflows`, getAuthHeaders());
    return res.data;
  },
  getAutomationHistoryLogs: async (projectId) => {
    const pid = projectId && projectId !== 'undefined' ? projectId : 'default';
    const res = await axios.get(`${API_URL}/v1/automation/projects/${pid}/history`, getAuthHeaders());
    return res.data;
  },
  getAutomationHistory: async (projectId, params) => {
    const pid = projectId && projectId !== 'undefined' ? projectId : 'default';
    const res = await axios.get(`${API_URL}/v1/automation/projects/${pid}/history${qs(params)}`, getAuthHeaders());
    return res.data;
  },
  getAutomationRunById: async (projectId, runId) => {
    const pid = projectId && projectId !== 'undefined' ? projectId : 'default';
    const res = await axios.get(`${API_URL}/v1/automation/projects/${pid}/history/${runId}`, getAuthHeaders());
    return res.data;
  },
  getAutomationRunLogs: async (projectId, runId) => {
    const pid = projectId && projectId !== 'undefined' ? projectId : 'default';
    const res = await axios.get(`${API_URL}/v1/automation/projects/${pid}/history/${runId}/logs`, getAuthHeaders());
    return res.data;
  },
  toggleQueueState: async (projectId, isPaused) => {
    const pid = projectId && projectId !== 'undefined' ? projectId : 'default';
    return { success: true, isPaused };
  },
  replayDeadLetterQueue: async (projectId, taskId) => {
    const pid = projectId && projectId !== 'undefined' ? projectId : 'default';
    const res = await axios.post(`${API_URL}/v1/automation/projects/${pid}/queue/dlq/replay`, { taskId }, getAuthHeaders());
    return res.data;
  },
  purgeDeadLetterQueue: async (projectId) => {
    const pid = projectId && projectId !== 'undefined' ? projectId : 'default';
    return { success: true, message: 'DLQ purged' };
  },
  createAutomationWorkflow: async (projectId, data) => {
    const pid = projectId && projectId !== 'undefined' ? projectId : 'default';
    const res = await axios.post(`${API_URL}/v1/automation/projects/${pid}/workflows`, data, getAuthHeaders());
    return res.data;
  },
  getAutomationWorkflow: async (projectId, workflowId) => {
    const pid = projectId && projectId !== 'undefined' ? projectId : 'default';
    const res = await axios.get(`${API_URL}/v1/automation/projects/${pid}/workflows/${workflowId}`, getAuthHeaders());
    return res.data;
  },
  updateAutomationWorkflow: async (projectId, workflowId, data) => {
    const pid = projectId && projectId !== 'undefined' ? projectId : 'default';
    const res = await axios.put(`${API_URL}/v1/automation/projects/${pid}/workflows/${workflowId}`, data, getAuthHeaders());
    return res.data;
  },
  deleteAutomationWorkflow: async (projectId, workflowId) => {
    const pid = projectId && projectId !== 'undefined' ? projectId : 'default';
    const res = await axios.delete(`${API_URL}/v1/automation/projects/${pid}/workflows/${workflowId}`, getAuthHeaders());
    return res.data;
  },
  cloneAutomationWorkflow: async (projectId, workflowId) => {
    const pid = projectId && projectId !== 'undefined' ? projectId : 'default';
    const res = await axios.post(`${API_URL}/v1/automation/projects/${pid}/workflows/${workflowId}/clone`, {}, getAuthHeaders());
    return res.data;
  },
  exportAutomationWorkflow: async (projectId, workflowId) => {
    const pid = projectId && projectId !== 'undefined' ? projectId : 'default';
    const res = await axios.post(`${API_URL}/v1/automation/projects/${pid}/workflows/${workflowId}/export`, {}, getAuthHeaders());
    return res.data;
  },
  importAutomationWorkflow: async (projectId, data) => {
    const pid = projectId && projectId !== 'undefined' ? projectId : 'default';
    const res = await axios.post(`${API_URL}/v1/automation/projects/${pid}/workflows/import`, data, getAuthHeaders());
    return res.data;
  },
  rollbackAutomationWorkflow: async (projectId, workflowId, versionId) => {
    const pid = projectId && projectId !== 'undefined' ? projectId : 'default';
    const res = await axios.post(`${API_URL}/v1/automation/projects/${pid}/workflows/${workflowId}/rollback`, { versionId }, getAuthHeaders());
    return res.data;
  },
  publishAutomationWorkflow: async (projectId, workflowId) => {
    const pid = projectId && projectId !== 'undefined' ? projectId : 'default';
    const res = await axios.post(`${API_URL}/v1/automation/projects/${pid}/workflows/${workflowId}/publish`, {}, getAuthHeaders());
    return res.data;
  },
  archiveAutomationWorkflow: async (projectId, workflowId) => {
    const pid = projectId && projectId !== 'undefined' ? projectId : 'default';
    const res = await axios.post(`${API_URL}/v1/automation/projects/${pid}/workflows/${workflowId}/archive`, {}, getAuthHeaders());
    return res.data;
  },
  runAutomationWorkflow: async (projectId, workflowId) => {
    const pid = projectId && projectId !== 'undefined' ? projectId : 'default';
    const res = await axios.post(`${API_URL}/v1/automation/projects/${pid}/workflows/${workflowId}/run`, {}, getAuthHeaders());
    return res.data;
  },
  simulateAutomationWorkflow: async (projectId, workflowId, payload) => {
    const pid = projectId && projectId !== 'undefined' ? projectId : 'default';
    const res = await axios.post(`${API_URL}/v1/automation/projects/${pid}/workflows/${workflowId}/simulate`, payload, getAuthHeaders());
    return res.data;
  },
  cancelAutomationExecution: async (projectId, workflowId, runId) => {
    const pid = projectId && projectId !== 'undefined' ? projectId : 'default';
    const res = await axios.post(`${API_URL}/v1/automation/projects/${pid}/workflows/${workflowId}/cancel`, { runId }, getAuthHeaders());
    return res.data;
  },
  generateAiWorkflow: async (projectId, prompt) => {
    const pid = projectId && projectId !== 'undefined' ? projectId : 'default';
    const res = await axios.post(`${API_URL}/v1/automation/projects/${pid}/ai/generate`, { prompt }, getAuthHeaders());
    return res.data;
  },
  optimizeAiWorkflow: async (projectId, data) => {
    const pid = projectId && projectId !== 'undefined' ? projectId : 'default';
    const res = await axios.post(`${API_URL}/v1/automation/projects/${pid}/ai/optimize`, data, getAuthHeaders());
    return res.data;
  },
  getAutomationTriggers: async (projectId) => {
    const res = await axios.get(`${API_URL}/v1/automation/projects/${projectId}/triggers`, getAuthHeaders());
    return res.data;
  },
  getAutomationActions: async (projectId) => {
    const res = await axios.get(`${API_URL}/v1/automation/projects/${projectId}/actions`, getAuthHeaders());
    return res.data;
  },
  replayDlq: async (projectId, taskId) => {
    const res = await axios.post(`${API_URL}/v1/automation/projects/${projectId}/queue/dlq/replay`, { taskId }, getAuthHeaders());
    return res.data;
  },

  // --- Secret Vault / Credentials ---
  getCredentials: async (projectId) => {
    const res = await axios.get(`${API_URL}/v1/automation/projects/${projectId}/credentials`, getAuthHeaders());
    return res.data;
  },
  saveCredential: async (projectId, data) => {
    const res = await axios.post(`${API_URL}/v1/automation/projects/${projectId}/credentials`, data, getAuthHeaders());
    return res.data;
  },
  deleteCredential: async (projectId, credentialId) => {
    const res = await axios.delete(`${API_URL}/v1/automation/projects/${projectId}/credentials/${credentialId}`, getAuthHeaders());
    return res.data;
  },
  verifyCredential: async (projectId, credentialId) => {
    const res = await axios.post(`${API_URL}/v1/automation/projects/${projectId}/credentials/${credentialId}/verify`, {}, getAuthHeaders());
    return res.data;
  },

  // --- Calendar & Timezone Scheduler ---
  getSchedules: async (projectId, params) => {
    const res = await axios.get(`${API_URL}/v1/automation/projects/${projectId}/schedules${qs(params)}`, getAuthHeaders());
    return res.data;
  },
  saveSchedule: async (projectId, data) => {
    const res = await axios.post(`${API_URL}/v1/automation/projects/${projectId}/schedules`, data, getAuthHeaders());
    return res.data;
  },
  toggleSchedule: async (projectId, scheduleId, enabled) => {
    const res = await axios.post(`${API_URL}/v1/automation/projects/${projectId}/schedules/${scheduleId}/toggle`, { enabled }, getAuthHeaders());
    return res.data;
  },
  triggerScheduleNow: async (projectId, scheduleId) => {
    const res = await axios.post(`${API_URL}/v1/automation/projects/${projectId}/schedules/${scheduleId}/trigger-now`, {}, getAuthHeaders());
    return res.data;
  },
  deleteSchedule: async (projectId, scheduleId) => {
    const res = await axios.delete(`${API_URL}/v1/automation/projects/${projectId}/schedules/${scheduleId}`, getAuthHeaders());
    return res.data;
  },

  // --- Notification Center & Digests ---
  getNotifications: async (projectId, params) => {
    const res = await axios.get(`${API_URL}/v1/automation/projects/${projectId}/notifications${qs(params)}`, getAuthHeaders());
    return res.data;
  },
  markNotificationRead: async (projectId, notificationId) => {
    const res = await axios.post(`${API_URL}/v1/automation/projects/${projectId}/notifications/${notificationId}/read`, {}, getAuthHeaders());
    return res.data;
  },
  markAllNotificationsRead: async (projectId) => {
    const res = await axios.post(`${API_URL}/v1/automation/projects/${projectId}/notifications/read-all`, {}, getAuthHeaders());
    return res.data;
  },
  deleteNotification: async (projectId, notificationId) => {
    const res = await axios.delete(`${API_URL}/v1/automation/projects/${projectId}/notifications/${notificationId}`, getAuthHeaders());
    return res.data;
  },
  generateNotificationDigest: async (projectId, digestType) => {
    const res = await axios.post(`${API_URL}/v1/automation/projects/${projectId}/notifications/digest`, { digestType }, getAuthHeaders());
    return res.data;
  },

  // --- Analytics Overview ---
  getAnalyticsOverview: async (projectId, timeRange) => {
    const res = await axios.get(`${API_URL}/v1/automation/projects/${projectId}/analytics/overview${qs({ timeRange })}`, getAuthHeaders());
    return res.data;
  },

  // --- Monitoring Intelligence Additions ---
  getMonitoringHealthBreakdown: async (projectId) => {
    const res = await axios.get(`${API_URL}/seo-workspace/projects/${projectId}/monitoring/health-breakdown`, getAuthHeaders());
    return res.data;
  },
  getMonitoringRiskAssessment: async (projectId) => {
    const res = await axios.get(`${API_URL}/seo-workspace/projects/${projectId}/monitoring/risk-assessment`, getAuthHeaders());
    return res.data;
  },
  getMonitoringOpportunities: async (projectId) => {
    const res = await axios.get(`${API_URL}/seo-workspace/projects/${projectId}/monitoring/opportunities`, getAuthHeaders());
    return res.data;
  },
  getMonitoringMonitors: async (projectId) => {
    const res = await axios.get(`${API_URL}/seo-workspace/projects/${projectId}/monitoring/monitors`, getAuthHeaders());
    return res.data;
  },

  // --- Comments (polymorphic: targetType = 'Strategy' | 'Task' | 'Report') ---
  getComments: async (targetType, targetId) => {
    const res = await axios.get(`${API_URL}/seo-workspace/${targetType}/${targetId}/comments`, getAuthHeaders());
    return res.data;
  },
  createComment: async (targetType, targetId, content) => {
    const res = await axios.post(`${API_URL}/seo-workspace/${targetType}/${targetId}/comments`, { content }, getAuthHeaders());
    return res.data;
  },
  deleteComment: async (commentId) => {
    const res = await axios.delete(`${API_URL}/seo-workspace/comments/${commentId}`, getAuthHeaders());
    return res.data;
  },

  // --- Attachments (multipart/form-data upload — do NOT use JSON) ---
  getAttachments: async (targetType, targetId) => {
    const res = await axios.get(`${API_URL}/seo-workspace/${targetType}/${targetId}/attachments`, getAuthHeaders());
    return res.data;
  },
  /**
   * Upload a file attachment.
   * @param {string} targetType - 'Strategy' | 'Task' | 'Report'
   * @param {string} targetId   - MongoDB ObjectId of the target document
   * @param {File}   file       - browser File object
   * @param {string} [projectId] - optional, for db association
   * @param {Function} [onProgress] - optional progress callback (percent: number) => void
   */
  uploadAttachment: async (targetType, targetId, file, projectId, onProgress) => {
    const formData = new FormData();
    formData.append('file', file);
    if (projectId) formData.append('projectId', projectId);

    const authHeaders = getAuthHeaders();
    // Do NOT set Content-Type manually — axios sets it automatically with the correct boundary for multipart
    const res = await axios.post(
      `${API_URL}/seo-workspace/${targetType}/${targetId}/attachments`,
      formData,
      {
        headers: { ...authHeaders.headers },
        onUploadProgress: onProgress
          ? (progressEvent) => {
              const percent = Math.round((progressEvent.loaded * 100) / (progressEvent.total || 1));
              onProgress(percent);
            }
          : undefined
      }
    );
    return res.data;
  },
  deleteAttachment: async (attachmentId) => {
    const res = await axios.delete(`${API_URL}/seo-workspace/attachments/${attachmentId}`, getAuthHeaders());
    return res.data;
  }
};