const AutomationTemplate = require('../models/automationTemplate.model');
const logger = require('../../aiCore/logger.service');

const TAG = 'AutomationTemplatesSeeder';

const ENTERPRISE_TEMPLATES = [
  {
    name: 'Daily 19:00 Site Audit & Multi-Channel Alert',
    description: 'Runs an automated end-to-end website crawl and technical SEO audit daily at 19:00 UTC for {{project.domain}}, logs the snapshot to the workspace database, and sends executive PDF digests to Email and Slack.',
    category: 'Website Audit',
    tags: ['Site Audit', 'Daily', 'Scheduled', 'Email', 'Slack', 'Executive'],
    difficulty: 'Intermediate',
    icon: 'activity',
    nodes: [
      {
        id: 'node-1',
        type: 'trigger',
        position: { x: 250, y: 50 },
        data: {
          label: 'Daily 19:00 Schedule',
          subtitle: 'Cron: 0 19 * * * (UTC)',
          type: 'trigger',
          subtype: 'schedule_cron',
          config: { cron: '0 19 * * *', timezone: 'UTC' }
        }
      },
      {
        id: 'node-2',
        type: 'action',
        position: { x: 250, y: 180 },
        data: {
          label: 'Run Website Audit',
          subtitle: 'Deep crawl {{project.domain}}',
          type: 'action',
          subtype: 'run_site_audit',
          config: {
            targetDomain: '{{project.domain}}',
            maxPages: 25,
            crawlDepth: 3,
            jsRendering: false,
            deviceType: 'desktop',
            storeResults: true
          }
        }
      },
      {
        id: 'node-3',
        type: 'action',
        position: { x: 100, y: 320 },
        data: {
          label: 'Send Email Digest',
          subtitle: 'Executive Summary to SEO Team',
          type: 'action',
          subtype: 'send_email_digest',
          config: {
            channel: 'email',
            title: 'Daily Site Audit: {{project.domain}} - {{date}}',
            recipient: 'seo-team@company.com',
            message: 'Daily 19:00 Site Audit completed for {{project.domain}}.\nOverall Score: {{steps.run_site_audit.score}}/100\nPages Crawled: {{steps.run_site_audit.pagesCrawled}}\nFindings: {{steps.run_site_audit.findingsCount}}\n\nDownload Report: {{steps.run_site_audit.reportPdfUrl}}'
          }
        }
      },
      {
        id: 'node-4',
        type: 'action',
        position: { x: 400, y: 320 },
        data: {
          label: 'Slack Channel Alert',
          subtitle: 'Post to #seo-alerts',
          type: 'action',
          subtype: 'send_slack_message',
          config: {
            channel: 'slack',
            title: 'Audit Complete: {{project.domain}}',
            recipient: '#seo-alerts',
            message: 'Daily Audit completed with score *{{steps.run_site_audit.score}}/100*. Report URL: {{steps.run_site_audit.reportPdfUrl}}',
            severity: 'info'
          }
        }
      }
    ],
    edges: [
      { id: 'e1-2', source: 'node-1', target: 'node-2', animated: true, style: { stroke: '#3b82f6', strokeWidth: 2 } },
      { id: 'e2-3', source: 'node-2', target: 'node-3', animated: true, style: { stroke: '#3b82f6', strokeWidth: 2 } },
      { id: 'e2-4', source: 'node-2', target: 'node-4', animated: true, style: { stroke: '#3b82f6', strokeWidth: 2 } }
    ],
    variables: {
      targetDomain: '{{project.domain}}'
    }
  },
  {
    name: 'Keyword Rank Drop Alert & Remediation Brief',
    description: 'Triggers when a tracked target keyword drops > 3 positions, runs AI SERP analysis, creates an actionable workspace task, and notifies the SEO channel on Slack.',
    category: 'Rankings',
    tags: ['Rank Tracking', 'AI Brief', 'Slack', 'Task'],
    difficulty: 'Intermediate',
    icon: 'trending-down',
    nodes: [
      { id: 'node-1', type: 'trigger', position: { x: 100, y: 150 }, data: { label: 'Keyword Rank Drop', triggerId: 'trigger_keyword_rank_drop', config: { minDropPositions: 3 } } },
      { id: 'node-2', type: 'action', position: { x: 380, y: 150 }, data: { label: 'AI SERP Remediation', actionId: 'action_ai_recommend', config: { issueType: 'Rank Drop', url: '{{targetUrl}}' } } },
      { id: 'node-3', type: 'action', position: { x: 660, y: 150 }, data: { label: 'Create SEO Task', actionId: 'action_task_creator', config: { title: 'Fix Rank Drop on {{keyword}}', priority: 'High', category: 'Technical' } } },
      { id: 'node-4', type: 'action', position: { x: 940, y: 150 }, data: { label: 'Notify Slack', actionId: 'action_notification', config: { channel: 'slack', title: 'Rank Drop Alert: {{keyword}}', message: 'Keyword dropped to rank {{currentRank}}. Task created for remediation.' } } }
    ],
    edges: [
      { id: 'e1-2', source: 'node-1', target: 'node-2', animated: true },
      { id: 'e2-3', source: 'node-2', target: 'node-3', animated: true },
      { id: 'e3-4', source: 'node-3', target: 'node-4', animated: true }
    ],
    variables: {}
  },
  {
    name: 'Instant Google Indexing Submission on New URL',
    description: 'Listens for newly published or updated URLs and submits them directly to the Google Indexing API with Cloudflare edge cache purge.',
    category: 'Technical',
    tags: ['Indexing', 'Google', 'Cloudflare'],
    difficulty: 'Advanced',
    icon: 'upload-cloud',
    nodes: [
      { id: 'node-1', type: 'trigger', position: { x: 100, y: 150 }, data: { label: 'New URL Webhook', triggerId: 'trigger_webhook', config: {} } },
      { id: 'node-2', type: 'action', position: { x: 380, y: 150 }, data: { label: 'Submit Google Indexing', actionId: 'action_google_indexing_submit', config: { url: '{{body.url}}', type: 'URL_UPDATED' } } },
      { id: 'node-3', type: 'action', position: { x: 660, y: 150 }, data: { label: 'Purge Cloudflare Cache', actionId: 'action_cloudflare_purge_cache', config: { files: ['{{body.url}}'], zoneId: '{{variables.zoneId}}' } } }
    ],
    edges: [
      { id: 'e1-2', source: 'node-1', target: 'node-2', animated: true },
      { id: 'e2-3', source: 'node-2', target: 'node-3', animated: true }
    ],
    variables: { zoneId: '' }
  },
  {
    name: 'Critical Technical Crawl Health Alert to Jira',
    description: 'Evaluates completed technical site audits. If critical issues exceed 5, creates a prioritized bug in Jira and alerts the engineering team.',
    category: 'Technical',
    tags: ['Crawl', 'Jira', 'Audit', 'DevOps'],
    difficulty: 'Intermediate',
    icon: 'activity',
    nodes: [
      { id: 'node-1', type: 'trigger', position: { x: 100, y: 150 }, data: { label: 'Audit Completed', triggerId: 'trigger_technical_audit_completed', config: { minCriticalIssues: 5 } } },
      { id: 'node-2', type: 'condition', position: { x: 380, y: 150 }, data: { label: 'Check Critical Count', config: { rules: [{ field: 'criticalIssuesCount', operator: '>=', value: 5 }] } } },
      { id: 'node-3', type: 'action', position: { x: 660, y: 80 }, data: { label: 'Create Jira Bug', actionId: 'action_jira_create_issue', config: { projectKey: 'SEO', summary: 'Crawl Health Critical Issues Detected ({{criticalIssuesCount}})', issueType: 'Bug' } } },
      { id: 'node-4', type: 'action', position: { x: 660, y: 220 }, data: { label: 'Log Health Succeeded', actionId: 'action_end', config: { outputVariables: { status: 'Healthy' } } } }
    ],
    edges: [
      { id: 'e1-2', source: 'node-1', target: 'node-2', animated: true },
      { id: 'e2-3', source: 'node-2', target: 'node-3', sourceHandle: 'true', label: 'true', animated: true },
      { id: 'e2-4', source: 'node-2', target: 'node-4', sourceHandle: 'false', label: 'false' }
    ],
    variables: {}
  },
  {
    name: 'Competitor Outrank Surveillance & Counter-Strategy',
    description: 'Detects when a key competitor overtakes your position on high-volume keywords, generates an AI competitor gap brief, and creates a task.',
    category: 'Competitors',
    tags: ['Competitors', 'AI Strategy', 'Surveillance'],
    difficulty: 'Advanced',
    icon: 'users',
    nodes: [
      { id: 'node-1', type: 'trigger', position: { x: 100, y: 150 }, data: { label: 'Competitor Overtake', triggerId: 'trigger_competitor_rank_change', config: { onlyWhenOvertakes: true } } },
      { id: 'node-2', type: 'action', position: { x: 380, y: 150 }, data: { label: 'Generate Counter-Brief', actionId: 'action_ai_generate', config: { prompt: 'Competitor {{competitorDomain}} overtook us on keyword {{keyword}} (Rank {{competitorRank}} vs {{ourRank}}). Draft a counter-content optimization brief.' } } },
      { id: 'node-3', type: 'action', position: { x: 660, y: 150 }, data: { label: 'Create Content Task', actionId: 'action_task_creator', config: { title: 'Counter-SEO for {{keyword}} vs {{competitorDomain}}', priority: 'High', category: 'Content' } } }
    ],
    edges: [
      { id: 'e1-2', source: 'node-1', target: 'node-2', animated: true },
      { id: 'e2-3', source: 'node-2', target: 'node-3', animated: true }
    ],
    variables: {}
  },
  {
    name: 'Core Web Vitals Regression Emergency Alert',
    description: 'Triggers immediately when LCP, INP, or CLS metrics fail Core Web Vitals thresholds on money pages.',
    category: 'Performance',
    tags: ['CWV', 'LCP', 'INP', 'Teams', 'Emergency'],
    difficulty: 'Beginner',
    icon: 'gauge',
    nodes: [
      { id: 'node-1', type: 'trigger', position: { x: 100, y: 150 }, data: { label: 'CWV Degraded', triggerId: 'trigger_cwv_degraded', config: {} } },
      { id: 'node-2', type: 'action', position: { x: 380, y: 150 }, data: { label: 'Notify Teams Channel', actionId: 'action_notification', config: { channel: 'teams', title: 'CWV Degradation on {{url}}', message: 'Metric {{metricName}} degraded from {{previousValue}} to {{currentValue}}.', severity: 'critical' } } }
    ],
    edges: [
      { id: 'e1-2', source: 'node-1', target: 'node-2', animated: true }
    ],
    variables: {}
  }
];

async function seedEnterpriseTemplates() {
  try {
    for (const tpl of ENTERPRISE_TEMPLATES) {
      await AutomationTemplate.findOneAndUpdate(
        { name: tpl.name },
        { $set: tpl },
        { upsert: true, new: true }
      );
    }
    logger.info(TAG, `Successfully seeded ${ENTERPRISE_TEMPLATES.length} enterprise automation templates`);
  } catch (error) {
    logger.error(TAG, `Error seeding enterprise templates: ${error.message}`);
  }
}

module.exports = {
  ENTERPRISE_TEMPLATES,
  seedEnterpriseTemplates
};
