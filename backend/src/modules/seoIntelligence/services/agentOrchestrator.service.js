
const SeoProject = require('../models/seoProject.model');
const SeoAudit = require('../models/seoAudit.model');
const SeoAgentKeyword = require('../models/seoKeyword.model');
const SeoStrategy = require('../models/seoStrategy.model');
const SeoTask = require('../models/seoTask.model');
const SeoReport = require('../models/seoReport.model');
const DataForSeoService = require('../dataForSeo.service');

class AgentOrchestrator {
  constructor() {
    this.dfsService = new DataForSeoService();
  }

  async _getAiClient(workspaceId) {
    if (!workspaceId) throw new Error("Workspace ID is required for AI features.");
    const AiSettings = require('../../aiStudio/models/aiSettings.model');
    const cryptoUtils = require('../../../utils/crypto');
    const AiClientWrapper = require('../../../utils/aiClientWrapper');
    let settings = await AiSettings.findOne({ workspaceId, module: 'marketplace' });
    if (!settings) {
      settings = await AiSettings.findOne({ workspaceId, module: { $exists: false } }) || await AiSettings.findOne({ workspaceId });
    }
    if (settings) {
      if (settings.anthropicApiKey) {
        return new AiClientWrapper(cryptoUtils.decrypt(settings.anthropicApiKey), 'anthropic');
      }
    }
    throw new Error("AI Provider API key is missing. Please configure it in settings.");
  }

  async runOrchestration(projectId) {
    try {
      const project = await SeoProject.findById(projectId);
      if (!project) throw new Error('Project not found');

      const audit = await SeoAudit.findOne({ projectId }).sort({ createdAt: -1 });
      
      // Step 1: AI Keyword Research
      const keywordSeeds = await this._generateKeywordSeeds(project.siteUrl, project.name, project.createdBy || project.companyId);
      
      // Step 2: Fetch Real Data from DataForSEO
      let keywordsToSave = [];
      if (this.dfsService.configured) {
        const dfsData = await this.dfsService.getKeywords(keywordSeeds.join(', '), 2356, 'en', 20);
        if (dfsData && dfsData.keywords && dfsData.keywords.length > 0) {
          keywordsToSave = dfsData.keywords.map(k => ({
            projectId,
            agencyId: project.createdBy || project.companyId,
            keyword: k.keyword,
            metrics: {
              searchVolume: k.search_volume || null,
              keywordDifficulty: (k.competition || 0) > 0.6 ? 80 : (k.competition || 0) > 0.3 ? 50 : 20,
              intent: 'commercial'
            },
            ranking: { currentRank: 0 }
          }));
        }
      } 
      
      // Fallback if DataForSEO fails or not configured
      if (keywordsToSave.length === 0) {
        keywordsToSave = keywordSeeds.map(k => ({
          projectId,
          agencyId: project.createdBy || project.companyId,
          keyword: k,
          metrics: {
            searchVolume: null,
            keywordDifficulty: null,
            intent: 'informational'
          },
          ranking: { currentRank: 0 }
        }));
      }

      await SeoAgentKeyword.insertMany(keywordsToSave);

      // Step 3: AI Strategy Generation
      const strategyPlan = await this._generateContentStrategy(project, audit, keywordsToSave);
      
      const strategy = new SeoStrategy({
        projectId,
        title: `SEO Content Strategy for ${project.name}`,
        content: strategyPlan,
        status: 'Approved'
      });
      await strategy.save();

      // Step 4: Generate Implementation Tasks (Gate 2 Queue)
      const tasksData = await this._generateImplementationTasks(project, strategyPlan, keywordsToSave);
      
      const realTasks = tasksData.map(taskData => ({
        projectId,
        strategyId: strategy._id,
        pageUrl: taskData.pageUrl || '/',
        taskType: taskData.taskType || 'Content Edit',
        description: taskData.description || 'Implement SEO improvements',
        proposedChanges: taskData.proposedChanges || {},
        status: 'Pending'
      }));
      
      if (realTasks.length > 0) {
        await SeoTask.insertMany(realTasks);
      }

      // Update project phase
      project.phase = 'implementation'; // Moving to implementation phase
      await project.save();

      return { message: 'Orchestration complete', keywords: keywordsToSave.length, strategy: strategy.title };
    } catch (error) {
      console.error('AgentOrchestrator Error:', error);
      throw error;
    }
  }

