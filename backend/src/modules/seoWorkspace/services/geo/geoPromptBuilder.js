const aiEngine = require('../../../aiCore/aiEngine.service');
const logger = require('../../../aiCore/logger.service');
const geoConfig = require('./geoConfig');
const agentLoader = require('../../../aiCore/agentLoader.service');

const TAG = 'GeoPromptBuilder';
const AGENT_KEY = 'geo-agent';

class GeoPromptBuilder {
  /**
   * Integrates deterministic results with AI for summarization and recommendation enhancement.
   * @param {Object} project
   * @param {Object} analyzerResults 
   * @param {Array} rawRecommendations
   * @param {String} workspaceId
   * @returns {Object} { aiSummary, enhancedRecommendations }
   */
  async buildAndExecute(project, analyzerResults, rawRecommendations, workspaceId) {
    try {
      const agentConfig = await agentLoader.resolve(AGENT_KEY);
      const model = agentConfig.modelName;

      // Extract a deterministic summary snapshot to feed the AI
      const deterministicSnapshot = {};
      for (const [key, value] of Object.entries(analyzerResults)) {
        if (value.status === 'success') {
          deterministicSnapshot[key] = {
            score: value.score,
            issues: value.issues,
            evidence: value.evidence.map(e => e.message)
          };
        }
      }

      const prompt = `You are the Enterprise GEO Agent for ${project.name} (${project.domain}).
Our deterministic analyzers have already run and generated the following scores and evidence:
${JSON.stringify(deterministicSnapshot, null, 2)}

Our engines also generated the following prioritized recommendations:
${JSON.stringify(rawRecommendations, null, 2)}

Your task:
1. Provide a 2-4 sentence executive summary of the site's Generative Engine Optimization readiness based ONLY on the evidence above.
2. For each recommendation provided above, enhance the "description" field to be more human-readable and actionable for a marketing/SEO team. Do NOT change the ruleKey, priority, or page fields. Do NOT invent new recommendations.

Output EXACTLY this JSON schema:
{
  "summary": "String",
  "recommendations": [
    {
      "ruleKey": "String (must match input exactly)",
      "title": "String",
      "description": "String (enhanced by you)",
      "priority": "String (must match input exactly)",
      "page": "String (must match input exactly)"
    }
  ]
}
No markdown, no commentary, only JSON.`;

      const raw = await aiEngine.complete({
        workspaceId,
        agentKey: AGENT_KEY,
        projectId: project._id,
        messages: [{ role: 'user', content: prompt }],
        model,
        temperature: 0.2,
        maxTokens: 4096,
        jsonMode: true,
        retryOptions: { retries: 2 }
      });

      const parsed = JSON.parse(raw);
      
      // Validate schema
      if (!parsed.summary || !Array.isArray(parsed.recommendations)) {
        throw new Error('AI returned invalid schema.');
      }

      // Merge AI descriptions back into the rich deterministic recommendations (which have evidence attached)
      const enhancedRecommendations = rawRecommendations.map(rec => {
        const aiRec = parsed.recommendations.find(r => r.ruleKey === rec.ruleKey && r.page === rec.page);
        return {
          ...rec,
          description: aiRec ? aiRec.description : rec.description // Use AI enhancement if matched
        };
      });

      return {
        aiSummary: parsed.summary,
        enhancedRecommendations
      };
    } catch (error) {
      logger.error(TAG, `AI Interpretation failed: ${error.message}`, { projectId: project._id });
      // Fallback: return deterministic recommendations unmodified and a generic summary
      return {
        aiSummary: 'Automated analysis completed. Detailed AI interpretation was unavailable.',
        enhancedRecommendations: rawRecommendations
      };
    }
  }
}

module.exports = new GeoPromptBuilder();
