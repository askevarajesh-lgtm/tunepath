const Anthropic = require('@anthropic-ai/sdk');
const OpenAI = require('openai');
// For Gemini, we might use googleapis or @google/genai. Assuming there is an internal wrapper or we use fetch.

class AIOrchestrator {
  constructor() {
    this.anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    this.openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    this.geminiApiKey = process.env.GEMINI_API_KEY;
  }

  /**
   * Main entry point to generate content with fallback logic.
   * Priority: Claude Sonnet -> OpenAI GPT -> Gemini
   */
  async generateContent(prompt, systemInstruction = '', options = {}) {
    const providers = [
      () => this._generateWithClaude(prompt, systemInstruction, options),
      () => this._generateWithOpenAI(prompt, systemInstruction, options),
      () => this._generateWithGemini(prompt, systemInstruction, options)
    ];

    let lastError = null;

    for (const provider of providers) {
      try {
        const result = await provider();
        return result;
      } catch (error) {
        console.error(`[AIOrchestrator] Provider failed:`, error.message);
        lastError = error;
        // Continue to the next provider
      }
    }

    // If all providers fail
    console.error(`[AIOrchestrator] All AI providers failed. Returning cached/partial result if applicable or throwing.`);
    throw new Error(`AI Orchestrator failed after trying all providers. Last error: ${lastError.message}`);
  }

  async _generateWithClaude(prompt, systemInstruction, options) {
    if (!process.env.ANTHROPIC_API_KEY) throw new Error("Missing ANTHROPIC_API_KEY");

    const response = await this.anthropic.messages.create({
      model: "claude-sonnet-5", // Defaulting to modern Sonnet
      max_tokens: options.maxTokens || 4096,
      system: systemInstruction,
      messages: [{ role: "user", content: prompt }]
    });

    return response.content[0].text;
  }

  async _generateWithOpenAI(prompt, systemInstruction, options) {
    if (!process.env.OPENAI_API_KEY) throw new Error("Missing OPENAI_API_KEY");

    const response = await this.openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: systemInstruction },
        { role: "user", content: prompt }
      ],
      max_tokens: options.maxTokens || 4096,
    });

    return response.choices[0].message.content;
  }

  async _generateWithGemini(prompt, systemInstruction, options) {
    if (!this.geminiApiKey) throw new Error("Missing GEMINI_API_KEY");

    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro-latest:generateContent?key=${this.geminiApiKey}`;
    
    // Quick fetch for Gemini fallback
    const fetch = (await import('node-fetch')).default;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        system_instruction: { parts: { text: systemInstruction } },
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
           maxOutputTokens: options.maxTokens || 4096
        }
      })
    });

    const data = await response.json();
    if (!response.ok) throw new Error(data.error?.message || 'Gemini generation failed');

    return data.candidates[0].content.parts[0].text;
  }
}

module.exports = new AIOrchestrator();
