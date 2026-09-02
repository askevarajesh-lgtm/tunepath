import React, { useState, useEffect } from 'react';
import { Typography, Progress, Divider, Tabs, Button, Tag, Space, Table, Popover, Spin, message } from 'antd';
import { semrushApi } from '../../../api/semrushApi';
import { ReloadOutlined } from '@ant-design/icons';
import { Download, Share2, Settings, AlertCircle, ChevronRight, RefreshCw } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useOutletContext } from 'react-router-dom';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import SnapshotSelector from './SnapshotSelector';
import './SiteHealthTab.css';

const { Title, Text } = Typography;

// Common Semrush Check ID Dictionary
const checkMap = {
  2: "sitemap.xml file has format errors",
  6: "multiple canonical URLs",
  8: "pages don't have meta descriptions",
  13: "duplicate title tags",
  15: "duplicate meta descriptions",
  39: "pages returned 4XX status code",
  101: "broken internal images",
  103: "unminified JavaScript and CSS files",
  106: "pages have low text-HTML ratio",
  110: "HTTP URLs in sitemap.xml for HTTPS site",
  112: "images don't have alt attributes",
  125: "pages don't have an h1 heading",
  132: "pages don't have enough text within the title tags",
  135: "links have no anchor text",
  137: "links have non-descriptive anchor text",
  205: "pages have only one incoming internal link",
  213: "URLs with a permanent redirect",
  216: "subdomains don't support HSTS",
  217: "issue with blocked external resource in robots.txt"
};

const getIssueName = (id) => checkMap[id] || `Site Audit Issue #${id}`;

const issueDetails = {
  2: { about: "A sitemap.xml file helps search engines understand your website's architecture. Format errors prevent search engines from parsing it correctly.", fix: "Check your sitemap for XML validation errors, such as missing tags, incorrect encoding, or invalid URLs, and generate a new valid sitemap." },
  6: { about: "Canonical URLs tell search engines which version of a page is the primary one. Having multiple canonical tags can confuse search engines.", fix: "Review the page's source code and HTTP headers, and remove any duplicate rel=\"canonical\" tags so only one remains." },
  8: { about: "Meta descriptions provide a brief summary of a web page and often appear in search results. Pages without them may have lower click-through rates.", fix: "Add a unique and descriptive meta description (typically around 150-160 characters) to the <head> section of each affected page." },
  13: { about: "Title tags are a major ranking factor and tell users what the page is about. Duplicate title tags can cause keyword cannibalization.", fix: "Rewrite the title tags for the affected pages so that each page has a unique, descriptive title relevant to its content." },
  15: { about: "Duplicate meta descriptions reduce their effectiveness and can result in generic snippets in search results.", fix: "Provide a unique, relevant meta description for each affected page that accurately summarizes its specific content." },
  39: { about: "4XX status codes (like 404 Not Found) indicate that a page is broken or inaccessible.", fix: "Check if the URL was changed or deleted. If deleted, remove internal links pointing to it. If changed, set up a 301 redirect to the new URL." },
  101: { about: "An internal broken image is an image that can't be displayed because it no longer exists, its URL is misspelled, or because the file path is not valid.\nBroken images may jeopardize your search rankings because they provide a poor user experience and signal to search engines that your page is low quality.", fix: "To fix a broken internal image, perform one of the following:\n- If an image is no longer located in the same location, change its URL\n- If an image was deleted or damaged, replace it with a new one\n- If an image is no longer needed, simply remove it from your page's code" },
  103: { about: "Unminified JavaScript and CSS files contain unnecessary characters (like whitespace and comments) that increase file size and slow down page load.", fix: "Minify your JS and CSS files using a minification tool or build process (like Webpack or Terser) to remove unnecessary characters." },
  106: { about: "A low text-to-HTML ratio indicates that a page has too much code and not enough actual text content, which can be seen as low quality by search engines.", fix: "Add more high-quality, relevant text content to the page, or optimize and reduce the amount of HTML code by moving inline styles/scripts to external files." },
  110: { about: "Having HTTP URLs in a sitemap for an HTTPS site can cause search engines to crawl insecure versions of your pages.", fix: "Update your sitemap.xml to ensure all URLs use the secure 'https://' protocol." },
  112: { about: "Alt attributes describe images to search engines and visually impaired users. Missing alt text represents a missed SEO and accessibility opportunity.", fix: "Add descriptive 'alt' attributes to all images. Make sure they accurately describe the image content." },
  125: { about: "The <h1> heading is typically the most important heading on a page. Pages without an <h1> may lack clear structure for search engines.", fix: "Ensure every page has exactly one <h1> tag that describes the main topic of the page." },
  132: { about: "Title tags that are too short may not provide enough context to search engines or users.", fix: "Expand the title tag to make it more descriptive and relevant to the page content (aim for 50-60 characters)." },
  135: { about: "Anchor text is the clickable text in a hyperlink. Links without anchor text provide no context about the destination page.", fix: "Add descriptive text within the <a> and </a> tags for all links." },
  137: { about: "Non-descriptive anchor text (like 'click here' or 'read more') doesn't tell users or search engines what the linked page is about.", fix: "Change the anchor text to something descriptive that indicates the topic of the target page." },
  205: { about: "Pages with only one incoming internal link (orphan or near-orphan pages) are hard for users and search engines to find.", fix: "Add more relevant internal links from other pages on your site to the affected pages." },
  213: { about: "Internal links pointing to URLs that permanently redirect (301) waste crawl budget and increase page load time.", fix: "Update the internal links to point directly to the final destination URL rather than the redirecting URL." },
  216: { about: "HSTS (HTTP Strict Transport Security) protects websites against protocol downgrade attacks.", fix: "Configure your server to include the Strict-Transport-Security header for all subdomains." },
  217: { about: "Resources blocked in robots.txt prevent search engines from fully rendering and understanding your pages.", fix: "Review your robots.txt file and unblock any important CSS, JS, or image files needed for rendering the page." }
};

