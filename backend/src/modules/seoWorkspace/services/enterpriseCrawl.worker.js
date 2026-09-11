const axios = require('axios');
const cheerio = require('cheerio');
const robotsParser = require('robots-parser');
const WorkspaceAuditJob = require('../models/workspaceAuditJob.model');
const WorkspaceAuditQueue = require('../models/workspaceAuditQueue.model');
const WorkspaceAuditPage = require('../models/workspaceAuditPage.model');
const logger = require('../../aiCore/logger.service');

const TAG = 'EnterpriseCrawlWorker';
const USER_AGENT = 'SEO-Enterprise-Auditor/1.0';

class EnterpriseCrawlWorker {
  constructor() {
    this.isRunning = false;
    this.robotsCache = new Map(); // domain -> parsed robots
  }

  start() {
    if (this.isRunning) return;
    this.isRunning = true;
    this.poll();
  }

  stop() {
    this.isRunning = false;
  }

  normalizeUrl(urlStr) {
    try {
      const url = new URL(urlStr);
      // Remove hash
      url.hash = '';
      // Remove tracking parameters
      const paramsToRemove = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'gclid', 'fbclid'];
      paramsToRemove.forEach(p => url.searchParams.delete(p));
      // Remove trailing slash if path > 1
      let href = url.href;
      if (url.pathname !== '/' && href.endsWith('/')) {
        href = href.slice(0, -1);
      }
      return href;
    } catch (e) {
      return urlStr;
    }
  }

  async getRobotsTxt(domain) {
    if (this.robotsCache.has(domain)) return this.robotsCache.get(domain);

    const robotsUrl = `${domain.startsWith('http') ? domain : `https://${domain}`}/robots.txt`;
    let parsed = null;
    try {
      const res = await axios.get(robotsUrl, { timeout: 5000, validateStatus: () => true });
      if (res.status === 200) {
        parsed = robotsParser(robotsUrl, res.data);
      } else {
        parsed = robotsParser(robotsUrl, 'User-agent: *\nAllow: /');
      }
    } catch (e) {
      parsed = robotsParser(robotsUrl, 'User-agent: *\nAllow: /');
    }
    this.robotsCache.set(domain, parsed);
    return parsed;
  }

  async parseSitemap(job, domain) {
    const baseUrl = domain.startsWith('http') ? domain : `https://${domain}`;
    const potentialSitemaps = [
      `${baseUrl}/sitemap.xml`,
      `${baseUrl}/sitemap_index.xml`,
      `${baseUrl}/wp-sitemap.xml`
    ];

    const robots = await this.getRobotsTxt(domain);
    if (robots && robots.getSitemaps().length > 0) {
      potentialSitemaps.unshift(...robots.getSitemaps());
    }

    const urls = new Set();
    const checkedSitemaps = new Set();

    const fetchSitemap = async (sitemapUrl) => {
      if (checkedSitemaps.has(sitemapUrl)) return;
      checkedSitemaps.add(sitemapUrl);

      try {
        const res = await axios.get(sitemapUrl, { timeout: 10000, validateStatus: () => true });
        if (res.status === 200 && (res.headers['content-type']?.includes('xml') || res.data.includes('<?xml'))) {
          const $ = cheerio.load(res.data, { xmlMode: true });

          // Check for nested sitemaps (sitemapindex)
          $('sitemap loc').each((_, el) => {
            const nestedUrl = $(el).text().trim();
            if (nestedUrl) {
              fetchSitemap(nestedUrl); // Async fire-and-forget for nested
            }
          });

          // Check for actual page URLs
          const skipExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.svg', '.webp', '.mp4', '.webm', '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.zip', '.rar', '.exe', '.css', '.js', '.woff', '.woff2', '.ttf'];
          $('url loc').each((_, el) => {
            const rawUrl = $(el).text().trim();
            try {
              const urlObj = new URL(rawUrl);
              const pathname = urlObj.pathname.toLowerCase();
              if (!skipExtensions.some(ext => pathname.endsWith(ext))) {
                urls.add(this.normalizeUrl(rawUrl));
              }
            } catch (e) { }
          });
        }
      } catch (e) { }
    };

    try {
      // Try fetching sitemaps in order until we find URLs
      for (const sitemapUrl of potentialSitemaps) {
        if (urls.size === 0) {
          await fetchSitemap(sitemapUrl);
        }
      }

      let queuedCount = 0;
      for (const url of urls) {
        try {
          await WorkspaceAuditQueue.create({ jobId: job._id, url, depth: 1, status: 'pending' });
          queuedCount++;
        } catch (e) { } // ignore duplicates
      }

      if (queuedCount > 0) {
        await WorkspaceAuditJob.findByIdAndUpdate(job._id, {
          $inc: { 'progress.urlsDiscovered': queuedCount, 'progress.urlsRemaining': queuedCount }
        });
        logger.info(TAG, `Discovered ${queuedCount} URLs from sitemap(s) for ${domain}`);
      }
    } catch (e) {
      logger.warn(TAG, `Failed to parse sitemap for ${domain}: ${e.message}`);
    }
  }

  async poll() {
    while (this.isRunning) {
      try {
        const jobs = await WorkspaceAuditJob.find({ status: 'running' });
        if (jobs.length === 0) {
          await new Promise(r => setTimeout(r, 5000));
          continue;
        }

        await Promise.allSettled(jobs.map(job => this.processJobBatch(job)));
        await this.checkWatchdog(jobs);
      } catch (error) {
        logger.error(TAG, `Worker polling error: ${error.message}`);
        await new Promise(r => setTimeout(r, 5000));
      }
    }
  }

  async checkWatchdog(jobs) {
    for (const job of jobs) {
      // Check if job hasn't updated its last processed time recently
      const processingCount = await WorkspaceAuditQueue.countDocuments({ jobId: job._id, status: 'processing' });

      if (processingCount > 0) {
         // Watchdog: recover genuinely stuck items (e.g. over 5 minutes)
         const staleItems = await WorkspaceAuditQueue.find({ jobId: job._id, status: 'processing', updatedAt: { $lt: new Date(Date.now() - 300000) } });
         for (const item of staleItems) {
            logger.warn(TAG, `[SEO CRAWLER] WATCHDOG_RECOVERY ${item.url} - Stalled in processing`);
            item.status = 'failed';
            item.errorType = 'WATCHDOG_RECOVERY';
            item.error = 'Recovered by watchdog after stall';
            await item.save();
            await WorkspaceAuditJob.findByIdAndUpdate(job._id, { $inc: { 'progress.failedUrls': 1, 'progress.urlsRemaining': -1 } });
         }
      }
    }
  }

  async processJobBatch(job) {
    try {
      // 1. Enforce maxDuration budget
      const duration = Date.now() - new Date(job.startedAt).getTime();
      if (job.budgets && job.budgets.maxDuration && duration >= job.budgets.maxDuration) {
        await this.completeJob(job, 'budget_reached');
        return;
      }

      // 2. Fetch queue items honoring maxConcurrentRequests
      const queueItems = await WorkspaceAuditQueue.find({ jobId: job._id, status: 'pending' })
        .limit((job.budgets && job.budgets.maxConcurrentRequests) || 5);

      if (queueItems.length === 0) {
        const processingCount = await WorkspaceAuditQueue.countDocuments({ jobId: job._id, status: 'processing' });
        const pendingCount = await WorkspaceAuditQueue.countDocuments({ jobId: job._id, status: 'pending' });
        
        if (processingCount === 0 && pendingCount === 0) {
          // Deterministic completion: queue and processing are both zero
          const failedCount = (job.progress.failedUrls || 0) + (job.progress.timedOutUrls || 0);
          await this.completeJob(job, failedCount > 0 ? 'completed_with_warnings' : 'completed');
        }
        return;
      }

      const itemIds = queueItems.map(q => q._id);
      await WorkspaceAuditQueue.updateMany({ _id: { $in: itemIds } }, { $set: { status: 'processing', updatedAt: new Date() } });

      const startBatch = Date.now();

      // Process URLs concurrently safely
      await Promise.allSettled(queueItems.map(item => this.processUrl(job, item)));

      const endBatch = Date.now();
      const durationMs = endBatch - startBatch;
      if (durationMs > 0) {
        const pagesPerSecond = Math.round((queueItems.length / (durationMs / 1000)) * 10) / 10;
        await WorkspaceAuditJob.findByIdAndUpdate(job._id, { $set: { 'progress.pagesPerSecond': pagesPerSecond } });
      }

      // Honor requestsPerSecond
      const rps = (job.budgets && job.budgets.requestsPerSecond) || 5;
      const minBatchTime = (queueItems.length / rps) * 1000;
      if (durationMs < minBatchTime) {
        await new Promise(r => setTimeout(r, minBatchTime - durationMs));
      }
    } catch (e) {
      logger.error(TAG, `Error processing batch for job ${job._id}: ${e.message}`);
    }
  }

  async completeJob(job, finalStatus) {
    logger.info(TAG, `[SEO CRAWLER] JOB COMPLETED ${job._id} with status ${finalStatus}`);
    
    if (finalStatus === 'budget_reached' || finalStatus === 'completed' || finalStatus === 'completed_with_warnings') {
      job.status = 'synthesizing';
      job.progress.currentStage = 'AI Synthesis & Verification';
      await job.save();

      try {
        const seoAuditorAgent = require('./seoAuditorAgent.service');
        await seoAuditorAgent.synthesizeSiteAudit(job._id);
        
        job.status = finalStatus;
        job.progress.currentStage = 'Done';
        job.completedAt = new Date();
        await job.save();
      } catch(err) {
        logger.error(TAG, `Failed to synthesize site audit for job ${job._id}: ${err.message}`);
        job.status = 'failed';
        job.error = err.message;
        await job.save();
      }
    } else {
      job.status = finalStatus;
      job.completedAt = new Date();
      await job.save();
    }
    
    this.robotsCache.clear();
  }

  async processUrl(job, queueItem) {
    const startMs = Date.now();
    let finalQueueStatus = 'failed';
    let isTimeout = false;
    let urlError = null;
    let errorType = null;
    let skipped = false;
    
    // Create an explicit abort controller for this URL request
    const abortController = new AbortController();
    const timeoutId = setTimeout(() => abortController.abort('REQUEST_TIMEOUT'), 30000); // Strict 30s max duration

    logger.info(TAG, `[SEO CRAWLER] START URL ${queueItem.url}`);

    try {
      if (job.budgets.maxPages && job.progress.urlsCrawled >= job.budgets.maxPages) {
        finalQueueStatus = 'skipped';
        skipped = true;
        return;
      }

      const urlObj = new URL(queueItem.url);

      // Attempt sitemap parse if this is depth 0
      if (queueItem.depth === 0) {
        const jobWithSignal = { ...job.toObject(), _id: job._id, budgets: job.budgets, progress: job.progress, projectId: job.projectId, abortController };
        await this.parseSitemap(jobWithSignal, urlObj.origin);
      }

      const robots = await this.getRobotsTxt(urlObj.origin);
      if (robots && !robots.isAllowed(queueItem.url, USER_AGENT)) {
        finalQueueStatus = 'skipped';
        skipped = true;
        return;
      }

      await WorkspaceAuditJob.findByIdAndUpdate(job._id, {
        $set: {
          'progress.currentUrl': queueItem.url,
          'progress.currentStage': 'Crawling',
          'progress.currentAnalyzer': 'HTML/DOM Parser'
        }
      });

      const skipExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.svg', '.webp', '.mp4', '.webm', '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.zip', '.rar', '.exe', '.css', '.js', '.woff', '.woff2', '.ttf'];
      const pathname = urlObj.pathname.toLowerCase();
      if (skipExtensions.some(ext => pathname.endsWith(ext))) {
        finalQueueStatus = 'skipped';
        skipped = true;
        return;
      }

      const res = await axios.get(queueItem.url, {
        timeout: 15000,
        maxRedirects: 5,
        headers: { 'User-Agent': USER_AGENT },
        validateStatus: () => true,
        signal: abortController.signal
      });
      const endMs = Date.now();

      const contentType = res.headers['content-type'] || '';
      const isHtml = contentType.toLowerCase().includes('html');

      const auditPage = new WorkspaceAuditPage({
        projectId: job.projectId,
        jobId: job._id,
        url: queueItem.url,
        statusCode: res.status,
        redirectUrl: res.request?.res?.responseUrl !== queueItem.url ? this.normalizeUrl(res.request?.res?.responseUrl) : null,
        responseTimeMs: endMs - startMs,
        contentType,
        contentLength: parseInt(res.headers['content-length'] || 0, 10),
        etag: res.headers['etag'],
        lastModified: res.headers['last-modified'],
        findings: []
      });

      if (auditPage.redirectUrl) {
        // Queue the redirected URL
        try {
          await WorkspaceAuditQueue.create({ jobId: job._id, url: auditPage.redirectUrl, depth: queueItem.depth, status: 'pending' });
          await WorkspaceAuditJob.findByIdAndUpdate(job._id, { $inc: { 'progress.urlsDiscovered': 1, 'progress.urlsRemaining': 1 } });
        } catch (e) { }
      }

      // Security Headers Check
      auditPage.securityHeaders = {
        hsts: !!res.headers['strict-transport-security'],
        csp: !!res.headers['content-security-policy'],
        xFrameOptions: res.headers['x-frame-options'] || null
      };

      if (isHtml) {
        this.parseHtmlAssets(res.data, auditPage);
      }

      // Generate Deterministic Issues
      this.generateDeterministicIssues(auditPage);

      await auditPage.save();
      finalQueueStatus = 'completed';

      // Enqueue internal links (if HTML and within depth limit)
      // Do not enqueue if canonical points elsewhere (avoid dupes)
      const shouldCrawlLinks = isHtml && (!job.budgets.maxDepth || queueItem.depth < job.budgets.maxDepth);
      if (shouldCrawlLinks) {
        const canonical = auditPage.canonical ? this.normalizeUrl(auditPage.canonical) : null;
        if (!canonical || canonical === queueItem.url) {
          await this.enqueueInternalLinks(job, queueItem, res.data);
        }
      }

    } catch (error) {
      urlError = error.message;

      if (axios.isCancel(error) || error.message === 'REQUEST_TIMEOUT' || error.code === 'ECONNABORTED' || error.name === 'AbortError') {
        errorType = 'REQUEST_TIMEOUT';
        isTimeout = true;
      } else if (error.code === 'ECONNRESET') {
        errorType = 'CONNECTION_RESET';
      } else if (error.code === 'ENOTFOUND' || error.code === 'EAI_AGAIN') {
        errorType = 'DNS_ERROR';
      } else {
        errorType = 'HTTP_FAILURE';
      }

      queueItem.retryCount += 1;

      // Retry policy
      const transientErrors = ['REQUEST_TIMEOUT', 'CONNECTION_RESET', 'HTTP_FAILURE'];
      if (queueItem.retryCount < 2 && transientErrors.includes(errorType)) {
        finalQueueStatus = 'pending';
      } else {
        finalQueueStatus = isTimeout ? 'timed_out' : 'failed';
      }
    } finally {
      clearTimeout(timeoutId);

      queueItem.status = finalQueueStatus;
      if (urlError) queueItem.error = urlError;
      if (errorType) queueItem.errorType = errorType;
      queueItem.durationMs = Date.now() - startMs;
      await queueItem.save();

      if (finalQueueStatus === 'completed') {
        logger.info(TAG, `[SEO CRAWLER] SUCCESS URL ${queueItem.url}`);
        await WorkspaceAuditJob.findByIdAndUpdate(job._id, { $inc: { 'progress.urlsCrawled': 1, 'progress.urlsRemaining': -1 } });
      } else if (finalQueueStatus === 'skipped') {
        await WorkspaceAuditJob.findByIdAndUpdate(job._id, { $inc: { 'progress.urlsSkipped': 1, 'progress.urlsRemaining': -1 } });
      } else if (finalQueueStatus === 'pending') {
        logger.info(TAG, `[SEO CRAWLER] RETRY URL ${queueItem.url} (Attempt ${queueItem.retryCount})`);
      } else if (finalQueueStatus === 'timed_out') {
        logger.warn(TAG, `[SEO CRAWLER] TIMEOUT URL ${queueItem.url} (${queueItem.durationMs}ms)`);
        await WorkspaceAuditJob.findByIdAndUpdate(job._id, { $inc: { 'progress.timedOutUrls': 1, 'progress.urlsRemaining': -1 } });
      } else if (finalQueueStatus === 'failed') {
        logger.warn(TAG, `[SEO CRAWLER] FAILURE URL ${queueItem.url} - ${errorType}`);
        await WorkspaceAuditJob.findByIdAndUpdate(job._id, { $inc: { 'progress.failedUrls': 1, 'progress.urlsRemaining': -1 } });
      }
    }
  }

  parseHtmlAssets(html, auditPage) {
    const $ = cheerio.load(html);

    auditPage.title = $('title').first().text().trim() || null;
    auditPage.titleLength = auditPage.title ? auditPage.title.length : 0;
    auditPage.metaDescription = $('meta[name="description" i]').attr('content')?.trim() || null;

    $('h1, h2, h3, h4, h5, h6').each((_, el) => {
      const tag = el.tagName.toLowerCase();
      const text = $(el).text().replace(/\s+/g, ' ').trim();
      if (text && auditPage[tag]) auditPage[tag].push(text);
    });

    auditPage.canonical = $('link[rel="canonical" i]').attr('href')?.trim() || null;
    auditPage.robots = $('meta[name="robots" i]').attr('content')?.trim() || null;
    auditPage.viewport = $('meta[name="viewport" i]').attr('content')?.trim() || null;
    auditPage.language = $('html').attr('lang')?.trim() || null;
    auditPage.charset = $('meta[charset]').attr('charset')?.trim() || $('meta[http-equiv="Content-Type" i]').attr('content')?.trim() || null;

    // Structured Data
    auditPage.structuredData = [];
    $('script[type="application/ld+json"]').each((_, el) => {
      try {
        const json = JSON.parse($(el).html());
        auditPage.structuredData.push(json);
      } catch (e) { }
    });

    auditPage.openGraph = {
      title: $('meta[property="og:title"]').attr('content'),
      description: $('meta[property="og:description"]').attr('content'),
      image: $('meta[property="og:image"]').attr('content')
    };
    auditPage.twitterCard = {
      title: $('meta[name="twitter:title"]').attr('content'),
      description: $('meta[name="twitter:description"]').attr('content'),
      card: $('meta[name="twitter:card"]').attr('content')
    };

    $('script, style, noscript').remove();
    const text = $('body').text().replace(/\s+/g, ' ').trim();
    auditPage.wordCount = text.split(' ').filter(w => w.length > 0).length;

    // Images
    $('img').each((_, el) => {
      const src = $(el).attr('src') || $(el).attr('data-src');
      if (src && !src.startsWith('data:')) {
        const alt = $(el).attr('alt');
        auditPage.images.push({ src: this.normalizeUrl(src), alt });
      }
    });

    // Links
    const host = new URL(auditPage.url).hostname.replace(/^www\./, '');
    $('a[href]').each((_, el) => {
      const href = $(el).attr('href');
      if (href && !href.startsWith('javascript:') && !href.startsWith('mailto:')) {
        try {
          const absolute = new URL(href, auditPage.url).href.split('#')[0];
          const isInternal = new URL(absolute).hostname.replace(/^www\./, '') === host;
          auditPage.links.push({ href: this.normalizeUrl(absolute), text: $(el).text().trim(), isInternal });
        } catch (e) { }
      }
    });
  }

  generateDeterministicIssues(auditPage) {
    const addIssue = (category, severity, issue, rootCause, techFix) => {
      auditPage.findings.push({
        issueId: `${category.toLowerCase()}_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
        category,
        severity,
        issue,
        affectedUrl: auditPage.url,
        evidence: { url: auditPage.url },
        rootCause,
        suggestedTechnicalFix: techFix,
        expectedSeoImpact: severity === 'critical' ? 'High' : severity === 'high' ? 'Medium' : 'Low',
        estimatedDifficulty: 'Low',
        taskType: 'Technical Fix'
      });
    };

    // Technical
    if (auditPage.statusCode >= 400) {
      addIssue('Technical', 'critical', `HTTP ${auditPage.statusCode} Error`, `The server returned a ${auditPage.statusCode} status code.`, 'Fix the broken link or restore the page.');
    }
    if (auditPage.redirectUrl) {
      addIssue('Technical', 'low', 'Page redirects', `URL redirects to ${auditPage.redirectUrl}`, 'Update internal links to point directly to the final destination.');
    }

    // Content
    if (!auditPage.title && auditPage.statusCode === 200) {
      addIssue('Content', 'high', 'Missing Title Tag', 'The <title> element is missing or empty.', 'Add a descriptive <title> element.');
    } else if (auditPage.titleLength > 70) {
      addIssue('Content', 'medium', 'Title Tag too long', 'The <title> is longer than 70 characters.', 'Keep title tags under 60-70 characters.');
    }

    if (!auditPage.metaDescription && auditPage.statusCode === 200) {
      addIssue('Content', 'medium', 'Missing Meta Description', 'The <meta name="description"> is missing.', 'Add a compelling meta description.');
    }

    if (!auditPage.h1 || auditPage.h1.length === 0) {
      addIssue('Content', 'high', 'Missing H1 Tag', 'No <h1> heading found on the page.', 'Add exactly one <h1> heading describing the page content.');
    } else if (auditPage.h1.length > 1) {
      addIssue('Content', 'medium', 'Multiple H1 Tags', `Found ${auditPage.h1.length} <h1> tags.`, 'Ensure only one <h1> tag is used per page.');
    }

    if (auditPage.wordCount !== undefined && auditPage.wordCount < 300 && auditPage.statusCode === 200) {
      addIssue('Content', 'low', 'Thin Content', `Page has only ${auditPage.wordCount} words of text.`, 'Add more valuable content to satisfy user intent.');
    }

    // Images
    const missingAlt = auditPage.images.filter(i => !i.alt || i.alt.trim() === '');
    if (missingAlt.length > 0) {
      addIssue('Images', 'medium', 'Missing Image ALT Attributes', `${missingAlt.length} images are missing alt text.`, 'Add descriptive alt="" attributes to all functional images.');
    }

    // Performance
    if (auditPage.responseTimeMs > 1500) {
      addIssue('Performance', 'high', 'Slow Server Response', `Response time was ${auditPage.responseTimeMs}ms.`, 'Optimize server response time (TTFB).');
    }

    // Accessibility/Mobile
    if (!auditPage.viewport && auditPage.statusCode === 200) {
      addIssue('Accessibility', 'high', 'Missing Viewport Meta Tag', 'The <meta name="viewport"> tag is missing.', 'Add <meta name="viewport" content="width=device-width, initial-scale=1">.');
    }
    if (!auditPage.language && auditPage.statusCode === 200) {
      addIssue('Accessibility', 'medium', 'Missing HTML Lang Attribute', 'The <html lang="..."> attribute is missing.', 'Declare the page language, e.g., <html lang="en">.');
    }

    // Security
    if (auditPage.url.startsWith('https:')) {
      if (!auditPage.securityHeaders.hsts) {
        addIssue('Security', 'low', 'Missing HSTS Header', 'Strict-Transport-Security header is not set.', 'Configure server to send HSTS header.');
      }
    } else {
      addIssue('Security', 'high', 'Not Using HTTPS', 'Page is served over insecure HTTP.', 'Migrate to HTTPS immediately.');
    }

    // Indexability
    if (auditPage.robots && auditPage.robots.toLowerCase().includes('noindex')) {
      addIssue('Indexability', 'medium', 'Page blocked by noindex', 'Meta robots contains noindex.', 'Remove noindex directive if page should be indexed.');
    }
  }

  async enqueueInternalLinks(job, parentQueueItem, html) {
    const $ = cheerio.load(html);
    const host = new URL(parentQueueItem.url).hostname.replace(/^www\./, '');
    const newLinks = new Set();

    // Ignored extensions
    const skipExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.svg', '.webp', '.mp4', '.webm', '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.zip', '.rar', '.exe', '.css', '.js', '.woff', '.woff2', '.ttf'];

    $('a[href]').each((_, el) => {
      const href = $(el).attr('href');
      if (href && !href.startsWith('mailto:') && !href.startsWith('tel:') && !href.startsWith('javascript:')) {
        try {
          const absoluteUrl = new URL(href, parentQueueItem.url).href.split('#')[0];
          const urlObj = new URL(absoluteUrl);

          const pathname = urlObj.pathname.toLowerCase();
          const hasSkipExt = skipExtensions.some(ext => pathname.endsWith(ext));

          if (['http:', 'https:'].includes(urlObj.protocol) && urlObj.hostname.replace(/^www\./, '') === host && !hasSkipExt) {
            newLinks.add(this.normalizeUrl(absoluteUrl));
          }
        } catch (e) { }
      }
    });

    let queuedCount = 0;
    for (const link of newLinks) {
      try {
        await WorkspaceAuditQueue.create({
          jobId: job._id,
          url: link,
          depth: parentQueueItem.depth + 1,
          status: 'pending'
        });
        queuedCount++;
      } catch (err) {
        // Ignored E11000 (duplicate queue item)
      }
    }

    if (queuedCount > 0) {
      await WorkspaceAuditJob.findByIdAndUpdate(job._id, {
        $inc: { 'progress.urlsDiscovered': queuedCount, 'progress.urlsRemaining': queuedCount }
      });
    }
  }
}

const enterpriseCrawlWorker = new EnterpriseCrawlWorker();

if (process.env.NODE_ENV !== 'test') {
  enterpriseCrawlWorker.start();
}

module.exports = enterpriseCrawlWorker;
