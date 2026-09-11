const mongoose = require('mongoose');

const workspaceAuditPageSchema = new mongoose.Schema({
  projectId: { type: mongoose.Schema.Types.ObjectId, ref: 'WorkspaceProject', required: true, index: true },
  jobId: { type: mongoose.Schema.Types.ObjectId, ref: 'WorkspaceAuditJob', required: true, index: true },
  url: { type: String, required: true },
  
  // HTTP / Network
  statusCode: { type: Number },
  redirectUrl: { type: String },
  responseTimeMs: { type: Number },
  contentType: { type: String },
  contentLength: { type: Number },
  etag: { type: String },
  lastModified: { type: String },

  // HTML Structure
  title: { type: String },
  titleLength: { type: Number },
  metaDescription: { type: String },
  h1: { type: [String], default: [] },
  h2: { type: [String], default: [] },
  h3: { type: [String], default: [] },
  h4: { type: [String], default: [] },
  h5: { type: [String], default: [] },
  h6: { type: [String], default: [] },
  canonical: { type: String },
  robots: { type: String },
  wordCount: { type: Number },
  viewport: { type: String },
  language: { type: String },
  charset: { type: String },
  securityHeaders: mongoose.Schema.Types.Mixed,
  
  // Extended Assets
  images: [{
    src: String,
    alt: String,
    isLazyLoaded: { type: Boolean, default: false },
    isLcpCandidate: { type: Boolean, default: false }
  }],
  links: [{
    href: String,
    text: String,
    isInternal: Boolean
  }],
  structuredData: [mongoose.Schema.Types.Mixed],
  openGraph: mongoose.Schema.Types.Mixed,
  twitterCard: mongoose.Schema.Types.Mixed,

  // Performance (Core Web Vitals) - measured if possible
  performance: {
    lcp: { type: Number, default: null }, // in ms
    lcpBreakdown: {
      ttfb: { type: Number, default: null },
      resourceLoadDelay: { type: Number, default: null },
      resourceLoadTime: { type: Number, default: null },
      renderDelay: { type: Number, default: null }
    },
    inp: { type: Number, default: null },
    cls: { type: Number, default: null },
    ttfb: { type: Number, default: null },
    fcp: { type: Number, default: null },
    isMeasured: { type: Boolean, default: false }
  },

  // SEO Analysis Checks (populated natively during crawl)
  checks: {
    isIndexable: { type: Boolean, default: true },
    isNoindex: { type: Boolean, default: false },
    isRobotsBlocked: { type: Boolean, default: false },
    canonicalMismatch: { type: Boolean, default: false },
    isStagingOrDev: { type: Boolean, default: false },
    missingTitle: { type: Boolean, default: false },
    missingDescription: { type: Boolean, default: false },
    missingH1: { type: Boolean, default: false },
    multipleH1: { type: Boolean, default: false },
    thinContent: { type: Boolean, default: false },
    brokenLinksCount: { type: Number, default: 0 },
    missingAltCount: { type: Number, default: 0 }
  },
  
  // Deterministic Issues found on this page
  findings: [mongoose.Schema.Types.Mixed]
}, { timestamps: true });

workspaceAuditPageSchema.index({ jobId: 1, url: 1 }, { unique: true });
// For incremental checks across runs
workspaceAuditPageSchema.index({ projectId: 1, url: 1 });

module.exports = mongoose.model('WorkspaceAuditPage', workspaceAuditPageSchema);
