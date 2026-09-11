const skillLoader = require('../seoWorkspace/services/skillLoader.service');
const { DEFAULT_AI_PROVIDER, DEFAULT_AI_MODEL } = require('./config/aiDefaults');

/**
 * Default SEO agent registry.
 * All agents use the platform-wide AI provider and model from aiDefaults.js.
 * Nothing in this file should hardcode 'openai', 'anthropic', or any specific
 * model string — use DEFAULT_AI_PROVIDER / DEFAULT_AI_MODEL instead.
 */
const DEFAULT_AGENTS = {
  'seo-strategist': {
    key: 'seo-strategist',
    displayName: 'SEO Strategist',
    skills: ['keyword-research', 'content-gap-analysis', 'serp-intent-mapping', 'roadmap-roi-planning'],
    modelProvider: DEFAULT_AI_PROVIDER,
    modelName: DEFAULT_AI_MODEL,
    isSystemDefault: true
  },
  'seo-tech-implementer': {
    key: 'seo-tech-implementer',
    displayName: 'SEO Tech Implementer',
    skills: ['content-brief-generation', 'topic-clustering'],
    modelProvider: DEFAULT_AI_PROVIDER,
    modelName: DEFAULT_AI_MODEL,
    isSystemDefault: true
  },
  'seo-reporter': {
    key: 'seo-reporter',
    displayName: 'SEO Reporter',
    skills: ['seo-report-writing', 'executive-summary'],
    modelProvider: DEFAULT_AI_PROVIDER,
    modelName: DEFAULT_AI_MODEL,
    isSystemDefault: true
  },
  'seo-monitor': {
    key: 'seo-monitor',
    displayName: 'SEO Monitor',
    skills: ['rank-tracking', 'alert-configuration'],
    modelProvider: DEFAULT_AI_PROVIDER,
    modelName: DEFAULT_AI_MODEL,
    isSystemDefault: true
  },
  'seo-auditor': {
    key: 'seo-auditor',
    displayName: 'SEO Auditor',
    skills: ['technical-seo-audit-analysis', 'audit-severity-prioritization'],
    modelProvider: DEFAULT_AI_PROVIDER,
    modelName: DEFAULT_AI_MODEL,
    isSystemDefault: true
  },
  'keyword-research': {
    key: 'keyword-research',
    displayName: 'Keyword Research',
    skills: ['keyword-opportunity-scoring', 'keyword-intent-classification', 'google-keyword-allocation-logic'],
    modelProvider: DEFAULT_AI_PROVIDER,
    modelName: DEFAULT_AI_MODEL,
    isSystemDefault: true
  },
  'competitor-agent': {
    key: 'competitor-agent',
    displayName: 'Competitor Agent',
    skills: ['competitor-threat-assessment', 'competitive-gap-analysis'],
    modelProvider: DEFAULT_AI_PROVIDER,
    modelName: DEFAULT_AI_MODEL,
    isSystemDefault: true
  },
  'technical-seo-agent': {
    key: 'technical-seo-agent',
    displayName: 'Technical SEO Agent',
    skills: ['technical-infrastructure-audit', 'audit-severity-prioritization'],
    modelProvider: DEFAULT_AI_PROVIDER,
    modelName: DEFAULT_AI_MODEL,
    isSystemDefault: true
  },
  'content-agent': {
    key: 'content-agent',
    displayName: 'Content Agent',
    skills: ['content-brief-generation', 'topic-clustering'],
    modelProvider: DEFAULT_AI_PROVIDER,
    modelName: DEFAULT_AI_MODEL,
    isSystemDefault: true
  },
  'schema-agent': {
    key: 'schema-agent',
    displayName: 'Schema Agent',
    skills: ['schema-markup-generation', 'schema-validation'],
    modelProvider: DEFAULT_AI_PROVIDER,
    modelName: DEFAULT_AI_MODEL,
    isSystemDefault: true
  },
  'internal-linking-agent': {
    key: 'internal-linking-agent',
    displayName: 'Internal Linking Agent',
    skills: ['internal-linking-strategy', 'orphan-page-detection'],
    modelProvider: DEFAULT_AI_PROVIDER,
    modelName: DEFAULT_AI_MODEL,
    isSystemDefault: true
  },
  'image-seo-agent': {
    key: 'image-seo-agent',
    displayName: 'Image SEO Agent',
    skills: ['image-alt-text-optimization', 'image-file-seo'],
    modelProvider: DEFAULT_AI_PROVIDER,
    modelName: DEFAULT_AI_MODEL,
    isSystemDefault: true
  },
  'website-builder-seo-agent': {
    key: 'website-builder-seo-agent',
    displayName: 'Website Builder SEO Agent',
    skills: ['builder-onpage-metadata-optimization', 'builder-heading-structure-audit'],
    modelProvider: DEFAULT_AI_PROVIDER,
    modelName: DEFAULT_AI_MODEL,
    isSystemDefault: true
  },
  'blog-seo-agent': {
    key: 'blog-seo-agent',
    displayName: 'Blog SEO Agent',
    skills: ['builder-onpage-metadata-optimization', 'builder-heading-structure-audit'],
    modelProvider: DEFAULT_AI_PROVIDER,
    modelName: DEFAULT_AI_MODEL,
    isSystemDefault: true
  },
  'store-seo-agent': {
    key: 'store-seo-agent',
    displayName: 'Store SEO Agent',
    skills: ['builder-onpage-metadata-optimization', 'technical-infrastructure-audit'],
    modelProvider: DEFAULT_AI_PROVIDER,
    modelName: DEFAULT_AI_MODEL,
    isSystemDefault: true
  },
  'automation-agent': {
    key: 'automation-agent',
    displayName: 'Automation Agent',
    skills: ['alert-configuration', 'executive-summary'],
    modelProvider: DEFAULT_AI_PROVIDER,
    modelName: DEFAULT_AI_MODEL,
    isSystemDefault: true
  },
  'aeo-agent': {
    key: 'aeo-agent',
    displayName: 'AEO Agent',
    skills: ['answer-extractability-optimization', 'ai-citation-readiness'],
    modelProvider: DEFAULT_AI_PROVIDER,
    modelName: DEFAULT_AI_MODEL,
    isSystemDefault: true
  },
  'geo-agent': {
    key: 'geo-agent',
    displayName: 'GEO Agent',
    skills: ['entity-schema-consistency', 'ai-citation-readiness'],
    modelProvider: DEFAULT_AI_PROVIDER,
    modelName: DEFAULT_AI_MODEL,
    isSystemDefault: true
  },
  'competitor-intelligence-agent': {
    key: 'competitor-intelligence-agent',
    displayName: 'Competitor Intelligence Agent',
    skills: ['competitive-gap-analysis'],
    modelProvider: DEFAULT_AI_PROVIDER,
    modelName: DEFAULT_AI_MODEL,
    isSystemDefault: true
  },

  // --- ContentAI generator agents (content-ai-platform-architecture.md §4) ---
  'content-landing-page-writer': {
    key: 'content-landing-page-writer',
    displayName: 'Landing Page Writer',
    skills: ['landing-page-copywriting', 'brand-voice-alignment'],
    modelProvider: DEFAULT_AI_PROVIDER,
    modelName: DEFAULT_AI_MODEL,
    isSystemDefault: true
  },
  'content-blog-writer': {
    key: 'content-blog-writer',
    displayName: 'Blog Writer',
    skills: ['blog-longform-writing', 'brand-voice-alignment'],
    modelProvider: DEFAULT_AI_PROVIDER,
    modelName: DEFAULT_AI_MODEL,
    isSystemDefault: true
  },
  'content-product-writer': {
    key: 'content-product-writer',
    displayName: 'Product Writer',
    skills: ['product-commerce-copywriting', 'brand-voice-alignment'],
    modelProvider: DEFAULT_AI_PROVIDER,
    modelName: DEFAULT_AI_MODEL,
    isSystemDefault: true
  },
  'content-category-writer': {
    key: 'content-category-writer',
    displayName: 'Category Writer',
    skills: ['category-copywriting', 'brand-voice-alignment'],
    modelProvider: DEFAULT_AI_PROVIDER,
    modelName: DEFAULT_AI_MODEL,
    isSystemDefault: true
  },
  'content-faq-generator': {
    key: 'content-faq-generator',
    displayName: 'FAQ Generator',
    skills: ['faq-generation'],
    modelProvider: DEFAULT_AI_PROVIDER,
    modelName: DEFAULT_AI_MODEL,
    isSystemDefault: true
  },
  'content-meta-generator': {
    key: 'content-meta-generator',
    displayName: 'Meta Generator',
    // Reuses the existing seoWorkspace skill — not duplicated here a second time.
    skills: ['builder-onpage-metadata-optimization'],
    modelProvider: DEFAULT_AI_PROVIDER,
    modelName: DEFAULT_AI_MODEL,
    isSystemDefault: true
  },
  'content-og-generator': {
    key: 'content-og-generator',
    displayName: 'Open Graph Generator',
    skills: ['builder-onpage-metadata-optimization', 'brand-voice-alignment'],
    modelProvider: DEFAULT_AI_PROVIDER,
    modelName: DEFAULT_AI_MODEL,
    isSystemDefault: true
  },
  'content-schema-generator': {
    key: 'content-schema-generator',
    displayName: 'Schema Generator',
    // Reuses the existing seoWorkspace skill — not duplicated here a second time.
    skills: ['schema-markup-generation'],
    modelProvider: DEFAULT_AI_PROVIDER,
    modelName: DEFAULT_AI_MODEL,
    isSystemDefault: true
  },
  'content-alt-text-generator': {
    key: 'content-alt-text-generator',
    displayName: 'Alt Text Generator',
    // Reuses the existing seoWorkspace skill — not duplicated here a second time.
    skills: ['image-alt-text-optimization'],
    modelProvider: DEFAULT_AI_PROVIDER,
    modelName: DEFAULT_AI_MODEL,
    isSystemDefault: true
  },
  'content-cta-generator': {
    key: 'content-cta-generator',
    displayName: 'CTA Generator',
    skills: ['cta-writing', 'brand-voice-alignment'],
    modelProvider: DEFAULT_AI_PROVIDER,
    modelName: DEFAULT_AI_MODEL,
    isSystemDefault: true
  },
  'content-internal-link-generator': {
    key: 'content-internal-link-generator',
    displayName: 'Internal Link Generator',
    skills: ['internal-linking'],
    modelProvider: DEFAULT_AI_PROVIDER,
    modelName: DEFAULT_AI_MODEL,
    isSystemDefault: true
  },
  'content-rewriter': {
    key: 'content-rewriter',
    displayName: 'Content Rewriter',
    skills: ['content-rewriting', 'brand-voice-alignment'],
    modelProvider: DEFAULT_AI_PROVIDER,
    modelName: DEFAULT_AI_MODEL,
    isSystemDefault: true
  },
  'content-expander': {
    key: 'content-expander',
    displayName: 'Content Expander',
    skills: ['content-expansion', 'brand-voice-alignment'],
    modelProvider: DEFAULT_AI_PROVIDER,
    modelName: DEFAULT_AI_MODEL,
    isSystemDefault: true
  },
  'tone-optimizer': {
    key: 'tone-optimizer',
    displayName: 'Tone Optimizer',
    skills: ['tone-adaptation', 'brand-voice-alignment'],
    modelProvider: DEFAULT_AI_PROVIDER,
    modelName: DEFAULT_AI_MODEL,
    isSystemDefault: true
  }
};

/**
 * @param {string} agentKey
 * @param {Function} [overrideLookupFn] 
 */
async function resolve(agentKey, overrideLookupFn = null) {
  const base = DEFAULT_AGENTS[agentKey];
  if (!base) {
    throw new Error(`AgentLoader: unknown agentKey "${agentKey}". Known keys: ${Object.keys(DEFAULT_AGENTS).join(', ')}`);
  }

  let config = { ...base };
  if (typeof overrideLookupFn === 'function') {
    const override = await overrideLookupFn(agentKey);
    if (override) config = { ...config, ...override };
  }

  return config;
}

function loadSkillsForAgent(agentConfig) {
  return skillLoader.loadSkillsForAgent(agentConfig.skills || [], agentConfig.key);
}

function listKnownAgentKeys() {
  return Object.keys(DEFAULT_AGENTS);
}

module.exports = { resolve, loadSkillsForAgent, listKnownAgentKeys, DEFAULT_AGENTS };