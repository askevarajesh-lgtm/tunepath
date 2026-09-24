const AiClientWrapper = require('../../../utils/aiClientWrapper');
const cryptoUtils = require('../../../utils/crypto');
const AiSettings = require('../../aiStudio/models/aiSettings.model');

class AIService {
  async getAiConfig(workspaceId) {
    if (!workspaceId) return null;
    let apiKey = null;
    let provider = 'anthropic';
    let openaiApiKey = null;
    let settings = await AiSettings.findOne({ workspaceId, module: 'marketplace' });
    if (!settings) {
      settings = await AiSettings.findOne({ workspaceId, module: { $exists: false } }) || await AiSettings.findOne({ workspaceId });
    }
    if (settings) {
      if (settings.contentAnthropicApiKey) {
        apiKey = cryptoUtils.decrypt(settings.contentAnthropicApiKey);
      } else if (settings.anthropicApiKey) {
        apiKey = cryptoUtils.decrypt(settings.anthropicApiKey);
      }
      
      if (settings.openaiApiKey) {
        openaiApiKey = cryptoUtils.decrypt(settings.openaiApiKey);
      }

      // Auto-detect if the user pasted an OpenAI key into the Anthropic key field
      if (apiKey && (apiKey.startsWith('sk-proj-') || (apiKey.startsWith('sk-') && !apiKey.startsWith('sk-ant-')))) {
        openaiApiKey = apiKey;
        apiKey = openaiApiKey;
        provider = 'openai';
      }

      if (settings.aiProvider === 'openai' && openaiApiKey) {
        apiKey = openaiApiKey;
        provider = 'openai';
      } else if (!apiKey && openaiApiKey) {
        apiKey = openaiApiKey;
        provider = 'openai';
      }
    }
    return { apiKey, provider, openaiApiKey };
  }

  async generateJSON(prompt, systemPrompt, workspaceId, model = 'claude-3-5-sonnet-latest') {
    const config = await this.getAiConfig(workspaceId);
    if (!config || !config.apiKey) throw new Error('API Key is missing. Please configure it in AI settings.');

    let aiClient = new AiClientWrapper(config.apiKey, config.provider);

    const messages = [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: prompt }
    ];

    let content;
    try {
      if (config.provider === 'openai' && config.openaiApiKey) {
         const response = await aiClient.chat.completions.create({
           model: 'gpt-4o',
           messages,
           response_format: { type: "json_object" }
         });
         content = response.choices[0].message.content;
      } else {
        const response = await aiClient.chat.completions.create({
          model,
          messages,
          response_format: { type: "json_object" }
        });
        
        // Anthropic sometimes returns the raw text directly in aiClientWrapper
        if (response && response.choices) {
           content = response.choices[0].message.content;
        } else {
           content = response;
        }
      }
    } catch (error) {
      if (config.provider === 'anthropic' && config.openaiApiKey) {
        console.warn('Anthropic API failed, falling back to OpenAI...');
        try {
          const fallbackClient = new AiClientWrapper(config.openaiApiKey, 'openai');
          const fallbackResponse = await fallbackClient.chat.completions.create({
            model: 'gpt-4o',
            messages,
            response_format: { type: "json_object" }
          });
          content = fallbackResponse.choices[0].message.content;
        } catch (fallbackError) {
          console.error('OpenAI Fallback Error:', fallbackError.message);
          throw new Error('AI Provider Error: ' + (fallbackError.message || fallbackError.toString()));
        }
      } else {
        const errorMsg = error.response?.data ? JSON.stringify(error.response.data) : error.message;
        console.error('AIService generateJSON error:', errorMsg);
        throw new Error(`AI Provider Error: ${errorMsg}`);
      }
    }

    try {
      return typeof content === 'string' ? JSON.parse(content) : content;
    } catch (parseError) {
      console.error('Failed to parse JSON. Raw content was:', content);
      throw parseError;
    }
  }

  async humanizeText(text, brandVoice, workspaceId, model = 'claude-3-5-sonnet-latest') {
    const systemPrompt = require('../prompts/contentHumanizer.prompt');
    const prompt = `Brand Voice: ${brandVoice || 'Professional, engaging'}\n\nDraft:\n${text}`;
    return await this.generateJSON(prompt, systemPrompt, workspaceId, model);
  }
}

module.exports = new AIService();
