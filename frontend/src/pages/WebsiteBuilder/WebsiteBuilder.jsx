import React, { useState, useEffect } from 'react';
import { Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import { Typography, Row, Col, Card, Button, Select, Table, Tag, Input } from 'antd';
import { motion, AnimatePresence } from 'framer-motion';
import { LayoutGrid, Globe, Store, FileText, LayoutTemplate, Smartphone, QrCode, MessageCircle, Link2, Plus, ExternalLink, Sparkles, Code, Activity, ChevronDown } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

// Import Tab Components

import WebsitesTab from './tabs/WebsitesTab';

import FormsTab from './tabs/FormsTab';
import BlogsTab from './tabs/BlogsTab';
import QRLinksTab from './tabs/QRLinksTab';
import ChatWidgetsTab from './tabs/ChatWidgetsTab';
import DomainsTab from './tabs/DomainsTab';
import WordPressDashboard from './wordpress/WordPressDashboard';
import WordPressPages from './wordpress/WordPressPages';
import WordPressPosts from './wordpress/WordPressPosts';
import WordPressMedia from './wordpress/WordPressMedia';
import WordPressProducts from './wordpress/WordPressProducts';
import WordPressOrders from './wordpress/WordPressOrders';

const { Title, Text } = Typography;

const WebsiteBuilder = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [websiteInitialAction, setWebsiteInitialAction] = useState(null);
  const [dashboardStats, setDashboardStats] = useState({
    totalWebsites: 0,
    activeWebsites: 0,
    totalPages: 0,
    totalForms: 0,
    totalSubmissions: 0,
    totalBlogs: 0,
    totalBlogPosts: 0,
    totalQrs: 0,
    totalScans: 0,
    totalWidgets: 0,
    totalDomains: 0,
    connectedDomains: 0,
    recentActivity: [],
    loading: true
  });

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        const token = localStorage.getItem("token");
        const headers = {
          "Authorization": token ? `Bearer ${token}` : ""
        };

        const [
          webRes,
          wpRes,
          formsAnalyticsRes,
          blogsRes,
          qrsRes,
          domainsRes,
          widgetsRes
        ] = await Promise.allSettled([
          fetch("/api/websites", { headers }).then(r => r.json()),
          fetch("/api/wordpress", { headers }).then(r => r.json()),
          fetch("/api/forms/analytics", { headers }).then(r => r.json()),
          fetch("/api/blogs", { headers }).then(r => r.json()),
          fetch("/api/qrs", { headers }).then(r => r.json()),
          fetch("/api/domains", { headers }).then(r => r.json()),
          fetch("/api/chat-widgets", { headers }).then(r => r.json())
        ]);

        let websites = [];
        if (webRes.status === 'fulfilled' && webRes.value?.success && Array.isArray(webRes.value?.data)) {
          websites = webRes.value.data;
        }

        let wordpressSites = [];
        if (wpRes.status === 'fulfilled' && wpRes.value?.success && Array.isArray(wpRes.value?.data)) {
          wordpressSites = wpRes.value.data;
        }

        const totalWebsites = websites.length + wordpressSites.length;
        const totalPages = websites.reduce((acc, w) => acc + (w.pagesCount || 1), 0);
        const activeWebsites = websites.filter(w => w.status === 'Ready' || w.status === 'Published' || !w.status).length + wordpressSites.length;

        // Forms stats
        let totalForms = 0;
        let totalSubmissions = 0;
        if (formsAnalyticsRes.status === 'fulfilled' && formsAnalyticsRes.value?.success && formsAnalyticsRes.value?.data) {
          totalForms = formsAnalyticsRes.value.data.formsCount || 0;
          totalSubmissions = formsAnalyticsRes.value.data.totalSubmissions || 0;
        }

        // Blogs stats
        let totalBlogs = 0;
        let totalBlogPosts = 0;
        if (blogsRes.status === 'fulfilled' && blogsRes.value?.success && Array.isArray(blogsRes.value?.data)) {
          const blogs = blogsRes.value.data;
          totalBlogs = blogs.length;
          totalBlogPosts = blogs.reduce((acc, b) => acc + (b.posts || 0), 0);
        }

        // QR stats
        let totalQrs = 0;
        let totalScans = 0;
        if (qrsRes.status === 'fulfilled' && qrsRes.value?.success && Array.isArray(qrsRes.value?.data)) {
          const qrs = qrsRes.value.data;
          totalQrs = qrs.length;
          totalScans = qrs.reduce((acc, q) => acc + (q.scans || 0), 0);
        }

        // Domains stats
        let totalDomains = 0;
        let connectedDomains = 0;
        if (domainsRes.status === 'fulfilled' && domainsRes.value?.success && Array.isArray(domainsRes.value?.data)) {
          const domains = domainsRes.value.data;
          totalDomains = domains.length;
          connectedDomains = domains.filter(d => d.status === 'Connected' || d.status === 'Active' || d.connectedTo).length;
        }

        // Chat widgets stats
        let totalWidgets = 0;
        if (widgetsRes.status === 'fulfilled' && widgetsRes.value?.success && Array.isArray(widgetsRes.value?.data)) {
          totalWidgets = widgetsRes.value.data.length;
        }

        // Recent Activity
        const sortedWebsites = [...websites].sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt)).slice(0, 5);
        const recentActivity = sortedWebsites.map(w => {
          const isNew = Math.abs(new Date(w.createdAt).getTime() - new Date(w.updatedAt).getTime()) < 1000;
          const dateStr = new Date(w.updatedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
          return {
            user: w.updatedBy?.name || 'User',
            action: isNew ? 'created the website' : 'updated the website',
            site: w.name,
            time: dateStr,
            dot: isNew ? 'var(--accent-primary)' : 'var(--accent-warning)'
          };
        });

        setDashboardStats({
          totalWebsites,
          activeWebsites,
          totalPages,
          totalForms,
          totalSubmissions,
          totalBlogs,
          totalBlogPosts,
          totalQrs,
          totalScans,
          totalWidgets,
          totalDomains,
          connectedDomains,
          recentActivity,
          loading: false
        });
      } catch (err) {
        console.error("Failed to fetch dashboard data", err);
        setDashboardStats(prev => ({ ...prev, loading: false }));
      }
    };

    fetchDashboardData();
  }, []);

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.1 }
    }
  };

  const itemVariants = {
    hidden: { y: 20, opacity: 0 },
    visible: {
      y: 0,
      opacity: 1,
      transition: { type: 'spring', stiffness: 300, damping: 24 }
    }
  };

  const { role } = useAuth();

  const tabs = [
    { id: 'overview', label: 'Overview', icon: <LayoutGrid size={16} /> },
    { id: 'websites', label: 'Websites', icon: <Globe size={16} /> },
    { id: 'forms', label: 'Forms', icon: <FileText size={16} /> },
    { id: 'blogs', label: 'Blogs', icon: <LayoutTemplate size={16} /> },
    { id: 'qr-links', label: 'QR Links', icon: <QrCode size={16} /> },
    { id: 'chat-widgets', label: 'Chat Widgets', icon: <MessageCircle size={16} /> },
    { id: 'domains', label: 'Domains', icon: <Link2 size={16} /> },
  ];

  const match = location.pathname.match(/^(.*?\/(?:website|websites))(?=\/|$)/);
  const basePath = match ? match[0] : (location.pathname.startsWith('/client') ? '/client/website' : '/workspace/website');

  const availableTabIds = tabs.map(t => t.id);
  const activeTab = availableTabIds.find(id => location.pathname.includes(`/${id}`)) || (role === 'agency_client' ? 'websites' : 'overview');

  const handleTabClick = (tabId) => {
    navigate(`${basePath}/${tabId}`);
  };

  const renderOverviewContent = () => {
    const kpiCards = [
      {
        label: 'TOTAL WEBSITES',
        val: dashboardStats.totalWebsites.toString(),
        sub: `${dashboardStats.activeWebsites || dashboardStats.totalWebsites} Active projects`,
        alert: 'Manage in Websites tab',
        color: 'var(--accent-secondary)',
        tab: 'websites'
      },
      {
        label: 'ACTIVE PAGES',
        val: dashboardStats.totalPages.toString(),
        sub: 'Across all websites',
        alert: 'Manage pages in builder',
        color: 'var(--accent-primary)',
        tab: 'websites'
      },
      {
        label: 'LEAD FORMS',
        val: dashboardStats.totalForms.toString(),
        sub: `${dashboardStats.totalSubmissions} Form Submissions`,
        alert: 'Manage in Forms tab',
        color: 'var(--accent-info)',
        tab: 'forms'
      },
      {
        label: 'BLOG ARTICLES',
        val: dashboardStats.totalBlogPosts.toString(),
        sub: `Across ${dashboardStats.totalBlogs} active blogs`,
        alert: 'Manage in Blogs tab',
        color: 'var(--accent-warning)',
        tab: 'blogs'
      },
      {
        label: 'QR LINKS',
        val: dashboardStats.totalQrs.toString(),
        sub: `${dashboardStats.totalScans} Total scans`,
        alert: 'Manage in QR Links tab',
        color: 'var(--accent-primary)',
        tab: 'qr-links'
      },
      {
        label: 'CUSTOM DOMAINS',
        val: dashboardStats.totalDomains.toString(),
        sub: `${dashboardStats.connectedDomains} Connected domains`,
        alert: 'Manage in Domains tab',
        color: 'var(--accent-secondary)',
        tab: 'domains'
      },
    ];

    return (
      <motion.div variants={itemVariants}>
        <Row gutter={[16, 16]} style={{ marginBottom: 32 }}>
          {kpiCards.map((kpi, i) => (
            <Col style={{ flex: '1 1 180px', minWidth: 175 }} key={i}>
              <motion.div variants={itemVariants} whileHover={{ y: -4, transition: { duration: 0.2 } }} style={{ height: '100%' }}>
                <Card
                  bodyStyle={{ padding: 0, display: 'flex', flexDirection: 'column', height: '100%' }}
                  onClick={() => kpi.tab && handleTabClick(kpi.tab)}
                  style={{
                    borderRadius: 12,
                    height: '100%',
                    background: 'var(--bg-secondary)',
                    border: '1px solid var(--border-color)',
                    boxShadow: 'var(--shadow-sm)',
                    overflow: 'hidden',
                    cursor: 'pointer'
                  }}
                >
                  <div style={{
                    height: 32,
                    background: 'var(--bg-tertiary)',
                    borderBottom: '1px solid var(--border-color)',
                    display: 'flex',
                    alignItems: 'center',
                    padding: '0 12px',
                    gap: 6
                  }}>
                    <div style={{ width: 10, height: 10, borderRadius: '50%', background: 'var(--accent-danger)' }} />
                    <div style={{ width: 10, height: 10, borderRadius: '50%', background: 'var(--accent-warning)' }} />
                    <div style={{ width: 10, height: 10, borderRadius: '50%', background: 'var(--accent-primary)' }} />
                    <div style={{ flex: 1, display: 'flex', justifyContent: 'center' }}>
                      <div style={{ width: '40%', height: 6, background: 'var(--border-color)', borderRadius: 4 }} />
                    </div>
                  </div>

                  <div style={{ padding: '20px 24px', flex: 1, display: 'flex', flexDirection: 'column' }}>
                    <Text type="secondary" style={{ fontSize: 11, fontWeight: 800, letterSpacing: 1.5 }}>{kpi.label}</Text>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 12 }}>
                      <div>
                        <Title level={2} style={{ margin: '0 0 4px', color: 'var(--text-primary)', fontWeight: 800 }}>{kpi.val}</Title>
                        {kpi.sub && <Text style={{ fontSize: 13, color: kpi.color, display: 'block', fontWeight: 600 }}>{kpi.sub}</Text>}
                      </div>

                      {kpi.showRing && (
                        <div style={{
                          width: 44,
                          height: 44,
                          borderRadius: '50%',
                          border: '4px solid var(--accent-primary)',
                          borderTopColor: 'transparent',
                          transform: 'rotate(45deg)'
                        }} />
                      )}

                      {kpi.badge && <Tag style={{ borderRadius: 12, border: 'none', background: 'rgba(16, 185, 129, 0.15)', color: 'var(--accent-primary)', fontWeight: 700, padding: '2px 8px', margin: 0 }}>{kpi.badge}</Tag>}
                    </div>

                    <Text type="secondary" style={{ fontSize: 12, display: 'block', marginTop: 'auto', paddingTop: 16, fontWeight: 500 }}>{kpi.alert}</Text>
                  </div>
                </Card>
              </motion.div>
            </Col>
          ))}
        </Row>

      <Row gutter={[24, 24]} style={{ marginBottom: 40 }}>
        <Col xs={24} lg={8}>
          <motion.div variants={itemVariants} whileHover={{ y: -4, transition: { duration: 0.2 } }} style={{ height: '100%' }}>
            <Card className="glassmorphism" style={{ borderRadius: 16, height: '100%', border: '1px solid var(--border-color)', boxShadow: 'var(--shadow-sm)' }} bodyStyle={{ padding: 24, display: 'flex', flexDirection: 'column', height: '100%' }}>
              <Title level={5} style={{ margin: '0 0 12px', display: 'flex', alignItems: 'center', gap: 10, color: 'var(--text-primary)', fontSize: 18 }}><Sparkles size={22} color="var(--accent-secondary)" /> Generate with AI</Title>
              <Text type="secondary" style={{ fontSize: 13, display: 'block', marginBottom: 24, fontWeight: 500 }}>Describe the website you want. Our AI builds it in under 60 seconds — full pages, copy, layout, and images.</Text>

              <div style={{ height: 160, border: '2px dashed var(--border-color)', borderRadius: 12, display: 'flex', justifyContent: 'center', alignItems: 'center', marginBottom: 24, background: 'rgba(13, 148, 136, 0.05)', cursor: 'pointer', transition: 'all 0.2s', marginTop: 'auto' }} onClick={() => { setWebsiteInitialAction('openAiGenerate'); handleTabClick('websites'); }}>
                <Button type="link" style={{ fontSize: 16, fontWeight: 600, color: 'var(--accent-secondary)' }}>Generate Site →</Button>
              </div>
            </Card>
          </motion.div>
        </Col>

        <Col xs={24} lg={8}>
          <motion.div variants={itemVariants} whileHover={{ y: -4, transition: { duration: 0.2 } }} style={{ height: '100%' }}>
            <Card className="glassmorphism" style={{ borderRadius: 16, height: '100%', border: '1px solid var(--border-color)', boxShadow: 'var(--shadow-sm)' }} bodyStyle={{ padding: 24, display: 'flex', flexDirection: 'column', height: '100%' }}>
              <Title level={5} style={{ margin: '0 0 12px', display: 'flex', alignItems: 'center', gap: 10, color: 'var(--text-primary)', fontSize: 18 }}><LayoutTemplate size={22} color="var(--accent-info)" /> Start from a Template</Title>
              <Text type="secondary" style={{ fontSize: 13, display: 'block', marginBottom: 24, fontWeight: 500 }}>100+ professionally designed templates. Filter by industry and customize everything.</Text>

              <div style={{ height: 160, border: '2px dashed var(--border-color)', borderRadius: 12, display: 'flex', justifyContent: 'center', alignItems: 'center', marginBottom: 24, background: 'rgba(59, 130, 246, 0.05)', cursor: 'pointer', transition: 'all 0.2s', marginTop: 'auto' }} onClick={() => { setWebsiteInitialAction('openTemplates'); handleTabClick('websites'); }}>
                <Button type="link" style={{ fontSize: 16, fontWeight: 600, color: 'var(--accent-info)' }}>Browse Templates →</Button>
              </div>
            </Card>
          </motion.div>
        </Col>

        <Col xs={24} lg={8}>
          <motion.div variants={itemVariants} whileHover={{ y: -4, transition: { duration: 0.2 } }} style={{ height: '100%' }}>
            <Card className="glassmorphism" style={{ borderRadius: 16, height: '100%', border: '1px solid var(--border-color)', boxShadow: 'var(--shadow-sm)' }} bodyStyle={{ padding: 24, display: 'flex', flexDirection: 'column', height: '100%' }}>
              <Title level={5} style={{ margin: '0 0 12px', display: 'flex', alignItems: 'center', gap: 10, color: 'var(--text-primary)', fontSize: 18 }}><Code size={22} color="var(--accent-warning)" /> Import or Upload Code</Title>
              <Text type="secondary" style={{ fontSize: 13, display: 'block', marginBottom: 24, fontWeight: 500 }}>Upload HTML/CSS/JS files, paste code, or import from Webflow, Figma, or WordPress.</Text>

              <div style={{ height: 160, border: '2px dashed var(--border-color)', borderRadius: 12, display: 'flex', justifyContent: 'center', alignItems: 'center', marginBottom: 24, background: 'rgba(245, 158, 11, 0.05)', cursor: 'pointer', transition: 'all 0.2s', marginTop: 'auto' }} onClick={() => { setWebsiteInitialAction('openUpload'); handleTabClick('websites'); }}>
                <Button type="link" style={{ fontSize: 16, fontWeight: 600, color: 'var(--accent-warning)' }}>Import Site →</Button>
              </div>
            </Card>
          </motion.div>
        </Col>
      </Row>

      <motion.div variants={itemVariants}>
        <Card
          title={<div style={{ paddingTop: 8 }}><Title level={5} style={{ margin: 0, fontSize: 18, fontWeight: 700, color: 'var(--text-primary)' }}>Recent Activity</Title><Text type="secondary" style={{ fontSize: 13, fontWeight: 500 }}>Changes across all sites — last 7 days</Text></div>}
          className="glassmorphism" style={{ borderRadius: 16, marginBottom: 40, border: '1px solid var(--border-color)', boxShadow: 'var(--shadow-sm)' }} bodyStyle={{ padding: 24 }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 24, paddingLeft: 8 }}>
            {dashboardStats.recentActivity && dashboardStats.recentActivity.length > 0 ? (
              dashboardStats.recentActivity.map((log, i) => (
                <div key={i} style={{ display: 'flex', gap: 20, position: 'relative' }}>
                  {i !== dashboardStats.recentActivity.length - 1 && <div style={{ position: 'absolute', top: 24, left: 6, width: 2, height: 'calc(100% + 4px)', background: 'var(--border-color)' }} />}
                  <div style={{ width: 14, height: 14, borderRadius: '50%', background: log.dot || 'var(--accent-primary)', border: '3px solid var(--bg-secondary)', zIndex: 1, marginTop: 4, boxShadow: `0 0 0 1px ${log.dot || 'var(--accent-primary)'}` }} />
                  <div>
                    <strong style={{ fontSize: 14, color: 'var(--text-primary)' }}>{log.user}</strong> <span style={{ fontSize: 14, color: 'var(--text-secondary)', fontWeight: 500 }}>{log.action}</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 8 }}>
                      <Tag style={{ margin: 0, borderRadius: 12, border: 'none', background: 'var(--bg-tertiary)', color: 'var(--text-secondary)', fontSize: 12, fontWeight: 600 }}>{log.site}</Tag>
                      <Text type="secondary" style={{ fontSize: 12, fontWeight: 500 }}>{log.time}</Text>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div style={{ padding: '20px 0', textAlign: 'center', color: 'var(--text-tertiary)' }}>
                No recent activity found
              </div>
            )}
          </div>
        </Card>
      </motion.div>
    </motion.div>
  );
};

  return (
    <motion.div variants={containerVariants} initial="hidden" animate="visible">
      <motion.div variants={itemVariants} style={{ marginBottom: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16 }}>
        <div>
          <Title level={2} style={{ margin: '4px 0 0 0', fontWeight: 900 }}>Websites</Title>
          <Text type="secondary" style={{ fontSize: 15, fontWeight: 500 }}>Build, launch, and optimize every client website — AI-powered, drag-and-drop, with forms, and domain management built in.</Text>
        </div>
      </motion.div>

      {/* Tabs Navigation */}
      <motion.div variants={itemVariants} style={{ display: 'flex', gap: 12, borderBottom: '1px solid var(--border-color)', marginBottom: 32, overflowX: 'auto', paddingBottom: 0 }}>
        {tabs.map((tab) => (
          <div
            key={tab.id}
            onClick={() => handleTabClick(tab.id)}
            style={{
              padding: '12px 16px',
              color: activeTab === tab.id ? 'var(--text-primary)' : 'var(--text-secondary)',
              borderBottom: activeTab === tab.id ? '3px solid var(--accent-primary)' : '3px solid transparent',
              fontWeight: activeTab === tab.id ? 800 : 600,
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              marginBottom: -1,
              transition: 'all 0.2s',
            }}
          >
            {tab.icon} {tab.label}
          </div>
        ))}
      </motion.div>

      {/* Tab Content Area */}
      <motion.div
        initial="hidden"
        animate="visible"
        variants={{
          hidden: { opacity: 0, y: 10 },
          visible: { opacity: 1, y: 0, transition: { duration: 0.2, staggerChildren: 0.05 } }
        }}
      >
        <Routes>

          <Route path="websites/wordpress/:id/dashboard" element={<WordPressDashboard />} />
          <Route path="websites/wordpress/:id/pages" element={<WordPressPages />} />
          <Route path="websites/wordpress/:id/posts" element={<WordPressPosts />} />
          <Route path="websites/wordpress/:id/media" element={<WordPressMedia />} />
          <Route path="websites/wordpress/:id/products" element={<WordPressProducts />} />
          <Route path="websites/wordpress/:id/orders" element={<WordPressOrders />} />
          <Route path="websites/*" element={<WebsitesTab itemVariants={itemVariants} initialAction={websiteInitialAction} onActionComplete={() => setWebsiteInitialAction(null)} />} />

          <Route path="forms" element={<FormsTab itemVariants={itemVariants} />} />
          <Route path="blogs" element={<BlogsTab itemVariants={itemVariants} />} />
          <Route path="qr-links" element={<QRLinksTab itemVariants={itemVariants} />} />
          <Route path="chat-widgets" element={<ChatWidgetsTab itemVariants={itemVariants} />} />
          <Route path="domains" element={<DomainsTab itemVariants={itemVariants} />} />
          <Route path="overview" element={renderOverviewContent()} />
          <Route path="*" element={<Navigate to={`${basePath}/${role === 'agency_client' ? 'websites' : 'overview'}`} replace />} />
        </Routes>

      </motion.div>
    </motion.div>
  );
};

export default WebsiteBuilder;
