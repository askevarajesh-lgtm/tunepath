const cheerio = require('cheerio');
const AiSettings = require('../../aiStudio/models/aiSettings.model');
const cryptoUtils = require('../../../utils/crypto');
const AiClientWrapper = require('../../../utils/aiClientWrapper');
const { DEFAULT_AI_MODEL } = require('../../aiCore/config/aiDefaults');

const ALLOWED_PROTOCOLS = new Set(['http:', 'https:']);

function isSafeUrl(url) {
  if (!url) return false;
  try {
    const parsed = new URL(url);
    return ALLOWED_PROTOCOLS.has(parsed.protocol);
  } catch (e) {
    return false;
  }
}

function sanitizeHtml(html) {
  if (!html) return '';
  const $ = cheerio.load(html, { decodeEntities: false }, false);

  // Remove dangerous tags
  $('script, iframe, object, embed, applet, meta, link').remove();

  // Remove dangerous attributes
  $('*').each((i, el) => {
    const attribs = el.attribs;
    for (const attr in attribs) {
      if (attr.toLowerCase().startsWith('on')) {
        $(el).removeAttr(attr);
      } else if (attr.toLowerCase() === 'href') {
        if (!isSafeUrl(attribs[attr]) && !attribs[attr].startsWith('#') && !attribs[attr].startsWith('/')) {
           $(el).removeAttr(attr);
        }
      } else if (attr.toLowerCase() === 'src') {
        if (!validateImageUrl(attribs[attr])) {
          $(el).removeAttr(attr);
        }
      }
    }
  });

  return $.html();
}