const getIssueDetails = (id) => issueDetails[id] || {
  about: "This issue affects your site's SEO performance or user experience.",
  fix: "Review standard SEO best practices to resolve this issue or consult an SEO professional."
};

const IssuePopover = ({ id }) => {
  const details = getIssueDetails(id);
  return (
    <div style={{ display: 'flex', width: 600, margin: '-12px', minHeight: 250 }}>
      <div style={{ flex: 1, padding: 16 }}>
        <Title level={5} style={{ marginTop: 0 }}>About the issue</Title>
        <Text style={{ display: 'block', marginBottom: 8, whiteSpace: 'pre-wrap' }}>{details.about}</Text>
      </div>
      <div style={{ flex: 1, padding: 16, background: '#e6fffb' }}>
        <Title level={5} style={{ marginTop: 0 }}>How to fix</Title>
        <Text style={{ whiteSpace: 'pre-wrap' }}>{details.fix}</Text>
      </div>
    </div>
  );
};

const SiteHealthTab = () => {
  const { project, projectData, fetchProjectData } = useOutletContext();
  const domain = project?.domain;
  const [localData, setLocalData] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  
  useEffect(() => {
    if (projectData?.siteHealth && !localData) {
      setLocalData(projectData.siteHealth);
    }
  }, [projectData]);

  const [snapshotLoading, setSnapshotLoading] = useState(false);
  const [snapshotError, setSnapshotError] = useState(false);

  const handleSnapshotSelect = async (snapshotId) => {
    if (snapshotId === 'latest') {
      setLocalData(projectData?.siteHealth || null);
      setSnapshotError(false);
      return;
    }
    
    setSnapshotLoading(true);
    setSnapshotError(false);
    try {
      const res = await semrushApi.getSnapshotById(project._id, snapshotId);
      if (res.data.success && res.data.data) {
        const healthData = res.data.data.siteHealth;
        if (!healthData || !healthData.rawData || Object.keys(healthData.rawData).length === 0) {
          setSnapshotError(true);
        } else {
          setLocalData(healthData);
        }
      }
    } catch (err) {
      console.error(err);
      setSnapshotError(true);
    } finally {
      setSnapshotLoading(false);
    }
  };

  const handleRefresh = async () => {
    if (!project?._id) return;
    setRefreshing(true);
    try {
      const res = await semrushApi.getSiteAudit(project._id, true);
      if (res.data.success && res.data.data) {
        setLocalData({
           rawData: res.data.data.siteHealthDetails,
           overallScore: res.data.data.technicalScore?.value || 0
        });
        message.success('Site Audit updated successfully');
        if (fetchProjectData) fetchProjectData();
      } else {
        message.error(res.data.errorCode || 'Failed to refresh Site Audit');
      }
    } catch (err) {
      message.error('An error occurred during refresh');
    } finally {
      setRefreshing(false);
    }
  };

  const auditData = localData?.rawData;
  const overallScore = localData?.overallScore ?? null;
  const [activeTab, setActiveTab] = useState('overview');

  if (!auditData) {
    return (
      <div className="site-audit-container" style={{ padding: 40, textAlign: 'center' }}>
        <Title level={4} style={{ color: 'var(--text-tertiary)' }}>No Site Audit Data</Title>
        <Text style={{ display: 'block', marginBottom: 16 }}>Please use the 'Refresh Data' button at the top right of the dashboard to fetch the latest insights from the SEO module.</Text>
      </div>
    );
  }

  const errorsData = Array.isArray(auditData.errors) ? auditData.errors : [];
  const warningsData = Array.isArray(auditData.warnings) ? auditData.warnings : [];
  const noticesData = Array.isArray(auditData.notices) ? auditData.notices : [];

  const errorIssues = errorsData.map(d => ({ id: d.id, name: getIssueName(d.id), count: d.count })).filter(d => d.count > 0).sort((a, b) => b.count - a.count);
  const warningIssues = warningsData.map(d => ({ id: d.id, name: getIssueName(d.id), count: d.count })).filter(d => d.count > 0).sort((a, b) => b.count - a.count);
  const noticeIssues = noticesData.map(d => ({ id: d.id, name: getIssueName(d.id), count: d.count })).filter(d => d.count > 0).sort((a, b) => b.count - a.count);

  const defectList = [...errorIssues, ...warningIssues, ...noticeIssues].sort((a, b) => b.count - a.count);

  const errors = errorsData.reduce((acc, curr) => acc + curr.count, 0);
  const warnings = warningsData.reduce((acc, curr) => acc + curr.count, 0);
  const notices = noticesData.reduce((acc, curr) => acc + curr.count, 0);
  const pages_crawled = auditData.pagesCrawled || 0;
  const healthy = auditData.healthy || 0;
  const broken = auditData.broken || 0;
  const haveIssues = auditData.haveIssues || 0;
  const redirected = auditData.redirected || 0;
  const blocked = auditData.blocked || 0;

  const items = [
    { key: 'overview', label: 'Overview' },
    { key: 'issues', label: 'Issues' },
    { key: 'crawled', label: 'Crawled Pages' },
    { key: 'statistics', label: 'Statistics' }
  ];

  const scoreColor = overallScore >= 80 ? 'var(--accent-secondary)' : (overallScore >= 50 ? 'var(--accent-warning)' : '#ff4d4f');

  return (
    <div className="site-audit-container">
      {/* Top Header Toolbar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
        <div>
          <Title level={3} style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 12 }}>
            Site Audit: <span style={{ color: 'var(--accent-primary)' }}>{domain}</span>
            {overallScore !== null && <Tag color={scoreColor}>{overallScore}% Health</Tag>}
          </Title>
          <Text type="secondary">Review technical SEO issues affecting your website's performance.</Text>
        </div>
        
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <SnapshotSelector 
            projectId={project?._id} 
            tabKey="site-health" 
            onSnapshotSelect={handleSnapshotSelect} 
          />
          <Button 
            type="primary" 
            icon={<ReloadOutlined spin={refreshing} />} 
            onClick={handleRefresh} 
            loading={refreshing}
            style={{ borderRadius: 8, fontWeight: 600, background: 'var(--text-primary)', color: 'var(--bg-primary)' }}
          >
            {refreshing ? 'Refreshing...' : 'Refresh Audit'}
          </Button>
        </div>
      </div>

      {snapshotError ? (
        <div style={{ padding: '40px 0', textAlign: 'center' }}>
          <Text type="secondary">Historical data not available for this snapshot.</Text>
        </div>
      ) : snapshotLoading ? (
        <div style={{ padding: '40px 0', textAlign: 'center' }}>
          <Text type="secondary">Loading historical data...</Text>
        </div>
      ) : (
        <>
          <Tabs activeKey={activeTab} onChange={setActiveTab} items={items} />

          {activeTab === 'overview' && (
            <AnimatePresence mode="wait">
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="site-audit-grid">
            
            {/* Top Row - Only real metrics */}
            <div className="sa-col-6 sa-card">
              <Title level={5}>Site Health</Title>
              <div style={{ display: 'flex', justifyContent: 'center', padding: '20px 0' }}>
                <Progress 
                  type="circle" 
                  percent={overallScore} 
                  strokeColor={overallScore > 75 ? 'var(--accent-success)' : overallScore > 50 ? 'var(--accent-warning)' : '#f5222d'} 
                  width={140}
                  strokeWidth={8}
                />
              </div>
              <div className="sa-stats-row">
                <Text>Your site</Text>
                <Text strong>{overallScore}%</Text>
              </div>
            </div>

            <div className="sa-col-6 sa-card">
              <Title level={5}>Crawled Pages</Title>
              <Title level={2} style={{ margin: '8px 0', color: 'var(--accent-primary)' }}>{pages_crawled}</Title>
              
              <div style={{ display: 'flex', height: 12, borderRadius: 6, overflow: 'hidden', marginBottom: 24, background: 'var(--border-color)' }}>
                {healthy > 0 && <div style={{ width: `${(healthy/pages_crawled)*100}%`, background: 'var(--accent-success)' }} />}
                {broken > 0 && <div style={{ width: `${(broken/pages_crawled)*100}%`, background: '#f5222d' }} />}
                {haveIssues > 0 && <div style={{ width: `${(haveIssues/pages_crawled)*100}%`, background: 'var(--accent-warning)' }} />}
                {redirected > 0 && <div style={{ width: `${(redirected/pages_crawled)*100}%`, background: 'var(--accent-primary)' }} />}
              </div>

              <div className="sa-stats-row"><span style={{color: 'var(--accent-success)'}}>●</span> Healthy <Text strong>{healthy}</Text></div>
              <div className="sa-stats-row"><span style={{color: '#f5222d'}}>●</span> Broken <Text strong>{broken}</Text></div>
              <div className="sa-stats-row"><span style={{color: 'var(--accent-warning)'}}>●</span> Have issues <Text strong>{haveIssues}</Text></div>
              <div className="sa-stats-row"><span style={{color: 'var(--accent-primary)'}}>●</span> Redirects <Text strong>{redirected}</Text></div>
              <div className="sa-stats-row"><span style={{color: 'var(--text-tertiary)'}}>●</span> Blocked <Text strong>{blocked}</Text></div>
            </div>

            {/* Bottom Row */}
            <div className="sa-col-4 sa-card" style={{ padding: 0 }}>
              <div style={{ padding: '24px 24px 0 24px' }}>
                <Title level={5} style={{ margin: 0 }}>Errors</Title>
                <Title level={2} style={{ color: '#f5222d', margin: 0 }}>{errors}</Title>
              </div>
              <Divider style={{ margin: '16px 0' }} />
              <div style={{ padding: '0 24px' }}>
                <Title level={5} style={{ margin: 0 }}>Warnings</Title>
                <Title level={2} style={{ color: 'var(--accent-warning)', margin: 0 }}>{warnings}</Title>
              </div>
              <Divider style={{ margin: '16px 0' }} />
              <div style={{ padding: '0 24px 24px 24px' }}>
                <Title level={5} style={{ margin: 0 }}>Notices</Title>
                <Title level={2} style={{ color: 'var(--accent-primary)', margin: 0 }}>{notices}</Title>
              </div>
            </div>

            <div className="sa-col-8 sa-card">
              <Title level={5} style={{ marginBottom: 16 }}>Top Issues</Title>
              {defectList.slice(0, 5).map((d, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 0', borderBottom: i < 4 ? '1px solid var(--border-color)' : 'none' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <AlertCircle size={16} color={errorIssues.find(e=>e.id===d.id) ? '#f5222d' : warningIssues.find(w=>w.id===d.id) ? 'var(--accent-warning)' : 'var(--accent-primary)'} />
                    <Text>{d.name}</Text>
                  </div>
                  <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
                    <Text strong style={{ color: 'var(--accent-primary)' }}>{d.count} pages</Text>
                    <Popover content={<IssuePopover id={d.id} />} trigger="click" placement="bottomRight" overlayInnerStyle={{ padding: 0 }}>
                      <a style={{ fontSize: 13, cursor: 'pointer' }}>How to fix</a>
                    </Popover>
                  </div>
                </div>
              ))}
              <div style={{ textAlign: 'center', marginTop: 12 }}>
                <Button type="link" onClick={() => setActiveTab('issues')}>View all issues <ChevronRight size={14} /></Button>
              </div>
            </div>
          </motion.div>
        </AnimatePresence>
      )}

      {activeTab === 'issues' && (
        <AnimatePresence mode="wait">
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="sa-card">
            
            <div style={{ display: 'flex', gap: 16, marginBottom: 24 }}>
              <Tag color="red" style={{ fontSize: 14, padding: '4px 12px' }}>Errors {errors}</Tag>
              <Tag color="orange" style={{ fontSize: 14, padding: '4px 12px' }}>Warnings {warnings}</Tag>
              <Tag color="blue" style={{ fontSize: 14, padding: '4px 12px' }}>Notices {notices}</Tag>
            </div>

            <Title level={5} style={{ color: '#f5222d', borderBottom: '2px solid #f5222d', paddingBottom: 8 }}>Errors</Title>
            {errorIssues.map((d, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '16px 0', borderBottom: '1px solid var(--border-color)' }}>
                <Text><span style={{ color: 'var(--accent-primary)', fontWeight: 600 }}>{d.count} issues</span> with {d.name}</Text>
                <Popover content={<IssuePopover id={d.id} />} trigger="click" placement="bottomRight" overlayInnerStyle={{ padding: 0 }}>
                  <a style={{ fontSize: 13, cursor: 'pointer' }}>How to fix</a>
                </Popover>
              </div>
            ))}
            {errorIssues.length === 0 && <Text type="secondary" style={{ display: 'block', padding: 16 }}>No errors found.</Text>}

            <Title level={5} style={{ color: 'var(--accent-warning)', borderBottom: '2px solid var(--accent-warning)', paddingBottom: 8, marginTop: 32 }}>Warnings</Title>
            {warningIssues.map((d, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '16px 0', borderBottom: '1px solid var(--border-color)' }}>
                <Text><span style={{ color: 'var(--accent-primary)', fontWeight: 600 }}>{d.count} issues</span> with {d.name}</Text>
                <Popover content={<IssuePopover id={d.id} />} trigger="click" placement="bottomRight" overlayInnerStyle={{ padding: 0 }}>
                  <a style={{ fontSize: 13, cursor: 'pointer' }}>How to fix</a>
                </Popover>
              </div>
            ))}
            {warningIssues.length === 0 && <Text type="secondary" style={{ display: 'block', padding: 16 }}>No warnings found.</Text>}

            <Title level={5} style={{ color: 'var(--accent-primary)', borderBottom: '2px solid var(--accent-primary)', paddingBottom: 8, marginTop: 32 }}>Notices</Title>
            {noticeIssues.map((d, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '16px 0', borderBottom: '1px solid var(--border-color)' }}>
                <Text><span style={{ color: 'var(--accent-primary)', fontWeight: 600 }}>{d.count} issues</span> with {d.name}</Text>
                <Popover content={<IssuePopover id={d.id} />} trigger="click" placement="bottomRight" overlayInnerStyle={{ padding: 0 }}>
                  <a style={{ fontSize: 13, cursor: 'pointer' }}>How to fix</a>
                </Popover>
              </div>
            ))}
            {noticeIssues.length === 0 && <Text type="secondary" style={{ display: 'block', padding: 16 }}>No notices found.</Text>}

          </motion.div>
        </AnimatePresence>
      )}

      {activeTab === 'crawled' && (
        <AnimatePresence mode="wait">
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="sa-card" style={{ padding: 24 }}>
            <Title level={5} style={{ marginBottom: 16 }}>Crawled Pages</Title>
            <Table 
              dataSource={auditData.crawledPagesList || []}
              rowKey="id"
              pagination={{ defaultPageSize: 10, showSizeChanger: true, pageSizeOptions: ['10', '20', '50', '100', '200'] }}
              columns={[
                {
                  title: 'Page URL',
                  dataIndex: 'url',
                  key: 'url',
                  render: (url) => <a href={url} target="_blank" rel="noopener noreferrer">{url}</a>
                },
                {
                  title: 'Title',
                  dataIndex: 'title',
                  key: 'title',
                  render: (text) => <Text style={{ maxWidth: 300 }} ellipsis={{ tooltip: text }}>{text || '-'}</Text>
                },
                {
                  title: 'Status Code',
                  dataIndex: 'statusCode',
                  key: 'statusCode',
                  render: (code) => <Tag color={code === 200 ? 'success' : 'error'}>{code}</Tag>
                },
                {
                  title: 'Issues',
                  key: 'issues',
                  render: (_, record) => {
                    const total = (record.errors || 0) + (record.warnings || 0) + (record.notices || 0);
                    return <Text style={{ color: total > 0 ? 'var(--accent-primary)' : 'inherit' }}>{total} issues</Text>;
                  }
                },
                {
                  title: 'Crawl Depth',
                  dataIndex: 'depth',
                  key: 'depth',
                  render: (depth) => <Text>{depth} clicks</Text>
                }
              ]}
            />
          </motion.div>
        </AnimatePresence>
      )}

      {activeTab === 'statistics' && (
        <AnimatePresence mode="wait">
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="site-audit-grid">
            <div className="sa-col-6 sa-card" style={{ padding: 24 }}>
              <Title level={5} style={{ marginBottom: 24 }}>HTTP Status Codes</Title>
              {Object.keys(auditData.statusCodeGroups || {}).length > 0 ? (
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={[
                    { name: '2xx', count: auditData.statusCodeGroups['2'] || 0, fill: 'var(--accent-success)' },
                    { name: '3xx', count: auditData.statusCodeGroups['3'] || 0, fill: 'var(--accent-warning)' },
                    { name: '4xx', count: auditData.statusCodeGroups['4'] || 0, fill: '#f5222d' },
                    { name: '5xx', count: auditData.statusCodeGroups['5'] || 0, fill: '#cf1322' }
                  ].filter(d => d.count > 0)}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} />
                    <YAxis axisLine={false} tickLine={false} />
                    <RechartsTooltip cursor={{ fill: 'transparent' }} contentStyle={{ borderRadius: 8 }} />
                    <Bar dataKey="count" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-tertiary)' }}>Not provided by SEO API</div>
              )}
            </div>

            <div className="sa-col-6 sa-card" style={{ padding: 24 }}>
              <Title level={5} style={{ marginBottom: 24 }}>Sitemap vs Crawled</Title>
              {auditData.sitemapStats ? (
                <ResponsiveContainer width="100%" height={250}>
                  <PieChart>
                    <Pie
                      data={[
                        { name: 'In Sitemap & Crawled', value: auditData.sitemapStats.crawledPages || 0, fill: 'var(--accent-success)' },
                        { name: 'Not in Sitemap', value: Math.max(0, pages_crawled - (auditData.sitemapStats.crawledPages || 0)), fill: '#d9d9d9' }
                      ].filter(d => d.value > 0)}
                      innerRadius={60}
                      outerRadius={80}
                      paddingAngle={5}
                      dataKey="value"
                    >
                      {[{ fill: 'var(--accent-success)' }, { fill: '#d9d9d9' }].map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.fill} />
                      ))}
                    </Pie>
                    <RechartsTooltip contentStyle={{ borderRadius: 8 }} />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-tertiary)' }}>Not provided by SEO API</div>
              )}
            </div>

            <div className="sa-col-6 sa-card" style={{ padding: 24 }}>
              <Title level={5} style={{ marginBottom: 24 }}>Crawl Depth</Title>
              {Object.keys(auditData.crawlDepthStats || {}).length > 0 ? (
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={Object.entries(auditData.crawlDepthStats).map(([depth, count]) => ({ depth: `${depth} clicks`, count })).filter(d => d.count > 0)}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="depth" axisLine={false} tickLine={false} />
                    <YAxis axisLine={false} tickLine={false} />
                    <RechartsTooltip cursor={{ fill: 'transparent' }} contentStyle={{ borderRadius: 8 }} />
                    <Bar dataKey="count" fill="var(--accent-primary)" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-tertiary)' }}>Not provided by SEO API</div>
              )}
            </div>
          </motion.div>
        </AnimatePresence>
      )}

        </>
      )}
    </div>
  );
};

export default SiteHealthTab;
