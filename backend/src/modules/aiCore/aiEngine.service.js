
const AiSettings = require('../aiStudio/models/aiSettings.model');
const cryptoUtils = require('../../utils/crypto');
const AiClientWrapper = require('../../utils/aiClientWrapper');
const retry = require('./retry.service');
const executionStatus = require('./executionStatus.service');
const logger = require('./logger.service');
const { DEFAULT_AI_MODEL } = require('./config/aiDefaults');

async function getClient(workspaceId) {
  if (!workspaceId) throw new Error('AI Engine: workspaceId is required to resolve an AI client.');

  let settings = await AiSettings.findOne({ workspaceId, module: 'marketplace' });
  if (!settings) {
    settings = await AiSettings.findOne({ workspaceId, module: { $exists: false } }) || await AiSettings.findOne({ workspaceId });
  }

  if (settings) {
    const provider = settings.aiProvider || (settings.anthropicApiKey ? 'anthropic' : 'openai');
    
    if (provider === 'anthropic' && settings.anthropicApiKey) {
      return { 
        client: new AiClientWrapper(cryptoUtils.decrypt(settings.anthropicApiKey), 'anthropic'),
        provider: 'anthropic',
        configuredModel: settings.model 
      };
    }
    if (provider === 'openai' && settings.openaiApiKey) {
      return { 
        client: new AiClientWrapper(cryptoUtils.decrypt(settings.openaiApiKey), 'openai'),
        provider: 'openai',
        configuredModel: settings.model 
      };
    }
  }

  throw new Error('AI Engine: no AI provider API key configured for this workspace. Please configure one in settings.');
}

/**
 * @param {Object} params
 * @param {string} params.workspaceId - required, tenant scope for key lookup
 * @param {Array}  params.messages - chat-style messages, per AiClientWrapper's contract
 * @param {string} [params.model] - defaults to DEFAULT_AI_MODEL (config/aiDefaults.js) when not supplied
 * @param {number} [params.temperature=0.7]
 * @param {number} [params.maxTokens]
 * @param {boolean} [params.jsonMode=false] - requests a JSON object response
 * @param {string} [params.agentKey] - optional, for telemetry only (data reference, not new logic)
 * @param {string} [params.projectId] - optional, for telemetry only
 * @param {Object} [params.retryOptions] - passed through to Retry System
 * @returns {Promise<string>} the model's text content
 */
async function complete(params) {
  const {
    workspaceId, messages, model = DEFAULT_AI_MODEL, temperature = 0.7,
    maxTokens, jsonMode = false, agentKey, projectId, retryOptions = {}
  } = params;

  const executionId = `aiEngine:${agentKey || 'unspecified'}:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`;
  const startedAt = Date.now();
  
  // We resolve the client and model inside the retry loop because settings might change,
  // but we can log the requested model now.
  executionStatus.start(executionId, { agentKey, projectId, model });
  logger.logExecution({ executionId, source: 'aiEngine', agentKey, projectId, status: 'started', meta: { model } });

  try {
    const result = await retry.withRetry(async (attempt) => {
      if (attempt > 0) {
        logger.logExecution({ executionId, source: 'aiEngine', agentKey, projectId, status: 'retrying', meta: { attempt } });
      }
      
      const { client, configuredModel } = await getClient(workspaceId);
      
      // Prioritize the user's workspace settings if available, otherwise fallback to the agent's default
      const finalModel = configuredModel || model;
      
      const requestParams = {
        model: finalModel,
        messages,
        temperature
      };
      if (maxTokens) requestParams.max_tokens = maxTokens;
      if (jsonMode) requestParams.response_format = { type: 'json_object' };

      const response = await client.chat.completions.create(requestParams);
      return response.choices[0].message.content;
    }, retryOptions);

    const durationMs = Date.now() - startedAt;
    executionStatus.succeed(executionId, { length: result ? result.length : 0 });
    logger.logExecution({ executionId, source: 'aiEngine', agentKey, projectId, status: 'succeeded', durationMs });

    return result;
  } catch (error) {
    const durationMs = Date.now() - startedAt;
    executionStatus.fail(executionId, error);
    logger.logExecution({ executionId, source: 'aiEngine', agentKey, projectId, status: 'failed', durationMs, error: error.message });
    throw error;
  }
}

module.exports = { getClient, complete };