  async _generateKeywordSeeds(siteUrl, name, workspaceId) {
    const aiClient = await this._getAiClient(workspaceId);
    const skillLoader = require('../../../utils/skillLoader');
    const skills = skillLoader.loadSkillsForAgent(['keyword-research']);
    const prompt = `You are the Keyword Researcher Agent. Based on the following SEO Strategy for the URL ${siteUrl}:

${skills}

Suggest exactly 5 high-potential, long-tail keywords that the site should target immediately to gain quick traffic. 
Format as a clean, comma-separated list of keywords ONLY.`;
    
    const response = await aiClient.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.7,
      max_tokens: 150
    });
    
    const output = response.choices[0].message.content.trim();
    return output.split(',').map(k => k.trim());
  }

  async _generateContentStrategy(project, audit, keywords) {
    const workspaceId = project.createdBy || project.companyId;
    const aiClient = await this._getAiClient(workspaceId);
    const kList = keywords.map(k => k.keyword).join(', ');
    const auditData = audit ? `Crawled ${audit.urlsCrawledCount || 0} pages. On-Page Score: ${audit.scores?.onPage || 0}` : 'No audit data available';
    
    const prompt = `You are a Master SEO Content Strategist.
Create a high-level 3-month SEO Content Strategy for ${project.name} (${project.siteUrl}).
Target Keywords: ${kList}
Audit Context: ${auditData}

Format the output in clean Markdown with:
1. Executive Summary
2. Month 1: Technical & Quick Wins
3. Month 2: Content Creation (Propose 3 Blog Titles)
4. Month 3: Off-Page & Authority Building`;

    const response = await aiClient.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.7,
      max_tokens: 800
    });
    
    return response.choices[0].message.content;
  }

  async _generateImplementationTasks(project, strategyPlan, keywords) {
    const workspaceId = project.createdBy || project.companyId;
    const aiClient = await this._getAiClient(workspaceId);
    const skillLoader = require('../../../utils/skillLoader');
    const skills = skillLoader.loadSkillsForAgent(['content-gap-analysis']);
    const kList = keywords.map(k => k.keyword).join(', ');
    const prompt = `You are the Content Gap Analyst Agent. Based on the SEO Strategy for ${project.siteUrl} and the target keywords (${kList}), identify exactly 3 specific, actionable content gaps.
${skills}

Return a JSON array of objects. Each object MUST have this exact structure:
{
  "title": "Proposed Blog Post or Page Title",
  "type": "Blog Post" | "Landing Page" | "Glossary Term",
  "priority": "High" | "Medium" | "Low",
  "description": "Short 1-sentence description of what the content should cover."
}

Respond ONLY with the raw JSON array. Do not wrap in markdown tags like \`\`\`json.`;

    try {
      const responseObj = await aiClient.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.5,
        response_format: { type: "json_object" }
      });

      const content = responseObj.choices[0].message.content;
      const parsed = JSON.parse(content);
      return parsed.tasks || [];
    } catch (error) {
      console.error('Task generation failed:', error);
      return [];
    }
  }

  async generateFinalReport(projectId, auditDiff) {
    const project = await SeoProject.findById(projectId);
    if (!project) throw new Error('Project not found');
    const workspaceId = project.createdBy || project.companyId;
    const aiClient = await this._getAiClient(workspaceId);

    const prompt = `You are a Master SEO Reporter.
Create an Executive Summary Final Report for ${project.name} (${project.siteUrl}).
Here is the diff from the previous audit to the latest audit after our implementation:
Performance Change: ${auditDiff.diff.performance}
On-Page SEO Change: ${auditDiff.diff.onPage}
Crawlability Change: ${auditDiff.diff.crawlability}
Overall Score Change: ${auditDiff.diff.overall}

Write a professional, client-facing Markdown report summarizing the ROI, what was improved, and next steps. Make it persuasive and clear.`;

    const response = await aiClient.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.7,
      max_tokens: 800
    });
    
    const reportContent = response.choices[0].message.content;

    const report = new SeoReport({
      projectId,
      agencyId: project.createdBy || project.companyId,
      clientId: project.clientId || project.createdBy,
      name: `Executive SEO Summary for ${project.name}`,
      type: 'executive_summary',
      format: 'markdown',
      content: reportContent,
      status: 'completed'
    });

    await report.save();
    return report;
  }
}

module.exports = AgentOrchestrator;
