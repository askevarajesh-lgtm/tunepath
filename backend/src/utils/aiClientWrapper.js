const OpenAI = require('openai');
const Anthropic = require('@anthropic-ai/sdk');

class AiClientWrapper {
  constructor(apiKey, provider) {
    this.provider = provider || 'openai';
    if (this.provider === 'anthropic') {
      this.anthropic = new Anthropic({ apiKey });
    } else {
      this.openai = new OpenAI({ apiKey });
    }

    this.chat = {
      completions: {
        create: async (params) => {
          if (this.provider === 'openai') {
            return await this.openai.chat.completions.create(params, { timeout: params.timeout || 120000 });
          } else {
            // Anthropic logic
            let systemPrompt = '';
            const messages = [];
            for (const msg of params.messages) {
              if (msg.role === 'system') {
                systemPrompt += msg.content + '\n';
              } else {
                messages.push({ role: msg.role, content: msg.content });
              }
            }

            if (params.response_format && params.response_format.type === 'json_object') {
              systemPrompt += '\n\nYou must output ONLY valid JSON, with no markdown formatting or other text.';
            }

            let model = params.model || 'claude-sonnet-5';

            const anthropicParams = {
              model,
              max_tokens: params.max_tokens || 16000,
              messages
            };

            if (systemPrompt) anthropicParams.system = systemPrompt.trim();
            // Temperature is deprecated for this model, omitting it

            console.log("=== ANTHROPIC REQUEST PAYLOAD ===");
            console.log({
              provider: "anthropic",
              model: anthropicParams.model,
              max_tokens: anthropicParams.max_tokens,
              systemLength: anthropicParams.system?.length,
              messageCount: anthropicParams.messages?.length,
              userMessageLength: anthropicParams.messages?.[0]?.content?.length
            });
            console.log("=================================");

            let msg;
            const fallbackModels = [
              anthropicParams.model,
              'claude-sonnet-5',
              'claude-opus-5',
              'claude-3-5-sonnet-latest',
              'claude-3-5-sonnet-20241022',
              'claude-3-5-sonnet-20240620',
              'claude-3-sonnet-20240229',
              'claude-3-haiku-20240307'
            ];
            const uniqueModels = [...new Set(fallbackModels)];

            for (let i = 0; i < uniqueModels.length; i++) {
              try {
                anthropicParams.model = uniqueModels[i];
                msg = await this.anthropic.messages.create(anthropicParams, { timeout: params.timeout || 120000 });
                break; // Success!
              } catch (err) {
                // If max_tokens is too high for an older model (e.g. 400 invalid_request_error), retry with 4096
                if (err.status === 400 && anthropicParams.max_tokens > 4096 && err.message?.includes('max_tokens')) {
                  console.warn(`max_tokens ${anthropicParams.max_tokens} rejected by ${uniqueModels[i]}, retrying with 4096...`);
                  anthropicParams.max_tokens = 4096;
                  i--; // retry same model with 4096
                  continue;
                }
                if (err.status === 404 && i < uniqueModels.length - 1) {
                  console.warn(`Model ${uniqueModels[i]} not found (404), falling back to ${uniqueModels[i+1]}...`);
                  continue;
                }
                console.error("=== ANTHROPIC API ERROR ===");
                console.error("message:", err.message);
                console.error("status:", err.status);
                console.error("type:", err.type);
                console.error("error:", err.error);
                console.error("===========================");
                throw err;
              }
            }

            console.log("=== ANTHROPIC WEBSITE DEBUG ===");
            console.log("model:", anthropicParams.model);
            console.log("max_tokens:", anthropicParams.max_tokens);
            console.log("stop_reason:", msg?.stop_reason);
            console.log("stop_sequence:", msg?.stop_sequence);
            console.log("content_length:", msg?.content?.length);
            console.log("content_types:", msg?.content?.map(c => c?.type));
            console.log("usage:", msg?.usage);
            console.log("================================");

            let textBlocks = [];
            let thinkingBlocks = [];

            if (typeof msg?.content === 'string') {
              textBlocks = [{ text: msg.content }];
            } else if (Array.isArray(msg?.content)) {
              textBlocks = msg.content.filter(block => (block?.type === "text" || block?.text) && block?.type !== "thinking");
              thinkingBlocks = msg.content.filter(block => block?.type === "thinking" && block?.thinking);
            }

            let textContent = textBlocks
              .map(block => block.text || "")
              .join("\n\n")
              .trim();

            // If textContent is empty but thinking content exists (e.g. max_tokens hit during thinking)
            if (!textContent && thinkingBlocks.length > 0) {
              textContent = thinkingBlocks
                .map(block => block.thinking || "")
                .join("\n\n")
                .trim();
            }

            if (!textContent) {
              console.error("Claude returned no text content");
              console.error("content_types:", Array.isArray(msg?.content) ? msg.content.map(c => c?.type) : typeof msg?.content);
              console.error("stop_reason:", msg?.stop_reason);
              throw new Error(`Claude returned no text content. Stop reason: ${msg?.stop_reason}. Content types: ${Array.isArray(msg?.content) ? msg.content.map(c => c?.type).join(',') : typeof msg?.content}`);
            }

            if (msg?.stop_reason === 'max_tokens') {
              textContent += '\n\n*(Response reached maximum token limit. You can reply "Continue" to get more output.)*';
            }

            if (params.response_format && params.response_format.type === 'json_object' && textContent) {
              textContent = textContent.replace(/^```json\n?/, '').replace(/\n?```$/, '').trim();
            }

            // Mock OpenAI response structure
            return {
              choices: [
                {
                  message: {
                    content: textContent
                  }
                }
              ],
              _anthropic: {
                model: msg?.model,
                stop_reason: msg?.stop_reason,
                stop_sequence: msg?.stop_sequence,
                usage: msg?.usage
              }
            };
          }
        }
      }
    };
  }
}

module.exports = AiClientWrapper;