function sanitizeCss(css) {
  if (!css) return '';
  // Basic CSS sanitization: remove behavior, expression
  let cleanCss = css.replace(/behavior\s*:/gi, 'ignore:');
  cleanCss = cleanCss.replace(/expression\s*\(/gi, 'ignore(');
  return cleanCss;
}

function validateImageUrl(url) {
  if (!url) return false;
  try {
    const parsed = new URL(url);
    return ALLOWED_PROTOCOLS.has(parsed.protocol);
  } catch (e) {
    return false;
  }
}

function getAiWorkspaceId(workspaceId, user) {
  if (!user) return workspaceId;
  
  const clientRoles = ['agency_client', 'brand_super_admin', 'brand_manager', 'brand_team_user', 'client'];
  if (clientRoles.includes(user.role)) {
    return user.brandId || user._id;
  }
  
  return user.agencyId || user._id;
}

async function getClaudeClient(workspaceId, user) {
  const aiWorkspaceId = getAiWorkspaceId(workspaceId, user);
  const settings = await AiSettings.findOne({ workspaceId: aiWorkspaceId });
  if (!settings) {
    throw new Error('AI Settings not found for this workspace. Please configure your Claude API key in AI Settings.');
  }

  let apiKey = null;
  let decryptionSuccessful = false;
  if (settings.anthropicApiKey) {
    try {
      apiKey = cryptoUtils.decrypt(settings.anthropicApiKey);
      decryptionSuccessful = Boolean(apiKey);
    } catch (e) {
      console.error("AI WEBSITE DECRYPTION ERROR:", e.message);
    }
  } else if (settings.contentAnthropicApiKey) {
    try {
      apiKey = cryptoUtils.decrypt(settings.contentAnthropicApiKey);
      decryptionSuccessful = Boolean(apiKey);
    } catch (e) {
      console.error("AI WEBSITE DECRYPTION ERROR:", e.message);
    }
  }

  console.log("=== AI WEBSITE KEY CHECK ===");
  console.log("hasAnthropicKey:", Boolean(settings.anthropicApiKey));
  console.log("hasContentAnthropicKey:", Boolean(settings.contentAnthropicApiKey));
  console.log("decryptionSuccessful:", decryptionSuccessful);
  console.log("============================");

  if (!apiKey) {
    throw new Error('Claude API key is not configured. Please configure your Claude API key in AI Settings.');
  }

  return {
    client: new AiClientWrapper(apiKey, 'anthropic'),
    model: settings.model || DEFAULT_AI_MODEL
  };
}

const SYSTEM_PROMPT = `You are an expert web designer, UX architect, and conversion copywriter.
Your task is to generate a complete, production-ready website based on the provided business details.

CRITICAL RULES:
1. Return strict JSON only. No markdown. No explanations. No code fences.
2. No Lorem Ipsum. No placeholder content. Generate real business-specific content using the supplied Industry, Business Description, and Tone.
3. Use remote image URLs only. Image URLs must be HTTP/HTTPS. No base64. No data URLs. No blob URLs. No local files.
4. HTML must be GrapesJS-compatible. Do not include <html>. Do not include <head>. Do not include <body>. Use semantic HTML.
5. CSS must be standalone. Do not use React. Do not use Vue. Do not use Tailwind. Do not use JavaScript. Do not use <script>.
6. Make the website responsive. Generate at least Home, About, and Contact.

EXPECTED JSON STRUCTURE:
{
  "site": {
    "title": "...",
    "tagline": "...",
    "primaryColor": "#...",
    "fontFamily": "..."
  },
  "pages": [
    {
      "title": "Home",
      "slug": "home",
      "isHome": true,
      "metaTitle": "...",
      "metaDescription": "...",
      "html": "...",
      "css": "..."
    },
  ]
}

IMPORTANT:
- Keep the HTML and CSS extremely concise to prevent truncation.
- Only generate the Home page unless the business brief explicitly demands multiple pages.
- Avoid repetitive CSS rules. You are constrained by strict token limits. Do not exceed 8000 tokens.`;

async function generateWebsite({ workspaceId, user, name, industry, businessBrief, tone }) {
  const { client, model } = await getClaudeClient(workspaceId, user);

  const prompt = `Please generate a website with the following details:
Website Name: ${name}
Industry: ${industry || 'General Business'}
Business Description: ${businessBrief}
Desired Tone: ${tone || 'Professional'}

Remember to return ONLY valid JSON.`;

  let responseText = null;

  const attemptGeneration = async (isRetry = false) => {
    const retryInstruction = isRetry ? '\n\nYOU FAILED PREVIOUSLY. Return ONLY one complete JSON object. Do not stop before all required pages are complete. Do not use markdown fences.' : '';
    const messages = [
      { role: 'system', content: SYSTEM_PROMPT + retryInstruction },
      { role: 'user', content: prompt }
    ];

    const res = await client.chat.completions.create({
      model,
      messages,
      max_tokens: 16000,
      timeout: 300000, // 5 minutes
      response_format: { type: 'json_object' }
    });

    console.log("=== AI WEBSITE CLAUDE RESPONSE ===");
    console.log("AI WEBSITE MODEL:", model);
    console.log("response exists:", !!res);
    console.log("choices:", res?.choices?.length);
    console.log("content type:", typeof res?.choices?.[0]?.message?.content);
    console.log("content length:", res?.choices?.[0]?.message?.content?.length);
    console.log("anthropic_metadata:", res?._anthropic);
    console.log("==================================");

    return res.choices[0].message.content;
  };

  try {
    responseText = await attemptGeneration(false);
  } catch (error) {
    throw new Error('Failed to generate website with Claude: ' + error.message);
  }

  // Parse JSON
  let websiteData = null;
  const parseJson = (text) => {
    let cleanText = text.trim();
    const firstBrace = cleanText.indexOf('{');
    const lastBrace = cleanText.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace >= firstBrace) {
      cleanText = cleanText.substring(firstBrace, lastBrace + 1);
    }
    return JSON.parse(cleanText);
  };

  if (!responseText) {
    throw new Error("Claude returned an empty response.");
  }

  if (typeof responseText !== "string") {
    throw new Error("Claude returned an unexpected response format.");
  }

  try {
    websiteData = parseJson(responseText);
  } catch (e) {
    require('fs').writeFileSync('ai_raw_response.txt', responseText);
    console.error("=== AI WEBSITE JSON PARSE ERROR ===");
    console.error("error:", e.message);
    console.error("response_length:", responseText?.length);
    console.error("response_start:", responseText?.slice(0, 500));
    console.error("response_end:", responseText?.slice(-1000));
    console.error("===================================");
    
    // Retry once
    try {
      responseText = await attemptGeneration(true);
      if (!responseText || typeof responseText !== "string") throw new Error("Invalid response format on retry");
      websiteData = parseJson(responseText);
    } catch (retryError) {
      require('fs').appendFileSync('ai_raw_response.txt', '\n\nRETRY:\n' + responseText);
      console.error("AI WEBSITE JSON PARSE ERROR (RETRY):", retryError.message);
      throw new Error('Claude returned invalid JSON structure. Please try again.');
    }
  }

  // Validate Structure
  if (!websiteData.site || !websiteData.pages || !Array.isArray(websiteData.pages)) {
    throw new Error('Claude returned an incomplete website structure. Please try again.');
  }

  const hasHome = websiteData.pages.some(p => p.slug === 'home' || p.isHome);
  if (!hasHome) {
    throw new Error('Claude did not generate the minimum required Home page. Please try again.');
  }

  console.log(
    "AI WEBSITE PAGES:",
    websiteData.pages.map(p => ({
      title: p.title,
      slug: p.slug,
      htmlLength: p.html?.length,
      cssLength: p.css?.length
    }))
  );

  // Sanitize
  websiteData.pages.forEach(page => {
    page.html = sanitizeHtml(page.html);
    page.css = sanitizeCss(page.css);
  });

  return websiteData;
}

module.exports = { 
  generateWebsite,
  getClaudeClient,
  sanitizeHtml,
  sanitizeCss,
  validateImageUrl,
  isSafeUrl
};
