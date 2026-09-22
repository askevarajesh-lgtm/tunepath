import React, { useState, useEffect } from 'react';
import { Modal, Form, Input, InputNumber, Select, DatePicker, Button, Row, Col, Typography, message, Spin, Space, Card, Tag, Switch, Table, Alert, Pagination } from 'antd';
import { 
  RefreshCw, Save, Send, Sparkles, FileText, Share2, Layers, Award, Plus, Trash2, 
  Megaphone, Download, TrendingUp, Eye 
} from 'lucide-react';
import dayjs from 'dayjs';
import api from '../../../services/api';
import { 
  getMonthlyHighlights, 
  upsertMonthlyHighlights, 
  getMetaLeadCampaigns, 
  getMetaReachCampaigns,
  generateReport 
} from '../../../api/reportApi';
import { semrushApi } from '../../../api/semrushApi';
import { useClientContext } from '../../../contexts/ClientContext';
import { 
  generateHighlightsOfTheMonthPDF,
  generateKeywordsCombinedPDF,
  generateMetaInsightsCombinedPDF,
  generateWebsiteTrafficCombinedPDF,
  generateSocialMediaInsightsCombinedPDF,
  generateMetaCampaignCombinedPDF,
  generateKeywordRankingOverviewPDF,
  generateKeywordRankingDetailsPDF,
  generateMetaInsightsFacebookPDF,
  generateMetaInsightsInstagramPDF,
  generateWebsiteTrafficOverviewPDF,
  generateWebsiteTrafficLandingPagesPDF,
  generateWebsiteTrafficUsersByCityPDF,
  generateSocialMediaPostInsightsPDF,
  generateYouTubeReportPDF
} from '../../../utils/monthlyHighlightsPdfGenerator';
import { generateMetaLeadCampaignPDF } from '../../../utils/metaLeadCampaignPdfGenerator';
import { generateMetaReachCampaignPDF } from '../../../utils/metaReachCampaignPdfGenerator';

const { Title, Text } = Typography;
const { Option } = Select;
const { TextArea } = Input;

const REPORT_TYPES = [
  { value: 'Highlights of the Month', label: '1. Highlight of the Month', icon: Sparkles, color: '#8b5cf6', desc: 'Management-level summary of completed deliverables, blogs, offline collaterals & special initiatives' },
  { value: 'Keywords', label: '2. Keywords', icon: TrendingUp, color: '#10b981', desc: 'Organic keyword ranking performance including Overview (Top 10/20/30) & Granular Ranking Details' },
  { value: 'Meta Campaign', label: '3. Meta Campaign', icon: Megaphone, color: '#3b82f6', desc: 'Campaign-wise reporting for connected Meta Lead Campaigns & Meta Reach Campaigns' },
  { value: 'Meta Insights', label: '4. Meta Insights', icon: Share2, color: '#1877f2', desc: 'Monthly profile performance for Facebook Page Insights & Instagram Profile Insights' },
  { value: 'Website Traffic', label: '5. Website Traffic', icon: Eye, color: '#0284c7', desc: 'Google Analytics traffic metrics including Traffic Overview, Landing Page Views, and Users by City' },
  { value: 'Social Media Post Insights', label: '6. Social Media Post Insights', icon: Share2, color: '#ec4899', desc: 'Monthly content creation metrics including Published Post Insights (Video/Post) & YouTube Report' }
];

const getNormalizedReportType = (rt) => {
  if (!rt) return 'Highlights of the Month';
  if (rt === 'Keywords' || rt.includes('Keyword')) return 'Keywords';
  if (rt === 'Meta Campaign' || rt.includes('Meta Campaign') || rt.includes('Lead') || rt.includes('Reach')) return 'Meta Campaign';
  if (rt === 'Meta Insights' || rt.includes('Meta Insights') || rt.includes('Facebook') || rt.includes('Instagram')) return 'Meta Insights';
  if (rt === 'Website Traffic' || rt.includes('Website Traffic') || rt.includes('Landing') || rt.includes('City')) return 'Website Traffic';
  if (rt === 'Social Media Post Insights' || rt.includes('Social Media') || rt.includes('YouTube') || rt.includes('Post Insights')) return 'Social Media Post Insights';
  return 'Highlights of the Month';
};

const sanitizeClientId = (val) => {
  if (!val || val === 'all' || val === '[object Object]') return null;
  if (typeof val === 'object' && val._id) return String(val._id);
  if (typeof val === 'string' && val.length > 5) return val;
  return null;
};

const CreateReportModal = ({ visible, onClose, clients = [], defaultClientId = null, defaultReportType = 'Highlights of the Month', defaultDate = null, onSuccess }) => {
  const { selectedClient: headerSelectedClient } = useClientContext();
  const [form] = Form.useForm();
  const [reportType, setReportType] = useState(defaultReportType || 'Highlights of the Month');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [reportDateRange, setReportDateRange] = useState(() => {
    if (defaultDate) {
      if (defaultDate.fromDate && defaultDate.toDate) {
        return {
          fromDate: defaultDate.fromDate,
          toDate: defaultDate.toDate,
          label: defaultDate.label || `${dayjs(defaultDate.fromDate).format('MMM D')} - ${dayjs(defaultDate.toDate).format('MMM D')}`,
          filterType: defaultDate.filterType || 'custom'
        };
      }
      return {
        fromDate: dayjs(defaultDate).startOf('month').format('YYYY-MM-DD'),
        toDate: dayjs(defaultDate).endOf('month').format('YYYY-MM-DD'),
        label: dayjs(defaultDate).format('MMMM YYYY'),
        filterType: 'custom'
      };
    }
    return {
      fromDate: dayjs().startOf('month').format('YYYY-MM-DD'),
      toDate: dayjs().endOf('month').format('YYYY-MM-DD'),
      label: 'This Month',
      filterType: 'thisMonth'
    };
  });
  const [selectedClient, setSelectedClient] = useState(() => sanitizeClientId(defaultClientId));

  // SEO/AEO/GEO Module Projects State
  const [seoProjects, setSeoProjects] = useState([]);
  const [selectedProjectId, setSelectedProjectId] = useState(null);
  const [loadingProjects, setLoadingProjects] = useState(false);

  // Meta Lead Campaigns State
  const [metaReportData, setMetaReportData] = useState({ campaigns: [], summary: {} });
  // Meta Reach Campaigns State
  const [metaReachReportData, setMetaReachReportData] = useState({ campaigns: [], summary: {} });

  // MoM / SEO / Social Media Highlights State
  const [deliverablesList, setDeliverablesList] = useState([]);
  const [keywordRankingList, setKeywordRankingList] = useState([]);
  const [keywordDetailsList, setKeywordDetailsList] = useState([]);
  const [metaInsightsFacebookList, setMetaInsightsFacebookList] = useState([]);
  const [metaInsightsInstagramList, setMetaInsightsInstagramList] = useState([]);
  const [websiteTrafficList, setWebsiteTrafficList] = useState([]);
  const [websiteTrafficLandingPagesList, setWebsiteTrafficLandingPagesList] = useState([]);
  const [websiteTrafficUsersByCityList, setWebsiteTrafficUsersByCityList] = useState([]);
  const [landingPagesPage, setLandingPagesPage] = useState(1);
  const [landingPagesPageSize, setLandingPagesPageSize] = useState(5);
  const [overviewPage, setOverviewPage] = useState(1);
  const [overviewPageSize, setOverviewPageSize] = useState(5);
  const [cityPage, setCityPage] = useState(1);
  const [cityPageSize, setCityPageSize] = useState(5);
  const [keywordDetailsPage, setKeywordDetailsPage] = useState(1);
  const [keywordDetailsPageSize, setKeywordDetailsPageSize] = useState(10);
  const [hasSocialMediaModule, setHasSocialMediaModule] = useState(false);
  const [socialMediaPostInsights, setSocialMediaPostInsights] = useState({ videoCount: 0, postCount: 0, totalCount: 0 });
  const [youTubeReportList, setYouTubeReportList] = useState([]);

  // Fetch SEO/AEO/GEO projects from Semrush module
  useEffect(() => {
    const fetchSeoProjects = async () => {
      try {
        setLoadingProjects(true);
        const res = await semrushApi.getProjects();
        if (res.data?.success && Array.isArray(res.data.data)) {
          setSeoProjects(res.data.data);
        }
      } catch (err) {
        console.error('Failed to load SEO projects:', err);
      } finally {
        setLoadingProjects(false);
      }
    };
    if (visible) {
      fetchSeoProjects();
    }
  }, [visible]);

  useEffect(() => {
    if (visible) {
      const cleanDefaultId = sanitizeClientId(defaultClientId);
      const cleanHeaderId = sanitizeClientId(headerSelectedClient?._id);
      const firstClientId = (clients.length > 0 && clients[0]?._id) ? sanitizeClientId(clients[0]._id) : null;

      const activeClientId = cleanDefaultId || cleanHeaderId || firstClientId;

      if (activeClientId) {
        setSelectedClient(activeClientId);
      }
      const normType = getNormalizedReportType(defaultReportType);
      setReportType(normType);
      if (defaultDate) {
        if (defaultDate.fromDate && defaultDate.toDate) {
          setReportDateRange({
            fromDate: defaultDate.fromDate,
            toDate: defaultDate.toDate,
            label: defaultDate.label || `${dayjs(defaultDate.fromDate).format('MMM D')} - ${dayjs(defaultDate.toDate).format('MMM D')}`,
            filterType: defaultDate.filterType || 'custom'
          });
        } else {
          setReportDateRange({
            fromDate: dayjs(defaultDate).startOf('month').format('YYYY-MM-DD'),
            toDate: dayjs(defaultDate).endOf('month').format('YYYY-MM-DD'),
            label: dayjs(defaultDate).format('MMMM YYYY'),
            filterType: 'custom'
          });
        }
      }
      if (normType !== 'Keywords') {
        setSelectedProjectId(null);
      }
    }
  }, [visible, defaultClientId, headerSelectedClient, clients, defaultReportType, defaultDate]);

  const cachedMonthlyHighlightsRef = React.useRef(null);
  const cachedMetaCampaignRef = React.useRef({});

  const populateFormAndLists = (res, m, y) => {
    setHasSocialMediaModule(res.hasSocialMediaModule ?? false);
    form.setFieldsValue({
      facebookFollowersIncreased: res.digitalInsights?.facebookFollowersIncreased ?? 0,
      facebookTotalFollowers: res.digitalInsights?.facebookTotalFollowers ?? 0,
      facebookReach: res.digitalInsights?.facebookReach ?? 0,
      instagramFollowersIncreased: res.digitalInsights?.instagramFollowersIncreased ?? 0,
      instagramTotalFollowers: res.digitalInsights?.instagramTotalFollowers ?? 0,
      instagramReach: res.digitalInsights?.instagramReach ?? 0,
      blogsCount: res.blogs?.count ?? 0,
      blogsNotes: res.blogs?.notes ?? '',
      socialMediaPostDesignsCount: res.brandCommunicationDesign?.socialMediaPostDesignsCount ?? 0,
      videosCount: res.brandCommunicationDesign?.videosCount ?? 0,
      brandCommNotes: res.brandCommunicationDesign?.notes ?? '',
      offlineCollaterals: res.offlineCollaterals ?? '',
      specialInitiatives: res.specialInitiatives ?? '',
    });

    if (res.brandCommunicationDesign?.deliverables && Array.isArray(res.brandCommunicationDesign.deliverables)) {
      setDeliverablesList(res.brandCommunicationDesign.deliverables);
    } else {
      setDeliverablesList([]);
    }

    const monthAbbrs = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const defaultMonths = [];
    if (m && y) {
      for (let i = 1; i >= 0; i--) {
        const d = new Date(y, m - 1 - i, 1);
        defaultMonths.push(`${monthAbbrs[d.getMonth()]} ${d.getFullYear()}`);
      }
    } else {
      defaultMonths.push(reportDateRange.label);
    }

    if (res.keywordRankingOverview && Array.isArray(res.keywordRankingOverview) && res.keywordRankingOverview.length > 0) {
      setKeywordRankingList(res.keywordRankingOverview);
    } else {
      setKeywordRankingList(defaultMonths.map(mStr => ({ month: mStr, top10: 0, top20: 0, top30Above: 0 })));
    }

    if (res.keywordRankingDetails && Array.isArray(res.keywordRankingDetails) && res.keywordRankingDetails.length > 0) {
      setKeywordDetailsList(res.keywordRankingDetails);
    } else {
      setKeywordDetailsList([]);
    }

    if (res.metaInsightsFacebook && Array.isArray(res.metaInsightsFacebook) && res.metaInsightsFacebook.length > 0) {
      setMetaInsightsFacebookList(res.metaInsightsFacebook);
    } else {
      setMetaInsightsFacebookList(defaultMonths.map(mStr => ({ month: mStr, views: 0, reach: 0, followers: 0 })));
    }

    if (res.metaInsightsInstagram && Array.isArray(res.metaInsightsInstagram) && res.metaInsightsInstagram.length > 0) {
      setMetaInsightsInstagramList(res.metaInsightsInstagram);
    } else {
      setMetaInsightsInstagramList(defaultMonths.map(mStr => ({ month: mStr, views: 0, reach: 0, followers: 0 })));
    }

    if (res.websiteTrafficOverview && Array.isArray(res.websiteTrafficOverview) && res.websiteTrafficOverview.length > 0) {
      setWebsiteTrafficList(res.websiteTrafficOverview);
    } else {
      setWebsiteTrafficList(defaultMonths.map(mStr => ({ month: mStr, users: 0, newUsers: 0 })));
    }

    if (res.websiteTrafficLandingPages && Array.isArray(res.websiteTrafficLandingPages) && res.websiteTrafficLandingPages.length > 0) {
      setWebsiteTrafficLandingPagesList(res.websiteTrafficLandingPages);
    } else {
      setWebsiteTrafficLandingPagesList([]);
    }

    if (res.websiteTrafficUsersByCity && Array.isArray(res.websiteTrafficUsersByCity)) {
      setWebsiteTrafficUsersByCityList(res.websiteTrafficUsersByCity);
    } else {
      setWebsiteTrafficUsersByCityList([]);
    }

    if (res.youTubeReport && Array.isArray(res.youTubeReport) && res.youTubeReport.length > 0) {
      setYouTubeReportList(res.youTubeReport);
    } else {
      const defaultMonthStr = (m && y) ? `${monthAbbrs[m - 1]} ${y}` : reportDateRange.label;
      setYouTubeReportList([{ month: defaultMonthStr, views: 0, lastMonthSubscribers: 0, totalSubscribers: 0 }]);
    }

    if (res.socialMediaPostInsights) {
      setSocialMediaPostInsights(res.socialMediaPostInsights);
    } else {
      const v = res.brandCommunicationDesign?.videosCount ?? 0;
      const p = res.brandCommunicationDesign?.socialMediaPostDesignsCount ?? 0;
      setSocialMediaPostInsights({ videoCount: v, postCount: p, totalCount: v + p });
    }
  };

  const handleReportTypeChange = (newType) => {
    setReportType(newType);
    if (newType === 'Keywords') {
      setKeywordRankingList([]);
      setKeywordDetailsList([]);
    } else {
      setSelectedProjectId(null);
    }
  };

  const loadData = async (clientId, dateRange, refresh = false, projectId = null, currentType = null) => {
    const activeType = currentType || reportType;
    const isKeywordReport = activeType === 'Keywords' || activeType.includes('Keyword');
    const isMetaCampaign = activeType === 'Meta Campaign' || activeType.includes('Meta Campaign') || activeType.includes('Lead') || activeType.includes('Reach');
    const targetProjectId = projectId !== undefined && projectId !== null ? projectId : selectedProjectId;

    if (isKeywordReport && !targetProjectId) {
      setKeywordRankingList([]);
      setKeywordDetailsList([]);
      return;
    }

    const targetClientId = sanitizeClientId(clientId || selectedClient);
    if (!targetClientId && !targetProjectId) return;
    if (!dateRange) return;

    try {
      setLoading(true);
      const { fromDate, toDate, filterType } = dateRange;
      const cacheKey = `${targetClientId}_${fromDate}_${toDate}_${targetProjectId || 'none'}`;

      // Calculate default fallback m/y for the UI to use if we clear (so it fetches this month's data as the default behavior)
      const isCleared = filterType === 'clear' || (!fromDate && !toDate);
      const activeFrom = isCleared ? dayjs().startOf('month').format('YYYY-MM-DD') : fromDate;
      const activeTo = isCleared ? dayjs().endOf('month').format('YYYY-MM-DD') : toDate;
      
      const dFrom = dayjs(activeFrom);
      const m = dFrom.month() + 1;
      const y = dFrom.year();

      // 1. If Meta Campaign, fetch or use cached Meta Lead & Reach Data
      if (isMetaCampaign) {
        if (!refresh && cachedMetaCampaignRef.current[cacheKey]) {
          const cached = cachedMetaCampaignRef.current[cacheKey];
          setMetaReportData(cached.leadRes || { campaigns: [], summary: {} });
          setMetaReachReportData(cached.reachRes || { campaigns: [], summary: {} });
        } else {
          const [leadRes, reachRes] = await Promise.all([
            getMetaLeadCampaigns(targetClientId, isCleared ? null : activeFrom, isCleared ? null : activeTo).catch(() => ({ campaigns: [], summary: {} })),
            getMetaReachCampaigns(targetClientId, isCleared ? null : activeFrom, isCleared ? null : activeTo).catch(() => ({ campaigns: [], summary: {} }))
          ]);
          cachedMetaCampaignRef.current[cacheKey] = { leadRes, reachRes };
          setMetaReportData(leadRes || { campaigns: [], summary: {} });
          setMetaReachReportData(reachRes || { campaigns: [], summary: {} });
        }
        return;
      }

      // 2. If Keywords report, fetch for project
      if (isKeywordReport) {
        const monthAbbrs = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        const defaultMonths = [];
        for (let i = 1; i >= 0; i--) {
          const d = new Date(y, m - 1 - i, 1);
          defaultMonths.push(`${monthAbbrs[d.getMonth()]} ${d.getFullYear()}`);
        }

        let loadedKeywordOverview = null;
        let loadedKeywordDetails = null;

        try {
          const trackRes = await semrushApi.getPositionTracking(targetProjectId, refresh);
          if (trackRes.data?.data) {
            const tData = trackRes.data.data;
            if (Array.isArray(tData.keywordRankingOverview) && tData.keywordRankingOverview.length > 0) {
              loadedKeywordOverview = tData.keywordRankingOverview;
            }
            if (Array.isArray(tData.keywordRankingDetails) && tData.keywordRankingDetails.length > 0) {
              loadedKeywordDetails = tData.keywordRankingDetails;
            }
          }
        } catch (trackErr) {
          console.warn('Direct position tracking fetch note:', trackErr);
        }

        if (!loadedKeywordDetails || loadedKeywordDetails.length === 0) {
          const res = await getMonthlyHighlights(
            targetClientId,
            m,
            y,
            refresh,
            targetProjectId,
            isCleared ? null : activeFrom,
            isCleared ? null : activeTo
          );
          if (res) {
            if (res.keywordRankingOverview?.length > 0) loadedKeywordOverview = res.keywordRankingOverview;
            if (res.keywordRankingDetails?.length > 0) loadedKeywordDetails = res.keywordRankingDetails;
          }
        }

        if (loadedKeywordOverview && Array.isArray(loadedKeywordOverview) && loadedKeywordOverview.length > 0) {
          setKeywordRankingList(loadedKeywordOverview);
        } else {
          setKeywordRankingList(defaultMonths.map(mStr => ({ month: mStr, top10: 0, top20: 0, top30Above: 0 })));
        }

        if (loadedKeywordDetails && Array.isArray(loadedKeywordDetails) && loadedKeywordDetails.length > 0) {
          setKeywordDetailsList(loadedKeywordDetails);
        } else {
          setKeywordDetailsList([]);
        }
        return;
      }

      // 3. For Highlights, Meta Insights, Website Traffic, Social Media: check cache
      if (!refresh && cachedMonthlyHighlightsRef.current?.key === cacheKey && cachedMonthlyHighlightsRef.current?.data) {
        populateFormAndLists(cachedMonthlyHighlightsRef.current.data, m, y);
        return;
      }

      const res = await getMonthlyHighlights(
        targetClientId,
        m,
        y,
        refresh,
        null,
        isCleared ? null : activeFrom,
        isCleared ? null : activeTo
      );
      if (res) {
        cachedMonthlyHighlightsRef.current = { key: cacheKey, data: res };
        populateFormAndLists(res, dateRange.filterType === 'thisMonth' ? m : null, dateRange.filterType === 'thisMonth' ? y : null);
      }
    } catch (error) {
      console.error('Error loading report data:', error);
      message.error('Failed to load report details');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (visible) {
      const isKeywordReport = reportType === 'Keywords' || reportType.includes('Keyword');
      if (isKeywordReport) {
        if (selectedProjectId && reportDateRange) {
          loadData(selectedClient, reportDateRange, false, selectedProjectId, reportType);
        }
      } else {
        if (selectedClient && reportDateRange) {
          loadData(selectedClient, reportDateRange, false, null, reportType);
        }
      }
    }
  }, [visible, selectedClient, reportDateRange, reportType, selectedProjectId]);

  const handleSyncMetaAds = async () => {
    try {
      setSyncing(true);
      await api.post('/performance-ads/sync', { clientId: selectedClient !== 'all' ? selectedClient : undefined });
      message.success('Meta Ads performance data synced successfully!');
      await loadData(selectedClient, reportDateRange);
    } catch (err) {
      console.error('Meta sync error:', err);
      message.error('Failed to sync Meta Ads data');
    } finally {
      setSyncing(false);
    }
  };

  const getSelectedClientInfo = () => {
    if (reportType === 'Keywords' || reportType.includes('Keyword')) {
      if (selectedProjectId) {
        const proj = seoProjects.find(p => String(p._id) === String(selectedProjectId));
        if (proj) {
          const clientFromProj = clients.find(c => String(c._id) === String(proj.clientId));
          if (clientFromProj) {
            return {
              ...clientFromProj,
              name: proj.name || clientFromProj.name,
              companyName: proj.name || clientFromProj.companyName,
              domain: proj.domain || clientFromProj.domain
            };
          }
          return {
            _id: proj._id,
            name: proj.name,
            companyName: proj.name,
            domain: proj.domain,
            email: `${proj.name.toLowerCase().replace(/[^a-z0-9]/g, '')}@client.com`
          };
        }
      }
    }
    if (selectedClient === 'all') return { name: 'All Clients', companyName: 'All Clients' };
    const found = clients.find(c => String(c._id) === String(selectedClient));
    return found || { name: 'Client', companyName: 'Client' };
  };

  const handleDownloadPDF = async () => {
    const isKeywordReport = reportType === 'Keywords' || reportType.includes('Keyword');
    if (isKeywordReport && !selectedProjectId) {
      message.warning('Please select an SEO/AEO/GEO project to download the Keywords report.');
      return;
    }
    const clientInfo = getSelectedClientInfo();
    try {
      if (reportType === 'Meta Campaign' || reportType.includes('Meta Campaign')) {
        let leadData = metaReportData;
        let reachData = metaReachReportData;
        if ((!leadData.campaigns?.length && !reachData.campaigns?.length) && selectedClient) {
          const [lRes, rRes] = await Promise.all([
            getMetaLeadCampaigns(selectedClient).catch(() => ({ campaigns: [] })),
            getMetaReachCampaigns(selectedClient).catch(() => ({ campaigns: [] }))
          ]);
          leadData = lRes || { campaigns: [] };
          reachData = rRes || { campaigns: [] };
        }
        generateMetaCampaignCombinedPDF(leadData, reachData, clientInfo);
        message.success('Meta Campaign Report PDF downloaded');
      } else {
        const values = form.getFieldsValue();
        const dataPayload = {
          month: reportDateRange.filterType === 'thisMonth' ? dayjs(reportDateRange.fromDate).month() + 1 : undefined,
          year: reportDateRange.filterType === 'thisMonth' ? dayjs(reportDateRange.fromDate).year() : undefined,
          fromDate: reportDateRange.filterType !== 'thisMonth' ? reportDateRange.fromDate : undefined,
          toDate: reportDateRange.filterType !== 'thisMonth' ? reportDateRange.toDate : undefined,
          hasSocialMediaModule,
          digitalInsights: values,
          blogs: { count: values.blogsCount || 0, notes: values.blogsNotes },
          brandCommunicationDesign: { deliverables: deliverablesList, notes: values.brandCommNotes },
          offlineCollaterals: values.offlineCollaterals,
          specialInitiatives: values.specialInitiatives,
          keywordRankingOverview: keywordRankingList,
          keywordRankingDetails: keywordDetailsList,
          metaInsightsFacebook: metaInsightsFacebookList,
          metaInsightsInstagram: metaInsightsInstagramList,
          websiteTrafficOverview: websiteTrafficList,
          websiteTrafficLandingPages: websiteTrafficLandingPagesList,
          websiteTrafficUsersByCity: websiteTrafficUsersByCityList,
          socialMediaPostInsights: socialMediaPostInsights,
          youTubeReport: youTubeReportList
        };

        if (reportType === 'Keywords' || reportType.includes('Keyword')) {
          generateKeywordsCombinedPDF(dataPayload, clientInfo);
          message.success('Keywords Report PDF downloaded');
        } else if (reportType === 'Meta Insights' || reportType.includes('Meta Insights')) {
          generateMetaInsightsCombinedPDF(dataPayload, clientInfo);
          message.success('Meta Insights Report PDF downloaded');
        } else if (reportType === 'Website Traffic' || reportType.includes('Website Traffic')) {
          generateWebsiteTrafficCombinedPDF(dataPayload, clientInfo);
          message.success('Website Traffic Report PDF downloaded');
        } else if (reportType === 'Social Media Post Insights' || reportType.includes('Social Media')) {
          generateSocialMediaInsightsCombinedPDF(dataPayload, clientInfo);
          message.success('Social Media Post Insights PDF downloaded');
        } else {
          generateHighlightsOfTheMonthPDF(dataPayload, clientInfo);
          message.success('Highlight of the Month PDF downloaded');
        }
      }
    } catch (err) {
      console.error('Download PDF error:', err);
      message.error('Failed to generate PDF');
    }
  };

  const handlePublishAndSend = async () => {
    const isKeywordReport = reportType === 'Keywords' || reportType.includes('Keyword');
    if (isKeywordReport && !selectedProjectId) {
      message.warning('Please select an SEO/AEO/GEO project to send the Keywords report.');
      return;
    }
    if (!isKeywordReport && (!selectedClient || selectedClient === 'all')) {
      message.warning('Please select a specific client account to send the report.');
      return;
    }

    try {
      setSaving(true);
      const clientInfo = getSelectedClientInfo();
      const targetClientId = selectedClient && selectedClient !== 'all' 
        ? selectedClient 
        : (clientInfo._id || (clients.length > 0 ? clients[0]._id : null));

      const recipientEmail = clientInfo.email || `${clientInfo.companyName || clientInfo.name}@client.com`;

      // Save database state for non-standalone Meta Lead/Reach reports
      if (reportType !== 'Meta Campaign Insights – Lead Campaign' && reportType !== 'Meta Campaign Insights – Reach Campaign') {
        const values = await form.validateFields().catch(() => form.getFieldsValue());
        const payload = {
          clientId: targetClientId,
          projectId: selectedProjectId || undefined,
          month: reportDateRange.filterType === 'thisMonth' ? dayjs(reportDateRange.fromDate).month() + 1 : undefined,
          year: reportDateRange.filterType === 'thisMonth' ? dayjs(reportDateRange.fromDate).year() : undefined,
          fromDate: reportDateRange.filterType !== 'thisMonth' ? reportDateRange.fromDate : undefined,
          toDate: reportDateRange.filterType !== 'thisMonth' ? reportDateRange.toDate : undefined,
          status: 'Published',
          reportType: reportType,
          hasSocialMediaModule,
          digitalInsights: {
            facebookFollowersIncreased: values.facebookFollowersIncreased || 0,
            facebookTotalFollowers: values.facebookTotalFollowers || 0,
            facebookReach: values.facebookReach || 0,
            instagramFollowersIncreased: values.instagramFollowersIncreased || 0,
            instagramTotalFollowers: values.instagramTotalFollowers || 0,
            instagramReach: values.instagramReach || 0,
          },
          blogs: { count: values.blogsCount || 0, notes: values.blogsNotes || '' },
          brandCommunicationDesign: { deliverables: deliverablesList },
          offlineCollaterals: values.offlineCollaterals || '',
          specialInitiatives: values.specialInitiatives || '',
          keywordRankingOverview: keywordRankingList,
          keywordRankingDetails: keywordDetailsList,
          metaInsightsFacebook: metaInsightsFacebookList,
          metaInsightsInstagram: metaInsightsInstagramList,
          websiteTrafficOverview: websiteTrafficList,
          websiteTrafficLandingPages: websiteTrafficLandingPagesList,
          websiteTrafficUsersByCity: websiteTrafficUsersByCityList,
          socialMediaPostInsights: socialMediaPostInsights,
          youTubeReport: youTubeReportList
        };
        await upsertMonthlyHighlights(payload);
      }

      // Dispatch exact standalone report via API
      if (targetClientId) {
        await generateReport({
          clientId: targetClientId,
          template: reportType,
          recipients: [recipientEmail],
          deliveryMethod: 'Email'
        });
      }

      message.success(`Standalone "${reportType}" report sent to ${clientInfo.companyName || clientInfo.name}!`);
      if (onSuccess) onSuccess();
      onClose();
    } catch (error) {
      console.error('Error publishing report:', error);
      message.error('Failed to send report to client');
    } finally {
      setSaving(false);
    }
  };

  // List modification helpers
  const handleWebsiteTrafficUsersByCityChange = (index, field, value) => {
    const updated = [...websiteTrafficUsersByCityList];
    updated[index] = { ...updated[index], [field]: value };
    setWebsiteTrafficUsersByCityList(updated);
  };

  const handleYouTubeReportChange = (index, field, value) => {
    const updated = [...youTubeReportList];
    updated[index] = { ...updated[index], [field]: value };
    setYouTubeReportList(updated);
  };
  const handleDeliverableChange = (index, field, value) => {
    const updated = [...deliverablesList];
    const currentItem = { ...updated[index], [field]: value };
    if (field === 'total' || field === 'completed') {
      const tot = Math.max(0, Number(field === 'total' ? value : currentItem.total) || 0);
      const comp = Math.max(0, Number(field === 'completed' ? value : currentItem.completed) || 0);
      if (field !== 'remaining') {
        currentItem.remaining = Math.max(0, tot - comp);
      }
    }
    updated[index] = currentItem;
    setDeliverablesList(updated);

    const currentNotes = form.getFieldValue('brandCommNotes');
    const autoSummary = updated
      .filter(d => d.name && d.name.trim())
      .map(d => `${d.name} — Total: ${d.total || 0}, Completed: ${d.completed || 0}, Remaining: ${d.remaining ?? Math.max(0, (d.total || 0) - (d.completed || 0))}`)
      .join('; ');
    if (!currentNotes || currentNotes.includes('Completed') || currentNotes.includes('Total')) {
      form.setFieldsValue({ brandCommNotes: autoSummary });
    }
  };

  const handleAddDeliverable = () => {
    setDeliverablesList([
      ...deliverablesList,
      { name: '', total: 0, completed: 0, remaining: 0, unit: 'Completed' }
    ]);
  };

  const handleRemoveDeliverable = (index) => {
    const updated = deliverablesList.filter((_, i) => i !== index);
    setDeliverablesList(updated);
    const currentNotes = form.getFieldValue('brandCommNotes');
    const autoSummary = updated
      .filter(d => d.name && d.name.trim())
      .map(d => `${d.name} — Total: ${d.total || 0}, Completed: ${d.completed || 0}, Remaining: ${d.remaining ?? Math.max(0, (d.total || 0) - (d.completed || 0))}`)
      .join('; ');
    if (!currentNotes || currentNotes.includes('Completed') || currentNotes.includes('Total')) {
      form.setFieldsValue({ brandCommNotes: autoSummary });
    }
  };

  const metaColumns = [
    { title: 'Campaign Name', dataIndex: 'campaignName', key: 'campaignName', render: text => <strong style={{ color: 'var(--text-primary)' }}>{text}</strong> },
    { title: 'Type of Campaign', dataIndex: 'typeOfCampaign', key: 'typeOfCampaign', width: 140, render: text => <Tag color="blue" style={{ borderRadius: 12, padding: '2px 10px', fontWeight: 600, border: 'none' }}>{text || 'Lead'}</Tag> },
    { title: 'Amount Spent', dataIndex: 'amountSpent', key: 'amountSpent', align: 'right', render: text => <strong style={{ color: '#10b981' }}>{text}</strong> },
    { title: 'No. of Leads', dataIndex: 'noOfLeads', key: 'noOfLeads', align: 'right', render: text => <Text style={{ fontWeight: 700, fontSize: 14 }}>{text}</Text> },
    { title: 'CPL', dataIndex: 'cpl', key: 'cpl', align: 'right', render: text => <Text style={{ fontWeight: 600, color: 'var(--accent-primary)' }}>{text}</Text> }
  ];

  const metaReachColumns = [
    { title: 'Campaign Name', dataIndex: 'campaignName', key: 'campaignName', render: text => <strong style={{ color: 'var(--text-primary)' }}>{text}</strong> },
    { title: 'Type of Campaign', dataIndex: 'typeOfCampaign', key: 'typeOfCampaign', width: 140, render: text => <Tag color="magenta" style={{ borderRadius: 12, padding: '2px 10px', fontWeight: 600, border: 'none' }}>{text || 'Reach'}</Tag> },
    { title: 'Amount Spent', dataIndex: 'amountSpent', key: 'amountSpent', align: 'right', render: text => <strong style={{ color: '#10b981' }}>{text}</strong> },
    { title: 'Views', dataIndex: 'views', key: 'views', align: 'right', render: num => <Text style={{ fontWeight: 600 }}>{(num ?? 0).toLocaleString('en-IN')}</Text> },
    { title: 'Reach', dataIndex: 'reach', key: 'reach', align: 'right', render: num => <Text style={{ fontWeight: 600, color: '#3b82f6' }}>{(num ?? 0).toLocaleString('en-IN')}</Text> },
    { title: 'Followers Gained', dataIndex: 'followersGained', key: 'followersGained', align: 'right', render: num => <Text style={{ fontWeight: 700, color: '#ec4899' }}>{(num ?? 0).toLocaleString('en-IN')}</Text> }
  ];

  return (
    <Modal
      open={visible}
      onCancel={onClose}
      style={{ top: 20 }}
      width={1050}
      bodyStyle={{ maxHeight: 'calc(82vh - 110px)', overflowY: 'auto', paddingRight: 10 }}
      styles={{ body: { maxHeight: 'calc(82vh - 110px)', overflowY: 'auto', paddingRight: 10 } }}
      title={
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 40, height: 40, borderRadius: 12, background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.15), rgba(139, 92, 246, 0.15))', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid rgba(59, 130, 246, 0.2)' }}>
            <Sparkles size={22} color="var(--accent-primary)" />
          </div>
          <div>
            <Title level={4} style={{ margin: 0, fontWeight: 800 }}>Create Report</Title>
            <Text type="secondary" style={{ fontSize: 13 }}>Select a report type to generate and send custom single-topic reports for your clients.</Text>
          </div>
        </div>
      }
      footer={
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 4px' }}>
          <Button icon={<RefreshCw size={15} className={syncing ? 'spin' : ''} />} onClick={() => loadData(selectedClient, selectedDate, true, selectedProjectId)} disabled={loading || saving || ((reportType === 'Keywords' || reportType.includes('Keyword')) && !selectedProjectId)} style={{ borderRadius: 8 }}>
            Auto-Refetch Data
          </Button>
          <Space size="middle">
            <Button onClick={onClose} style={{ borderRadius: 8 }}>Cancel</Button>
            <Button icon={<Download size={15} />} onClick={handleDownloadPDF} style={{ borderRadius: 8, fontWeight: 600 }}>
              Download PDF
            </Button>
            <Button type="primary" icon={<Send size={15} />} onClick={handlePublishAndSend} loading={saving} style={{ background: 'var(--accent-primary)', borderRadius: 8, fontWeight: 600 }}>
              Publish & Send Report
            </Button>
          </Space>
        </div>
      }
      destroyOnClose
    >
      <Spin spinning={loading}>
        {/* TOP CONTROLS: Client Account / SEO Project, Report Type, Report Period */}
        <Card style={{ marginBottom: 20, borderRadius: 14, border: '1px solid var(--border-color)', background: 'var(--bg-secondary)' }} bodyStyle={{ padding: 18 }}>
          <Row gutter={[16, 16]} align="middle">
            <Col xs={24} md={7}>
              {reportType === 'Keywords' || reportType.includes('Keyword') ? (
                <>
                  <Text style={{ fontWeight: 600, display: 'block', marginBottom: 6, fontSize: 13 }}>SEO/AEO/GEO Project</Text>
                  <Select
                    style={{ width: '100%' }}
                    value={selectedProjectId}
                    onChange={(val) => {
                      setSelectedProjectId(val);
                      const proj = seoProjects.find(p => String(p._id) === String(val));
                      if (proj?.clientId) {
                        setSelectedClient(proj.clientId);
                      }
                      loadData(proj?.clientId || selectedClient, selectedDate, false, val);
                    }}
                    showSearch
                    placeholder="Select SEO/AEO/GEO project..."
                    optionFilterProp="children"
                    loading={loadingProjects}
                    notFoundContent="No SEO/AEO/GEO projects found"
                  >
                    {seoProjects.map(p => (
                      <Option key={p._id} value={p._id}>
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                          <span style={{ fontWeight: 600, fontSize: 13 }}>{p.name}</span>
                          <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{p.domain}</span>
                        </div>
                      </Option>
                    ))}
                  </Select>
                </>
              ) : (
                <>
                  <Text style={{ fontWeight: 600, display: 'block', marginBottom: 6, fontSize: 13 }}>Client Account</Text>
                  <Select
                    style={{ width: '100%' }}
                    value={selectedClient}
                    onChange={setSelectedClient}
                    showSearch
                    placeholder="Select client account..."
                    optionFilterProp="children"
                  >
                    {clients.map(c => (
                      <Option key={c._id} value={c._id}>
                        {c.companyName || c.name || c.brandName || 'Unnamed Client'}
                      </Option>
                    ))}
                  </Select>
                </>
              )}
            </Col>

            <Col xs={24} md={11}>
              <Text style={{ fontWeight: 600, display: 'block', marginBottom: 6, fontSize: 13 }}>Report Type</Text>
              <Select
                style={{ width: '100%' }}
                value={reportType}
                onChange={handleReportTypeChange}
                dropdownStyle={{ borderRadius: 12 }}
              >
                {REPORT_TYPES.map(r => (
                  <Option key={r.value} value={r.value}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <r.icon size={15} color={r.color} />
                      <strong style={{ fontSize: 13 }}>{r.value}</strong>
                    </div>
                  </Option>
                ))}
              </Select>
            </Col>

            <Col xs={24} md={6}>
              <Text style={{ fontWeight: 600, display: 'block', marginBottom: 6, fontSize: 13 }}>Report Period</Text>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <DatePicker.RangePicker
                  presets={[
                    { label: 'This Week', value: [dayjs().startOf('week'), dayjs().endOf('week')] },
                    { label: 'This Month', value: [dayjs().startOf('month'), dayjs().endOf('month')] }
                  ]}
                  value={reportDateRange.fromDate && reportDateRange.toDate && reportDateRange.filterType !== 'clear' ? [dayjs(reportDateRange.fromDate), dayjs(reportDateRange.toDate)] : null}
                  onChange={(dates) => {
                    if (dates && dates[0] && dates[1]) {
                      const isThisMonth = dates[0].isSame(dayjs().startOf('month'), 'day') && dates[1].isSame(dayjs().endOf('month'), 'day');
                      setReportDateRange({
                        fromDate: dates[0].format('YYYY-MM-DD'),
                        toDate: dates[1].format('YYYY-MM-DD'),
                        label: isThisMonth ? 'This Month' : `${dates[0].format('MMM D')} - ${dates[1].format('MMM D')}`,
                        filterType: isThisMonth ? 'thisMonth' : 'custom'
                      });
                    }
                  }}
                  allowClear={false}
                  style={{ flex: 1 }}
                  getPopupContainer={(triggerNode) => triggerNode.parentNode}
                />
                <Button 
                  onClick={() => {
                    setReportDateRange({
                      fromDate: null,
                      toDate: null,
                      label: '',
                      filterType: 'clear'
                    });
                  }}
                  disabled={reportDateRange.filterType === 'clear' || (!reportDateRange.fromDate && !reportDateRange.toDate)}
                >
                  Clear
                </Button>
              </div>
            </Col>
          </Row>
        </Card>

        {/* DYNAMIC FORM/TABLE RENDERING FOR THE EXACT SELECTED REPORT TYPE */}

        {/* 1. HIGHLIGHTS OF THE MONTH */}
        {reportType === 'Highlights of the Month' && (
          <div>
            <div style={{ marginBottom: 16 }}>
              <Title level={5} style={{ margin: 0, fontWeight: 700 }}>Highlights of the Month</Title>
              <Text type="secondary" style={{ fontSize: 12 }}>Summary of blogs, content deliverables, offline branding, and key achievements for the month.</Text>
            </div>

            <Alert
              message="Report Requirement Fields"
              description="Blogs & Articles | Brand Communication & Deliverables | Offline Collaterals & Special Initiatives"
              type="info"
              showIcon
              style={{ marginBottom: 16, borderRadius: 10 }}
            />

            <Row gutter={[12, 12]} style={{ marginBottom: 16 }}>
              <Col span={8}>
                <Card bodyStyle={{ padding: '14px' }} style={{ borderRadius: 10, background: 'var(--bg-secondary)', border: '1px solid var(--border-color)' }}>
                  <Text type="secondary" style={{ fontSize: 11, fontWeight: 600 }}>BLOG UPDATES</Text>
                  <Title level={4} style={{ margin: '4px 0 0 0', color: '#10b981', fontWeight: 800 }}>{form.getFieldValue('blogsCount') || 0}</Title>
                </Card>
              </Col>
              <Col span={8}>
                <Card bodyStyle={{ padding: '14px' }} style={{ borderRadius: 10, background: 'var(--bg-secondary)', border: '1px solid var(--border-color)' }}>
                  <Text type="secondary" style={{ fontSize: 11, fontWeight: 600 }}>DELIVERABLES ADDED</Text>
                  <Title level={4} style={{ margin: '4px 0 0 0', color: '#8b5cf6', fontWeight: 800 }}>{deliverablesList.length}</Title>
                </Card>
              </Col>
              <Col span={8}>
                <Card bodyStyle={{ padding: '14px' }} style={{ borderRadius: 10, background: 'var(--bg-secondary)', border: '1px solid var(--border-color)' }}>
                  <Text type="secondary" style={{ fontSize: 11, fontWeight: 600 }}>SPECIAL INITIATIVES</Text>
                  <Title level={4} style={{ margin: '4px 0 0 0', color: '#3b82f6', fontWeight: 800 }}>Active</Title>
                </Card>
              </Col>
            </Row>

            <Form form={form} layout="vertical">
              <Card size="small" title={<div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><FileText size={16} color="#10b981" /><strong style={{ fontSize: 14 }}>Blogs & Articles</strong></div>} style={{ marginBottom: 16, borderRadius: 12 }}>
                <Row gutter={[16, 0]}>
                  <Col span={6}>
                    <Form.Item name="blogsCount" label="Number of Blog Updates">
                      <InputNumber style={{ width: '100%' }} min={0} placeholder="0" />
                    </Form.Item>
                  </Col>
                  <Col span={18}>
                    <Form.Item name="blogsNotes" label="Blog Notes / Topics (Optional)">
                      <Input placeholder="e.g., Published 2 articles on Orthopedic health tips & IVF treatments" />
                    </Form.Item>
                  </Col>
                </Row>
              </Card>

              <Card
                size="small"
                title={
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <Layers size={16} color="#8b5cf6" />
                      <strong style={{ fontSize: 14 }}>Brand Communication & Deliverables</strong>
                      <Tag color="purple" style={{ borderRadius: 10, fontWeight: 600, fontSize: 11, margin: 0 }}>
                        {deliverablesList.length} Categories
                      </Tag>
                    </div>
                    <Button type="dashed" size="small" icon={<Plus size={14} />} onClick={handleAddDeliverable}>
                      Add Deliverable
                    </Button>
                  </div>
                }
                style={{ marginBottom: 16, borderRadius: 12 }}
              >
                {deliverablesList.length > 0 ? (
                  <div style={{ marginBottom: 16 }}>
                    {/* Column Headers */}
                    <Row gutter={[10, 8]} align="middle" style={{ padding: '6px 12px', background: 'rgba(0,0,0,0.03)', borderRadius: 6, marginBottom: 8, fontWeight: 700, fontSize: 11, color: 'var(--text-secondary)' }}>
                      <Col span={8}>DELIVERABLE / CATEGORY</Col>
                      <Col span={4} style={{ textAlign: 'center' }}>TOTAL</Col>
                      <Col span={4} style={{ textAlign: 'center', color: '#10b981' }}>COMPLETED</Col>
                      <Col span={4} style={{ textAlign: 'center', color: '#6366f1' }}>REMAINING</Col>
                      <Col span={2} style={{ textAlign: 'center' }}>STATUS</Col>
                      <Col span={2} style={{ textAlign: 'right' }}>ACTION</Col>
                    </Row>

                    {deliverablesList.map((item, idx) => {
                      const totalVal = Number(item.total) || 0;
                      const compVal = Number(item.completed) || 0;
                      const remVal = (item.remaining !== undefined && item.remaining !== null)
                        ? Number(item.remaining)
                        : Math.max(0, totalVal - compVal);
                      const isComplete = totalVal > 0 && compVal >= totalVal;

                      return (
                        <Row
                          key={idx}
                          gutter={[10, 8]}
                          align="middle"
                          style={{
                            background: 'var(--bg-secondary)',
                            padding: '8px 12px',
                            borderRadius: 8,
                            marginBottom: 8,
                            border: '1px solid var(--border-color)',
                            transition: 'all 0.2s'
                          }}
                        >
                          <Col span={8}>
                            <Input
                              placeholder="e.g. Posters, Videos..."
                              value={item.name}
                              onChange={e => handleDeliverableChange(idx, 'name', e.target.value)}
                              style={{ fontWeight: 600 }}
                            />
                          </Col>
                          <Col span={4}>
                            <InputNumber
                              style={{ width: '100%' }}
                              min={0}
                              placeholder="Total"
                              value={item.total}
                              onChange={val => handleDeliverableChange(idx, 'total', val || 0)}
                            />
                          </Col>
                          <Col span={4}>
                            <InputNumber
                              style={{ width: '100%', borderColor: '#10b981' }}
                              min={0}
                              placeholder="Completed"
                              value={item.completed}
                              onChange={val => handleDeliverableChange(idx, 'completed', val || 0)}
                            />
                          </Col>
                          <Col span={4}>
                            <InputNumber
                              style={{ width: '100%', borderColor: '#6366f1' }}
                              min={0}
                              placeholder="Remaining"
                              value={remVal}
                              onChange={val => handleDeliverableChange(idx, 'remaining', val || 0)}
                            />
                          </Col>
                          <Col span={2} style={{ textAlign: 'center' }}>
                            <Tag
                              color={isComplete ? 'success' : (compVal > 0 ? 'processing' : 'default')}
                              style={{ margin: 0, fontWeight: 600, borderRadius: 6, fontSize: 11 }}
                            >
                              {compVal}/{totalVal}
                            </Tag>
                          </Col>
                          <Col span={2} style={{ textAlign: 'right' }}>
                            <Button
                              type="text"
                              danger
                              icon={<Trash2 size={15} />}
                              onClick={() => handleRemoveDeliverable(idx)}
                            />
                          </Col>
                        </Row>
                      );
                    })}
                  </div>
                ) : (
                  <div style={{ padding: '16px', textAlign: 'center', background: 'var(--bg-secondary)', borderRadius: 8, marginBottom: 16, color: 'var(--text-secondary)' }}>
                    No deliverables found for this client. Click <strong>+ Add Deliverable</strong> to add posters, videos, or custom categories.
                  </div>
                )}
                <Form.Item name="brandCommNotes" label="Summary Notes (Optional)">
                  <Input placeholder="Summary of brand communication deliverables..." />
                </Form.Item>
              </Card>

              <Card size="small" title={<strong style={{ fontSize: 14 }}>Offline Collaterals & Special Initiatives</strong>} style={{ marginBottom: 16, borderRadius: 12 }}>
                <Form.Item name="offlineCollaterals" label="Offline Collaterals & Internal Branding">
                  <TextArea rows={2} placeholder="Clinic standees, visiting cards..." />
                </Form.Item>
                <Form.Item name="specialInitiatives" label="Special Initiatives & Campaigns">
                  <TextArea rows={2} placeholder="Free checkup campaign branding..." />
                </Form.Item>
              </Card>
            </Form>
          </div>
        )}

        {/* 2. KEYWORD RANKING OVERVIEW & DETAILS */}
        {(reportType === 'Keywords' || reportType.includes('Keyword')) && (
          !selectedProjectId ? (
            <Card style={{ textAlign: 'center', padding: '40px 20px', borderRadius: 14, background: 'var(--bg-secondary)', border: '1px dashed var(--border-color)', marginBottom: 20 }}>
              <TrendingUp size={40} color="var(--accent-primary)" style={{ margin: '0 auto 12px auto', opacity: 0.8 }} />
              <Title level={4} style={{ margin: '0 0 8px 0', fontWeight: 700 }}>Select an SEO/AEO/GEO Project</Title>
              <Text type="secondary" style={{ fontSize: 13, display: 'block', maxWidth: 480, margin: '0 auto' }}>
                Please select a project from the SEO/AEO/GEO module in the dropdown above to load and customize its keyword ranking performance data.
              </Text>
            </Card>
          ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <div>
                  <Title level={5} style={{ margin: 0, fontWeight: 700 }}>Keyword Ranking Overview</Title>
                  <Text type="secondary" style={{ fontSize: 12 }}>Show overall organic keyword-ranking performance for the selected month and compare it with previous months.</Text>
                </div>
                <Button type="dashed" size="small" icon={<Plus size={14} />} onClick={() => setKeywordRankingList([...keywordRankingList, { month: selectedDate.format('MMM YYYY'), top10: 0, top20: 0, top30Above: 0 }])}>
                  Add Month Row
                </Button>
              </div>

              <Alert
                message="Report Requirement Fields"
                description="Month: Reporting month | Top 10 (1-10): Keywords ranked 1 to 10 | Top 20 (1-20): Keywords ranked 1 to 20 | Top 30 Above: Keywords ranked >30"
                type="info"
                showIcon
                style={{ marginBottom: 16, borderRadius: 10 }}
              />

              <Row gutter={[12, 12]} style={{ marginBottom: 16 }}>
                <Col span={8}>
                  <Card bodyStyle={{ padding: '14px' }} style={{ borderRadius: 10, background: 'var(--bg-secondary)', border: '1px solid var(--border-color)' }}>
                    <Text type="secondary" style={{ fontSize: 11, fontWeight: 600 }}>TOP 10 KEYWORDS</Text>
                    <Title level={4} style={{ margin: '4px 0 0 0', color: '#10b981', fontWeight: 800 }}>{keywordRankingList[keywordRankingList.length - 1]?.top10 || 0}</Title>
                  </Card>
                </Col>
                <Col span={8}>
                  <Card bodyStyle={{ padding: '14px' }} style={{ borderRadius: 10, background: 'var(--bg-secondary)', border: '1px solid var(--border-color)' }}>
                    <Text type="secondary" style={{ fontSize: 11, fontWeight: 600 }}>TOP 20 KEYWORDS</Text>
                    <Title level={4} style={{ margin: '4px 0 0 0', color: '#3b82f6', fontWeight: 800 }}>{keywordRankingList[keywordRankingList.length - 1]?.top20 || 0}</Title>
                  </Card>
                </Col>
                <Col span={8}>
                  <Card bodyStyle={{ padding: '14px' }} style={{ borderRadius: 10, background: 'var(--bg-secondary)', border: '1px solid var(--border-color)' }}>
                    <Text type="secondary" style={{ fontSize: 11, fontWeight: 600 }}>TOP 30 ABOVE</Text>
                    <Title level={4} style={{ margin: '4px 0 0 0', color: '#8b5cf6', fontWeight: 800 }}>{keywordRankingList[keywordRankingList.length - 1]?.top30Above || 0}</Title>
                  </Card>
                </Col>
              </Row>

              <Card size="small" style={{ borderRadius: 12 }}>
                {keywordRankingList.map((item, idx) => (
                  <Row key={idx} gutter={[12, 8]} align="middle" style={{ background: 'var(--bg-secondary)', padding: '10px 14px', borderRadius: 8, marginBottom: 8 }}>
                    <Col span={6}><Text style={{ fontSize: 11, fontWeight: 600 }}>Month</Text><Input value={item.month} onChange={e => { const updated = [...keywordRankingList]; updated[idx].month = e.target.value; setKeywordRankingList(updated); }} /></Col>
                    <Col span={5}><Text style={{ fontSize: 11 }}>Top 10 (1-10)</Text><InputNumber style={{ width: '100%' }} value={item.top10} onChange={val => { const updated = [...keywordRankingList]; updated[idx].top10 = val || 0; setKeywordRankingList(updated); }} /></Col>
                    <Col span={5}><Text style={{ fontSize: 11 }}>Top 20 (1-20)</Text><InputNumber style={{ width: '100%' }} value={item.top20} onChange={val => { const updated = [...keywordRankingList]; updated[idx].top20 = val || 0; setKeywordRankingList(updated); }} /></Col>
                    <Col span={5}><Text style={{ fontSize: 11 }}>Top 30 Above</Text><InputNumber style={{ width: '100%' }} value={item.top30Above} onChange={val => { const updated = [...keywordRankingList]; updated[idx].top30Above = val || 0; setKeywordRankingList(updated); }} /></Col>
                    <Col span={3} style={{ textAlign: 'right' }}><Button type="text" danger icon={<Trash2 size={16} />} onClick={() => setKeywordRankingList(keywordRankingList.filter((_, i) => i !== idx))} /></Col>
                  </Row>
                ))}
              </Card>
            </div>

            {/* Keyword Ranking Details */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <div>
                  <Title level={5} style={{ margin: 0, fontWeight: 700 }}>Keyword Ranking Details</Title>
                  <Text type="secondary" style={{ fontSize: 12 }}>Granular organic keyword rankings, search volumes, categories, and month-wise rank trends.</Text>
                </div>
                <Button 
                  type="dashed" 
                  size="small" 
                  icon={<Plus size={14} />} 
                  onClick={() => {
                    const newList = [...keywordDetailsList, { keyword: '', category: 'General', volume: 0, monthRanks: [{ month: selectedDate.format('MMM YYYY'), rank: '-' }] }];
                    setKeywordDetailsList(newList);
                    const lastPage = Math.ceil(newList.length / keywordDetailsPageSize);
                    setKeywordDetailsPage(lastPage);
                  }}
                >
                  Add Keyword Detail
                </Button>
              </div>

              <Alert
                message="Report Requirement Fields"
                description="Keyword: Search term | Category: Topic group | Volume: Monthly search volume | Rank History: Month-by-month ranking"
                type="info"
                showIcon
                style={{ marginBottom: 16, borderRadius: 10 }}
              />

              <Row gutter={[12, 12]} style={{ marginBottom: 16 }}>
                <Col span={12}>
                  <Card bodyStyle={{ padding: '14px' }} style={{ borderRadius: 10, background: 'var(--bg-secondary)', border: '1px solid var(--border-color)' }}>
                    <Text type="secondary" style={{ fontSize: 11, fontWeight: 600 }}>KEYWORDS TRACKED</Text>
                    <Title level={4} style={{ margin: '4px 0 0 0', color: '#10b981', fontWeight: 800 }}>{keywordDetailsList.length}</Title>
                  </Card>
                </Col>
                <Col span={12}>
                  <Card bodyStyle={{ padding: '14px' }} style={{ borderRadius: 10, background: 'var(--bg-secondary)', border: '1px solid var(--border-color)' }}>
                    <Text type="secondary" style={{ fontSize: 11, fontWeight: 600 }}>TOTAL SEARCH VOLUME</Text>
                    <Title level={4} style={{ margin: '4px 0 0 0', color: '#3b82f6', fontWeight: 800 }}>{keywordDetailsList.reduce((acc, k) => acc + (k.volume || 0), 0).toLocaleString()}</Title>
                  </Card>
                </Col>
              </Row>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {keywordDetailsList.length > 0 ? (
                  <>
                    {keywordDetailsList
                      .slice((keywordDetailsPage - 1) * keywordDetailsPageSize, keywordDetailsPage * keywordDetailsPageSize)
                      .map((item, idx) => {
                        const globalIdx = (keywordDetailsPage - 1) * keywordDetailsPageSize + idx;
                        return (
                          <Card key={globalIdx} size="small" style={{ background: 'var(--bg-secondary)', borderRadius: 10 }}>
                            <Row gutter={[12, 8]} align="middle">
                              <Col span={10}>
                                <Input 
                                  placeholder="Keyword" 
                                  value={item.keyword} 
                                  onChange={e => { 
                                    const updated = [...keywordDetailsList]; 
                                    updated[globalIdx].keyword = e.target.value; 
                                    setKeywordDetailsList(updated); 
                                  }} 
                                />
                              </Col>
                              <Col span={8}>
                                <Input 
                                  placeholder="Category" 
                                  value={item.category} 
                                  onChange={e => { 
                                    const updated = [...keywordDetailsList]; 
                                    updated[globalIdx].category = e.target.value; 
                                    setKeywordDetailsList(updated); 
                                  }} 
                                />
                              </Col>
                              <Col span={4}>
                                <InputNumber 
                                  style={{ width: '100%' }} 
                                  placeholder="Volume" 
                                  value={item.volume} 
                                  onChange={val => { 
                                    const updated = [...keywordDetailsList]; 
                                    updated[globalIdx].volume = val || 0; 
                                    setKeywordDetailsList(updated); 
                                  }} 
                                />
                              </Col>
                              <Col span={2} style={{ textAlign: 'right' }}>
                                <Button 
                                  type="text" 
                                  danger 
                                  icon={<Trash2 size={16} />} 
                                  onClick={() => {
                                    const newList = keywordDetailsList.filter((_, i) => i !== globalIdx);
                                    setKeywordDetailsList(newList);
                                    if ((keywordDetailsPage - 1) * keywordDetailsPageSize >= newList.length && keywordDetailsPage > 1) {
                                      setKeywordDetailsPage(keywordDetailsPage - 1);
                                    }
                                  }} 
                                />
                              </Col>
                            </Row>
                          </Card>
                        );
                      })}

                    <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 12 }}>
                      <Pagination
                        current={keywordDetailsPage}
                        pageSize={keywordDetailsPageSize}
                        total={keywordDetailsList.length}
                        onChange={(page, pageSize) => {
                          setKeywordDetailsPage(page);
                          setKeywordDetailsPageSize(pageSize);
                        }}
                        showSizeChanger
                        pageSizeOptions={['5', '10', '20', '50', '100']}
                        showTotal={(total, range) => `${range[0]}-${range[1]} of ${total} keywords`}
                      />
                    </div>
                  </>
                ) : (
                  <div style={{ padding: '24px 0', textAlign: 'center', color: 'var(--text-tertiary)' }}>No keyword details added yet. Click "Add Keyword Detail" to add manually.</div>
                )}
              </div>
            </div>
          </div>
        ))}

        {/* 3. META CAMPAIGN (LEAD & REACH) */}
        {(reportType === 'Meta Campaign' || reportType.includes('Meta Campaign')) && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            {/* Lead Campaigns */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <div>
                  <Title level={5} style={{ margin: 0, fontWeight: 700 }}>Meta Campaign Insights – Lead Campaign</Title>
                  <Text type="secondary" style={{ fontSize: 12 }}>Connected real Meta Lead campaigns from Performance Ads.</Text>
                </div>
                <Button icon={<RefreshCw size={14} className={syncing ? 'spin' : ''} />} loading={syncing} onClick={handleSyncMetaAds} style={{ borderRadius: 8, fontWeight: 600 }}>
                  Sync Meta Ads
                </Button>
              </div>

              <Alert
                message="Report Requirement Fields"
                description="Campaign Name | Type of Campaign: Lead | Amount Spent: Campaign spend | No. of Leads: Leads generated | CPL: Cost per lead"
                type="info"
                showIcon
                style={{ marginBottom: 16, borderRadius: 10 }}
              />

              <Row gutter={[12, 12]} style={{ marginBottom: 16 }}>
                <Col span={8}>
                  <Card bodyStyle={{ padding: '14px' }} style={{ borderRadius: 10, background: 'var(--bg-secondary)', border: '1px solid var(--border-color)' }}>
                    <Text type="secondary" style={{ fontSize: 11, fontWeight: 600 }}>AMOUNT SPENT</Text>
                    <Title level={4} style={{ margin: '4px 0 0 0', color: '#10b981', fontWeight: 800 }}>{metaReportData.summary?.totalAmountSpent || '₹0'}</Title>
                  </Card>
                </Col>
                <Col span={8}>
                  <Card bodyStyle={{ padding: '14px' }} style={{ borderRadius: 10, background: 'var(--bg-secondary)', border: '1px solid var(--border-color)' }}>
                    <Text type="secondary" style={{ fontSize: 11, fontWeight: 600 }}>NO. OF LEADS</Text>
                    <Title level={4} style={{ margin: '4px 0 0 0', fontWeight: 800 }}>{metaReportData.summary?.totalLeads ?? 0}</Title>
                  </Card>
                </Col>
                <Col span={8}>
                  <Card bodyStyle={{ padding: '14px' }} style={{ borderRadius: 10, background: 'var(--bg-secondary)', border: '1px solid var(--border-color)' }}>
                    <Text type="secondary" style={{ fontSize: 11, fontWeight: 600 }}>BLENDED CPL</Text>
                    <Title level={4} style={{ margin: '4px 0 0 0', color: '#3b82f6', fontWeight: 800 }}>{metaReportData.summary?.avgCpl || '₹0'}</Title>
                  </Card>
                </Col>
              </Row>

              <Table
                columns={metaColumns}
                dataSource={metaReportData.campaigns || []}
                rowKey="id"
                pagination={false}
                size="middle"
                bordered
              />
            </div>

            {/* Reach Campaigns */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <div>
                  <Title level={5} style={{ margin: 0, fontWeight: 700 }}>Meta Campaign Insights – Reach Campaign</Title>
                  <Text type="secondary" style={{ fontSize: 12 }}>Connected real Meta Reach campaigns from Performance Ads.</Text>
                </div>
              </div>

              <Alert
                message="Report Requirement Fields"
                description="Campaign Name | Type of Campaign: Reach | Amount Spent: Campaign spend | Views: Views generated | Reach: People reached | Followers Gained: Followers gained"
                type="info"
                showIcon
                style={{ marginBottom: 16, borderRadius: 10 }}
              />

              <Row gutter={[12, 12]} style={{ marginBottom: 16 }}>
                <Col span={6}>
                  <Card bodyStyle={{ padding: '14px' }} style={{ borderRadius: 10, background: 'var(--bg-secondary)', border: '1px solid var(--border-color)' }}>
                    <Text type="secondary" style={{ fontSize: 11, fontWeight: 600 }}>SPENT (INCL. GST)</Text>
                    <Title level={4} style={{ margin: '4px 0 0 0', color: '#10b981', fontWeight: 800 }}>{metaReachReportData.summary?.totalAmountSpentInclGst || '₹0'}</Title>
                  </Card>
                </Col>
                <Col span={6}>
                  <Card bodyStyle={{ padding: '14px' }} style={{ borderRadius: 10, background: 'var(--bg-secondary)', border: '1px solid var(--border-color)' }}>
                    <Text type="secondary" style={{ fontSize: 11, fontWeight: 600 }}>TOTAL VIEWS</Text>
                    <Title level={4} style={{ margin: '4px 0 0 0', fontWeight: 800 }}>{(metaReachReportData.summary?.totalViews ?? 0).toLocaleString('en-IN')}</Title>
                  </Card>
                </Col>
                <Col span={6}>
                  <Card bodyStyle={{ padding: '14px' }} style={{ borderRadius: 10, background: 'var(--bg-secondary)', border: '1px solid var(--border-color)' }}>
                    <Text type="secondary" style={{ fontSize: 11, fontWeight: 600 }}>TOTAL REACH</Text>
                    <Title level={4} style={{ margin: '4px 0 0 0', color: '#3b82f6', fontWeight: 800 }}>{(metaReachReportData.summary?.totalReach ?? 0).toLocaleString('en-IN')}</Title>
                  </Card>
                </Col>
                <Col span={6}>
                  <Card bodyStyle={{ padding: '14px' }} style={{ borderRadius: 10, background: 'var(--bg-secondary)', border: '1px solid var(--border-color)' }}>
                    <Text type="secondary" style={{ fontSize: 11, fontWeight: 600 }}>FOLLOWERS GAINED</Text>
                    <Title level={4} style={{ margin: '4px 0 0 0', color: '#ec4899', fontWeight: 800 }}>{(metaReachReportData.summary?.totalFollowersGained ?? 0).toLocaleString('en-IN')}</Title>
                  </Card>
                </Col>
              </Row>

              <Table
                columns={metaReachColumns}
                dataSource={metaReachReportData.campaigns || []}
                rowKey="id"
                pagination={false}
                size="middle"
                bordered
                summary={() => {
                  const summary = metaReachReportData.summary || {};
                  return (
                    <Table.Summary fixed>
                      <Table.Summary.Row style={{ background: 'var(--bg-secondary)', fontWeight: 800 }}>
                        <Table.Summary.Cell index={0}><Text style={{ fontWeight: 800 }}>Total (Including GST)</Text></Table.Summary.Cell>
                        <Table.Summary.Cell index={1} align="center"><Tag color="magenta" style={{ borderRadius: 12, padding: '2px 10px', fontWeight: 600, border: 'none' }}>Reach</Tag></Table.Summary.Cell>
                        <Table.Summary.Cell index={2} align="right"><Text style={{ fontWeight: 800, color: '#10b981' }}>{summary.totalAmountSpentInclGst || '₹0'}</Text></Table.Summary.Cell>
                        <Table.Summary.Cell index={3} align="right"><Text style={{ fontWeight: 800 }}>{(summary.totalViews ?? 0).toLocaleString('en-IN')}</Text></Table.Summary.Cell>
                        <Table.Summary.Cell index={4} align="right"><Text style={{ fontWeight: 800, color: '#3b82f6' }}>{(summary.totalReach ?? 0).toLocaleString('en-IN')}</Text></Table.Summary.Cell>
                        <Table.Summary.Cell index={5} align="right"><Text style={{ fontWeight: 800, color: '#ec4899' }}>{(summary.totalFollowersGained ?? 0).toLocaleString('en-IN')}</Text></Table.Summary.Cell>
                      </Table.Summary.Row>
                    </Table.Summary>
                  );
                }}
              />
            </div>
          </div>
        )}

        {/* 4. META INSIGHTS (FACEBOOK & INSTAGRAM) */}
        {(reportType === 'Meta Insights' || reportType.includes('Meta Insights')) && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <div>
                  <Title level={5} style={{ margin: 0, fontWeight: 700 }}>Meta Insights – Facebook</Title>
                  <Text type="secondary" style={{ fontSize: 12 }}>Show monthly Facebook performance (views, reach, and followers).</Text>
                </div>
                <Button type="dashed" size="small" icon={<Plus size={14} />} onClick={() => setMetaInsightsFacebookList([...metaInsightsFacebookList, { month: selectedDate.format('MMM YYYY'), views: 0, reach: 0, followers: 0 }])}>
                  Add Month Row
                </Button>
              </div>

              <Alert
                message="Report Requirement Fields"
                description="Month: Reporting month | Views: Facebook views | Reach: People reached | Followers: Followers gained"
                type="info"
                showIcon
                style={{ marginBottom: 16, borderRadius: 10 }}
              />

              <Row gutter={[12, 12]} style={{ marginBottom: 16 }}>
                <Col span={8}>
                  <Card bodyStyle={{ padding: '14px' }} style={{ borderRadius: 10, background: 'var(--bg-secondary)', border: '1px solid var(--border-color)' }}>
                    <Text type="secondary" style={{ fontSize: 11, fontWeight: 600 }}>TOTAL VIEWS</Text>
                    <Title level={4} style={{ margin: '4px 0 0 0', color: '#10b981', fontWeight: 800 }}>{metaInsightsFacebookList.reduce((acc, i) => acc + (i.views || 0), 0).toLocaleString()}</Title>
                  </Card>
                </Col>
                <Col span={8}>
                  <Card bodyStyle={{ padding: '14px' }} style={{ borderRadius: 10, background: 'var(--bg-secondary)', border: '1px solid var(--border-color)' }}>
                    <Text type="secondary" style={{ fontSize: 11, fontWeight: 600 }}>TOTAL REACH</Text>
                    <Title level={4} style={{ margin: '4px 0 0 0', color: '#3b82f6', fontWeight: 800 }}>{metaInsightsFacebookList.reduce((acc, i) => acc + (i.reach || 0), 0).toLocaleString()}</Title>
                  </Card>
                </Col>
                <Col span={8}>
                  <Card bodyStyle={{ padding: '14px' }} style={{ borderRadius: 10, background: 'var(--bg-secondary)', border: '1px solid var(--border-color)' }}>
                    <Text type="secondary" style={{ fontSize: 11, fontWeight: 600 }}>FOLLOWERS GAINED</Text>
                    <Title level={4} style={{ margin: '4px 0 0 0', color: '#ec4899', fontWeight: 800 }}>{metaInsightsFacebookList.reduce((acc, i) => acc + (i.followers || 0), 0).toLocaleString()}</Title>
                  </Card>
                </Col>
              </Row>

              <Card size="small" style={{ borderRadius: 12 }}>
                {metaInsightsFacebookList.map((item, idx) => (
                  <Row key={idx} gutter={[12, 8]} align="middle" style={{ background: 'var(--bg-secondary)', padding: '10px 14px', borderRadius: 8, marginBottom: 8 }}>
                    <Col span={6}><Text style={{ fontSize: 11, fontWeight: 600 }}>Month</Text><Input value={item.month} onChange={e => { const updated = [...metaInsightsFacebookList]; updated[idx].month = e.target.value; setMetaInsightsFacebookList(updated); }} /></Col>
                    <Col span={5}><Text style={{ fontSize: 11 }}>Views</Text><InputNumber style={{ width: '100%' }} value={item.views} onChange={val => { const updated = [...metaInsightsFacebookList]; updated[idx].views = val || 0; setMetaInsightsFacebookList(updated); }} /></Col>
                    <Col span={5}><Text style={{ fontSize: 11 }}>Reach</Text><InputNumber style={{ width: '100%' }} value={item.reach} onChange={val => { const updated = [...metaInsightsFacebookList]; updated[idx].reach = val || 0; setMetaInsightsFacebookList(updated); }} /></Col>
                    <Col span={5}><Text style={{ fontSize: 11 }}>Followers</Text><InputNumber style={{ width: '100%' }} value={item.followers} onChange={val => { const updated = [...metaInsightsFacebookList]; updated[idx].followers = val || 0; setMetaInsightsFacebookList(updated); }} /></Col>
                    <Col span={3} style={{ textAlign: 'right' }}><Button type="text" danger icon={<Trash2 size={16} />} onClick={() => setMetaInsightsFacebookList(metaInsightsFacebookList.filter((_, i) => i !== idx))} /></Col>
                  </Row>
                ))}
              </Card>
            </div>

            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <div>
                  <Title level={5} style={{ margin: 0, fontWeight: 700 }}>Meta Insights – Instagram</Title>
                  <Text type="secondary" style={{ fontSize: 12 }}>Show monthly Instagram performance (views, reach, and followers).</Text>
                </div>
                <Button type="dashed" size="small" icon={<Plus size={14} />} onClick={() => setMetaInsightsInstagramList([...metaInsightsInstagramList, { month: selectedDate.format('MMM YYYY'), views: 0, reach: 0, followers: 0 }])}>
                  Add Month Row
                </Button>
              </div>

              <Alert
                message="Report Requirement Fields"
                description="Month: Reporting month | Views: Instagram views | Reach: People reached | Followers: Followers gained"
                type="info"
                showIcon
                style={{ marginBottom: 16, borderRadius: 10 }}
              />

              <Row gutter={[12, 12]} style={{ marginBottom: 16 }}>
                <Col span={8}>
                  <Card bodyStyle={{ padding: '14px' }} style={{ borderRadius: 10, background: 'var(--bg-secondary)', border: '1px solid var(--border-color)' }}>
                    <Text type="secondary" style={{ fontSize: 11, fontWeight: 600 }}>TOTAL VIEWS</Text>
                    <Title level={4} style={{ margin: '4px 0 0 0', color: '#10b981', fontWeight: 800 }}>{metaInsightsInstagramList.reduce((acc, i) => acc + (i.views || 0), 0).toLocaleString()}</Title>
                  </Card>
                </Col>
                <Col span={8}>
                  <Card bodyStyle={{ padding: '14px' }} style={{ borderRadius: 10, background: 'var(--bg-secondary)', border: '1px solid var(--border-color)' }}>
                    <Text type="secondary" style={{ fontSize: 11, fontWeight: 600 }}>TOTAL REACH</Text>
                    <Title level={4} style={{ margin: '4px 0 0 0', color: '#3b82f6', fontWeight: 800 }}>{metaInsightsInstagramList.reduce((acc, i) => acc + (i.reach || 0), 0).toLocaleString()}</Title>
                  </Card>
                </Col>
                <Col span={8}>
                  <Card bodyStyle={{ padding: '14px' }} style={{ borderRadius: 10, background: 'var(--bg-secondary)', border: '1px solid var(--border-color)' }}>
                    <Text type="secondary" style={{ fontSize: 11, fontWeight: 600 }}>FOLLOWERS GAINED</Text>
                    <Title level={4} style={{ margin: '4px 0 0 0', color: '#ec4899', fontWeight: 800 }}>{metaInsightsInstagramList.reduce((acc, i) => acc + (i.followers || 0), 0).toLocaleString()}</Title>
                  </Card>
                </Col>
              </Row>

              <Card size="small" style={{ borderRadius: 12 }}>
                {metaInsightsInstagramList.map((item, idx) => (
                  <Row key={idx} gutter={[12, 8]} align="middle" style={{ background: 'var(--bg-secondary)', padding: '10px 14px', borderRadius: 8, marginBottom: 8 }}>
                    <Col span={6}><Text style={{ fontSize: 11, fontWeight: 600 }}>Month</Text><Input value={item.month} onChange={e => { const updated = [...metaInsightsInstagramList]; updated[idx].month = e.target.value; setMetaInsightsInstagramList(updated); }} /></Col>
                    <Col span={5}><Text style={{ fontSize: 11 }}>Views</Text><InputNumber style={{ width: '100%' }} value={item.views} onChange={val => { const updated = [...metaInsightsInstagramList]; updated[idx].views = val || 0; setMetaInsightsInstagramList(updated); }} /></Col>
                    <Col span={5}><Text style={{ fontSize: 11 }}>Reach</Text><InputNumber style={{ width: '100%' }} value={item.reach} onChange={val => { const updated = [...metaInsightsInstagramList]; updated[idx].reach = val || 0; setMetaInsightsInstagramList(updated); }} /></Col>
                    <Col span={5}><Text style={{ fontSize: 11 }}>Followers</Text><InputNumber style={{ width: '100%' }} value={item.followers} onChange={val => { const updated = [...metaInsightsInstagramList]; updated[idx].followers = val || 0; setMetaInsightsInstagramList(updated); }} /></Col>
                    <Col span={3} style={{ textAlign: 'right' }}><Button type="text" danger icon={<Trash2 size={16} />} onClick={() => setMetaInsightsInstagramList(metaInsightsInstagramList.filter((_, i) => i !== idx))} /></Col>
                  </Row>
                ))}
              </Card>
            </div>
          </div>
        )}

        {/* 5. WEBSITE TRAFFIC (OVERVIEW, LANDING PAGES & CITY) */}
        {(reportType === 'Website Traffic' || reportType.includes('Website Traffic')) && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <div>
                  <Title level={5} style={{ margin: 0, fontWeight: 700 }}>Website Traffic – Overview</Title>
                  <Text type="secondary" style={{ fontSize: 12 }}>Show monthly website traffic trend from connected Google Analytics 4 (GA4) data.</Text>
                </div>
                <Button type="dashed" size="small" icon={<Plus size={14} />} onClick={() => {
                  const newList = [...websiteTrafficList, { month: selectedDate.format('MMM YYYY'), users: 0, newUsers: 0 }];
                  setWebsiteTrafficList(newList);
                  setOverviewPage(Math.ceil(newList.length / overviewPageSize));
                }}>
                  Add Month Row
                </Button>
              </div>
              <Alert
                message="Report Requirement Fields"
                description="Month: Month | Users: Total users | New Users: New users (populated directly from Google Analytics GA4)"
                type="info"
                showIcon
                style={{ marginBottom: 16, borderRadius: 10 }}
              />

              <Row gutter={[12, 12]} style={{ marginBottom: 16 }}>
                <Col span={12}>
                  <Card bodyStyle={{ padding: '14px' }} style={{ borderRadius: 10, background: 'var(--bg-secondary)', border: '1px solid var(--border-color)' }}>
                    <Text type="secondary" style={{ fontSize: 11, fontWeight: 600 }}>TOTAL USERS</Text>
                    <Title level={4} style={{ margin: '4px 0 0 0', color: '#3b82f6', fontWeight: 800 }}>{websiteTrafficList.reduce((acc, u) => acc + (u.users || 0), 0).toLocaleString()}</Title>
                  </Card>
                </Col>
                <Col span={12}>
                  <Card bodyStyle={{ padding: '14px' }} style={{ borderRadius: 10, background: 'var(--bg-secondary)', border: '1px solid var(--border-color)' }}>
                    <Text type="secondary" style={{ fontSize: 11, fontWeight: 600 }}>NEW USERS</Text>
                    <Title level={4} style={{ margin: '4px 0 0 0', color: '#10b981', fontWeight: 800 }}>{websiteTrafficList.reduce((acc, u) => acc + (u.newUsers || 0), 0).toLocaleString()}</Title>
                  </Card>
                </Col>
              </Row>

              <Card size="small" style={{ borderRadius: 12 }}>
                <div style={{ maxHeight: '360px', overflowY: 'auto', paddingRight: '4px' }}>
                  {websiteTrafficList.slice((overviewPage - 1) * overviewPageSize, overviewPage * overviewPageSize).map((item, pIdx) => {
                    const idx = (overviewPage - 1) * overviewPageSize + pIdx;
                    return (
                      <Row key={idx} gutter={[12, 8]} align="middle" style={{ background: 'var(--bg-secondary)', padding: '10px 14px', borderRadius: 8, marginBottom: 8 }}>
                        <Col span={8}><Text style={{ fontSize: 11, fontWeight: 600 }}>Month</Text><Input value={item.month} onChange={e => { const updated = [...websiteTrafficList]; updated[idx].month = e.target.value; setWebsiteTrafficList(updated); }} /></Col>
                        <Col span={7}><Text style={{ fontSize: 11 }}>Users (Total users)</Text><InputNumber style={{ width: '100%' }} value={item.users} onChange={val => { const updated = [...websiteTrafficList]; updated[idx].users = val || 0; setWebsiteTrafficList(updated); }} /></Col>
                        <Col span={6}><Text style={{ fontSize: 11 }}>New Users (New users)</Text><InputNumber style={{ width: '100%' }} value={item.newUsers} onChange={val => { const updated = [...websiteTrafficList]; updated[idx].newUsers = val || 0; setWebsiteTrafficList(updated); }} /></Col>
                        <Col span={3} style={{ textAlign: 'right' }}><Button type="text" danger icon={<Trash2 size={16} />} onClick={() => {
                          const updated = websiteTrafficList.filter((_, i) => i !== idx);
                          setWebsiteTrafficList(updated);
                          if ((overviewPage - 1) * overviewPageSize >= updated.length && overviewPage > 1) {
                            setOverviewPage(overviewPage - 1);
                          }
                        }} /></Col>
                      </Row>
                    );
                  })}
                </div>
                {websiteTrafficList.length > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 12, paddingTop: 10, borderTop: '1px solid var(--border-color)' }}>
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      Showing {(overviewPage - 1) * overviewPageSize + 1}–{Math.min(overviewPage * overviewPageSize, websiteTrafficList.length)} of {websiteTrafficList.length} rows
                    </Text>
                    <Pagination
                      size="small"
                      current={overviewPage}
                      pageSize={overviewPageSize}
                      total={websiteTrafficList.length}
                      onChange={(page, size) => {
                        setOverviewPage(page);
                        setOverviewPageSize(size);
                      }}
                      showSizeChanger
                      pageSizeOptions={['5', '10', '20', '50']}
                    />
                  </div>
                )}
              </Card>
            </div>

            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <div>
                  <Title level={5} style={{ margin: 0, fontWeight: 700 }}>Website Traffic – Landing Page Views</Title>
                  <Text type="secondary" style={{ fontSize: 12 }}>Show which website pages receive the most traffic and engagement from Google Analytics 4 (GA4).</Text>
                </div>
                <Button type="dashed" size="small" icon={<Plus size={14} />} onClick={() => {
                  const newList = [...websiteTrafficLandingPagesList, { pagePath: '/', views: 0, activeUsers: 0, viewsPerActiveUser: 0, avgEngagementTime: '0s', eventCount: 0 }];
                  setWebsiteTrafficLandingPagesList(newList);
                  setLandingPagesPage(Math.ceil(newList.length / landingPagesPageSize));
                }}>
                  Add Page Row
                </Button>
              </div>
              <Alert
                message="Report Requirement Fields"
                description="Page path / screen class: Landing/page path | Views: Page views | Active users: Active users | Views per active user: Views per active user | Average engagement time per active user: Average engagement time | Event count: All events"
                type="info"
                showIcon
                style={{ marginBottom: 16, borderRadius: 10 }}
              />

              <Row gutter={[12, 12]} style={{ marginBottom: 16 }}>
                <Col span={8}>
                  <Card bodyStyle={{ padding: '14px' }} style={{ borderRadius: 10, background: 'var(--bg-secondary)', border: '1px solid var(--border-color)' }}>
                    <Text type="secondary" style={{ fontSize: 11, fontWeight: 600 }}>PAGE VIEWS</Text>
                    <Title level={4} style={{ margin: '4px 0 0 0', color: '#10b981', fontWeight: 800 }}>{websiteTrafficLandingPagesList.reduce((acc, p) => acc + (p.views || 0), 0).toLocaleString()}</Title>
                  </Card>
                </Col>
                <Col span={8}>
                  <Card bodyStyle={{ padding: '14px' }} style={{ borderRadius: 10, background: 'var(--bg-secondary)', border: '1px solid var(--border-color)' }}>
                    <Text type="secondary" style={{ fontSize: 11, fontWeight: 600 }}>ACTIVE USERS</Text>
                    <Title level={4} style={{ margin: '4px 0 0 0', color: '#3b82f6', fontWeight: 800 }}>{websiteTrafficLandingPagesList.reduce((acc, p) => acc + (p.activeUsers || 0), 0).toLocaleString()}</Title>
                  </Card>
                </Col>
                <Col span={8}>
                  <Card bodyStyle={{ padding: '14px' }} style={{ borderRadius: 10, background: 'var(--bg-secondary)', border: '1px solid var(--border-color)' }}>
                    <Text type="secondary" style={{ fontSize: 11, fontWeight: 600 }}>TOTAL EVENTS</Text>
                    <Title level={4} style={{ margin: '4px 0 0 0', color: '#8b5cf6', fontWeight: 800 }}>{websiteTrafficLandingPagesList.reduce((acc, p) => acc + (p.eventCount || 0), 0).toLocaleString()}</Title>
                  </Card>
                </Col>
              </Row>

              <Card size="small" style={{ borderRadius: 12 }}>
                <div style={{ maxHeight: '360px', overflowY: 'auto', paddingRight: '4px' }}>
                  {websiteTrafficLandingPagesList.slice((landingPagesPage - 1) * landingPagesPageSize, landingPagesPage * landingPagesPageSize).map((item, pIdx) => {
                    const idx = (landingPagesPage - 1) * landingPagesPageSize + pIdx;
                    return (
                      <Row key={idx} gutter={[8, 8]} align="middle" style={{ background: 'var(--bg-secondary)', padding: '10px 14px', borderRadius: 8, marginBottom: 8 }}>
                        <Col span={7}><Text style={{ fontSize: 11, fontWeight: 600 }}>Page path</Text><Input value={item.pagePath} onChange={e => { const updated = [...websiteTrafficLandingPagesList]; updated[idx].pagePath = e.target.value; setWebsiteTrafficLandingPagesList(updated); }} /></Col>
                        <Col span={3}><Text style={{ fontSize: 11 }}>Views</Text><InputNumber style={{ width: '100%' }} value={item.views} onChange={val => { const updated = [...websiteTrafficLandingPagesList]; updated[idx].views = val || 0; setWebsiteTrafficLandingPagesList(updated); }} /></Col>
                        <Col span={3}><Text style={{ fontSize: 11 }}>Active users</Text><InputNumber style={{ width: '100%' }} value={item.activeUsers} onChange={val => { const updated = [...websiteTrafficLandingPagesList]; updated[idx].activeUsers = val || 0; setWebsiteTrafficLandingPagesList(updated); }} /></Col>
                        <Col span={3}><Text style={{ fontSize: 11 }}>Views / User</Text><InputNumber style={{ width: '100%' }} step={0.01} value={item.viewsPerActiveUser} onChange={val => { const updated = [...websiteTrafficLandingPagesList]; updated[idx].viewsPerActiveUser = val || 0; setWebsiteTrafficLandingPagesList(updated); }} /></Col>
                        <Col span={4}><Text style={{ fontSize: 11 }}>Avg Engagement</Text><Input value={item.avgEngagementTime} onChange={e => { const updated = [...websiteTrafficLandingPagesList]; updated[idx].avgEngagementTime = e.target.value; setWebsiteTrafficLandingPagesList(updated); }} /></Col>
                        <Col span={3}><Text style={{ fontSize: 11 }}>Events</Text><InputNumber style={{ width: '100%' }} value={item.eventCount} onChange={val => { const updated = [...websiteTrafficLandingPagesList]; updated[idx].eventCount = val || 0; setWebsiteTrafficLandingPagesList(updated); }} /></Col>
                        <Col span={1} style={{ textAlign: 'right' }}><Button type="text" danger icon={<Trash2 size={16} />} onClick={() => {
                          const updated = websiteTrafficLandingPagesList.filter((_, i) => i !== idx);
                          setWebsiteTrafficLandingPagesList(updated);
                          if ((landingPagesPage - 1) * landingPagesPageSize >= updated.length && landingPagesPage > 1) {
                            setLandingPagesPage(landingPagesPage - 1);
                          }
                        }} /></Col>
                      </Row>
                    );
                  })}
                </div>
                {websiteTrafficLandingPagesList.length > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 12, paddingTop: 10, borderTop: '1px solid var(--border-color)' }}>
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      Showing {(landingPagesPage - 1) * landingPagesPageSize + 1}–{Math.min(landingPagesPage * landingPagesPageSize, websiteTrafficLandingPagesList.length)} of {websiteTrafficLandingPagesList.length} pages
                    </Text>
                    <Pagination
                      size="small"
                      current={landingPagesPage}
                      pageSize={landingPagesPageSize}
                      total={websiteTrafficLandingPagesList.length}
                      onChange={(page, size) => {
                        setLandingPagesPage(page);
                        setLandingPagesPageSize(size);
                      }}
                      showSizeChanger
                      pageSizeOptions={['5', '10', '20', '50']}
                    />
                  </div>
                )}
              </Card>
            </div>

            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <div>
                  <Title level={5} style={{ margin: 0, fontWeight: 700 }}>Website Traffic – Users by City</Title>
                  <Text type="secondary" style={{ fontSize: 12 }}>Show website audience and engagement by city from Google Analytics 4 (GA4).</Text>
                </div>
                <Button type="dashed" size="small" icon={<Plus size={14} />} onClick={() => {
                  const newList = [...websiteTrafficUsersByCityList, { city: 'Bengaluru', activeUsers: 0, newUsers: 0, engagedSessions: 0, engagementRate: '0.0%', engagedSessionsPerActiveUser: 0, avgEngagementTime: '0s', eventCount: 0, keyEvents: 0, userKeyEventRate: '0.0%' }];
                  setWebsiteTrafficUsersByCityList(newList);
                  setCityPage(Math.ceil(newList.length / cityPageSize));
                }}>
                  Add City Row
                </Button>
              </div>
              <Alert
                message="Report Requirement Fields"
                description="City: City | Active users: Active users | New users: New users | Engaged sessions: Engaged sessions | Engagement rate: Engagement rate | Engaged sessions per active user: Sessions / User | Average engagement time: Avg engagement | Event count: All events | Key events: Key events | User key event rate: Key event rate"
                type="info"
                showIcon
                style={{ marginBottom: 16, borderRadius: 10 }}
              />

              <Row gutter={[12, 12]} style={{ marginBottom: 16 }}>
                <Col span={8}>
                  <Card bodyStyle={{ padding: '14px' }} style={{ borderRadius: 10, background: 'var(--bg-secondary)', border: '1px solid var(--border-color)' }}>
                    <Text type="secondary" style={{ fontSize: 11, fontWeight: 600 }}>CITIES COVERED</Text>
                    <Title level={4} style={{ margin: '4px 0 0 0', color: '#6366f1', fontWeight: 800 }}>{websiteTrafficUsersByCityList.length}</Title>
                  </Card>
                </Col>
                <Col span={8}>
                  <Card bodyStyle={{ padding: '14px' }} style={{ borderRadius: 10, background: 'var(--bg-secondary)', border: '1px solid var(--border-color)' }}>
                    <Text type="secondary" style={{ fontSize: 11, fontWeight: 600 }}>ACTIVE USERS</Text>
                    <Title level={4} style={{ margin: '4px 0 0 0', color: '#3b82f6', fontWeight: 800 }}>{websiteTrafficUsersByCityList.reduce((acc, c) => acc + (c.activeUsers || 0), 0).toLocaleString()}</Title>
                  </Card>
                </Col>
                <Col span={8}>
                  <Card bodyStyle={{ padding: '14px' }} style={{ borderRadius: 10, background: 'var(--bg-secondary)', border: '1px solid var(--border-color)' }}>
                    <Text type="secondary" style={{ fontSize: 11, fontWeight: 600 }}>ENGAGED SESSIONS</Text>
                    <Title level={4} style={{ margin: '4px 0 0 0', color: '#10b981', fontWeight: 800 }}>{websiteTrafficUsersByCityList.reduce((acc, c) => acc + (c.engagedSessions || 0), 0).toLocaleString()}</Title>
                  </Card>
                </Col>
              </Row>

              <Card size="small" style={{ borderRadius: 12 }}>
                <div style={{ maxHeight: '360px', overflowY: 'auto', paddingRight: '4px' }}>
                  {websiteTrafficUsersByCityList.slice((cityPage - 1) * cityPageSize, cityPage * cityPageSize).map((item, pIdx) => {
                    const idx = (cityPage - 1) * cityPageSize + pIdx;
                    return (
                      <Row key={idx} gutter={[6, 6]} align="middle" style={{ background: 'var(--bg-secondary)', padding: '10px 10px', borderRadius: 8, marginBottom: 8 }}>
                        <Col span={4}><Text style={{ fontSize: 11, fontWeight: 600 }}>City</Text><Input value={item.city} onChange={e => { const updated = [...websiteTrafficUsersByCityList]; updated[idx].city = e.target.value; setWebsiteTrafficUsersByCityList(updated); }} /></Col>
                        <Col span={2}><Text style={{ fontSize: 11 }}>Active Users</Text><InputNumber style={{ width: '100%' }} value={item.activeUsers} onChange={val => { const updated = [...websiteTrafficUsersByCityList]; updated[idx].activeUsers = val || 0; setWebsiteTrafficUsersByCityList(updated); }} /></Col>
                        <Col span={2}><Text style={{ fontSize: 11 }}>New Users</Text><InputNumber style={{ width: '100%' }} value={item.newUsers} onChange={val => { const updated = [...websiteTrafficUsersByCityList]; updated[idx].newUsers = val || 0; setWebsiteTrafficUsersByCityList(updated); }} /></Col>
                        <Col span={2}><Text style={{ fontSize: 11 }}>Engaged</Text><InputNumber style={{ width: '100%' }} value={item.engagedSessions} onChange={val => { const updated = [...websiteTrafficUsersByCityList]; updated[idx].engagedSessions = val || 0; setWebsiteTrafficUsersByCityList(updated); }} /></Col>
                        <Col span={2}><Text style={{ fontSize: 11 }}>Eng Rate</Text><Input value={item.engagementRate} onChange={e => { const updated = [...websiteTrafficUsersByCityList]; updated[idx].engagementRate = e.target.value; setWebsiteTrafficUsersByCityList(updated); }} /></Col>
                        <Col span={2}><Text style={{ fontSize: 11 }}>Sess/User</Text><InputNumber style={{ width: '100%' }} step={0.01} value={item.engagedSessionsPerActiveUser} onChange={val => { const updated = [...websiteTrafficUsersByCityList]; updated[idx].engagedSessionsPerActiveUser = val || 0; setWebsiteTrafficUsersByCityList(updated); }} /></Col>
                        <Col span={3}><Text style={{ fontSize: 11 }}>Avg Time</Text><Input value={item.avgEngagementTime} onChange={e => { const updated = [...websiteTrafficUsersByCityList]; updated[idx].avgEngagementTime = e.target.value; setWebsiteTrafficUsersByCityList(updated); }} /></Col>
                        <Col span={2}><Text style={{ fontSize: 11 }}>Events</Text><InputNumber style={{ width: '100%' }} value={item.eventCount} onChange={val => { const updated = [...websiteTrafficUsersByCityList]; updated[idx].eventCount = val || 0; setWebsiteTrafficUsersByCityList(updated); }} /></Col>
                        <Col span={2}><Text style={{ fontSize: 11 }}>Key Events</Text><InputNumber style={{ width: '100%' }} value={item.keyEvents} onChange={val => { const updated = [...websiteTrafficUsersByCityList]; updated[idx].keyEvents = val || 0; setWebsiteTrafficUsersByCityList(updated); }} /></Col>
                        <Col span={1} style={{ textAlign: 'right' }}><Button type="text" danger icon={<Trash2 size={16} />} onClick={() => {
                          const updated = websiteTrafficUsersByCityList.filter((_, i) => i !== idx);
                          setWebsiteTrafficUsersByCityList(updated);
                          if ((cityPage - 1) * cityPageSize >= updated.length && cityPage > 1) {
                            setCityPage(cityPage - 1);
                          }
                        }} /></Col>
                      </Row>
                    );
                  })}
                </div>
                {websiteTrafficUsersByCityList.length > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 12, paddingTop: 10, borderTop: '1px solid var(--border-color)' }}>
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      Showing {(cityPage - 1) * cityPageSize + 1}–{Math.min(cityPage * cityPageSize, websiteTrafficUsersByCityList.length)} of {websiteTrafficUsersByCityList.length} cities
                    </Text>
                    <Pagination
                      size="small"
                      current={cityPage}
                      pageSize={cityPageSize}
                      total={websiteTrafficUsersByCityList.length}
                      onChange={(page, size) => {
                        setCityPage(page);
                        setCityPageSize(size);
                      }}
                      showSizeChanger
                      pageSizeOptions={['5', '10', '20', '50']}
                    />
                  </div>
                )}
              </Card>
            </div>
          </div>
        )}

        {/* 6. SOCIAL MEDIA POST INSIGHTS (POST INSIGHTS & YOUTUBE REPORT) */}
        {(reportType === 'Social Media Post Insights' || reportType.includes('Social Media')) && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            <div>
              <div style={{ marginBottom: 16 }}>
                <Title level={5} style={{ margin: 0, fontWeight: 700 }}>3.12 Social Media Post Insights</Title>
                <Text type="secondary" style={{ fontSize: 12 }}>Purpose: Track the number of social media contents published during the month.</Text>
              </div>

              <Alert
                message="Report Requirement Fields"
                description="Type of Post: Video / Post | Number of Post: Number published | Total: Total content published"
                type="info"
                showIcon
                style={{ marginBottom: 16, borderRadius: 10 }}
              />

              <Row gutter={[12, 12]} style={{ marginBottom: 16 }}>
                <Col span={8}>
                  <Card bodyStyle={{ padding: '14px' }} style={{ borderRadius: 10, background: 'var(--bg-secondary)', border: '1px solid var(--border-color)' }}>
                    <Text type="secondary" style={{ fontSize: 11, fontWeight: 600 }}>VIDEO POSTS PUBLISHED</Text>
                    <Title level={4} style={{ margin: '4px 0 0 0', color: '#3b82f6', fontWeight: 800 }}>{socialMediaPostInsights.videoCount || 0}</Title>
                  </Card>
                </Col>
                <Col span={8}>
                  <Card bodyStyle={{ padding: '14px' }} style={{ borderRadius: 10, background: 'var(--bg-secondary)', border: '1px solid var(--border-color)' }}>
                    <Text type="secondary" style={{ fontSize: 11, fontWeight: 600 }}>STANDARD POSTS PUBLISHED</Text>
                    <Title level={4} style={{ margin: '4px 0 0 0', color: '#8b5cf6', fontWeight: 800 }}>{socialMediaPostInsights.postCount || 0}</Title>
                  </Card>
                </Col>
                <Col span={8}>
                  <Card bodyStyle={{ padding: '14px' }} style={{ borderRadius: 10, background: 'var(--bg-secondary)', border: '1px solid var(--border-color)' }}>
                    <Text type="secondary" style={{ fontSize: 11, fontWeight: 600 }}>TOTAL CONTENT PUBLISHED</Text>
                    <Title level={4} style={{ margin: '4px 0 0 0', color: '#10b981', fontWeight: 800 }}>{(socialMediaPostInsights.videoCount || 0) + (socialMediaPostInsights.postCount || 0)}</Title>
                  </Card>
                </Col>
              </Row>

              <Card size="small" style={{ borderRadius: 12, marginBottom: 16 }}>
                <Row gutter={[16, 12]} align="middle" style={{ padding: '8px 6px' }}>
                  <Col span={8}>
                    <Text style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>Video Posts Published</Text>
                    <InputNumber
                      style={{ width: '100%' }}
                      min={0}
                      value={socialMediaPostInsights.videoCount}
                      onChange={val => {
                        const v = val || 0;
                        setSocialMediaPostInsights(prev => ({
                          ...prev,
                          videoCount: v,
                          totalCount: v + (prev.postCount || 0)
                        }));
                      }}
                    />
                  </Col>
                  <Col span={8}>
                    <Text style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>Standard Posts Published</Text>
                    <InputNumber
                      style={{ width: '100%' }}
                      min={0}
                      value={socialMediaPostInsights.postCount}
                      onChange={val => {
                        const p = val || 0;
                        setSocialMediaPostInsights(prev => ({
                          ...prev,
                          postCount: p,
                          totalCount: (prev.videoCount || 0) + p
                        }));
                      }}
                    />
                  </Col>
                  <Col span={8}>
                    <Text style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>Total Content Published</Text>
                    <InputNumber
                      style={{ width: '100%' }}
                      disabled
                      value={(socialMediaPostInsights.videoCount || 0) + (socialMediaPostInsights.postCount || 0)}
                    />
                  </Col>
                </Row>
              </Card>

              <Table
                columns={[
                  { title: 'Type of Post', dataIndex: 'typeOfPost', key: 'typeOfPost', render: text => <strong style={{ color: 'var(--text-primary)' }}>{text}</strong> },
                  { title: 'Number Published', dataIndex: 'numberPublished', key: 'numberPublished', align: 'center', render: (val, record) => <Tag color={record.key === 'total' ? 'purple' : 'blue'} style={{ fontSize: 13, padding: '3px 12px', fontWeight: 700 }}>{val || 0}</Tag> }
                ]}
                dataSource={[
                  { key: 'video', typeOfPost: 'Video', numberPublished: socialMediaPostInsights.videoCount || 0 },
                  { key: 'post', typeOfPost: 'Post', numberPublished: socialMediaPostInsights.postCount || 0 },
                  { key: 'total', typeOfPost: 'Total Content Published', numberPublished: (socialMediaPostInsights.videoCount || 0) + (socialMediaPostInsights.postCount || 0) }
                ]}
                rowKey="key"
                pagination={false}
                size="middle"
                bordered
              />
            </div>

            {/* YouTube Report Section inside Social Media Post Insights */}
            <div>
              <div style={{ marginBottom: 16 }}>
                <Title level={5} style={{ margin: 0, fontWeight: 700 }}>3.14 YouTube Report</Title>
                <Text type="secondary" style={{ fontSize: 12 }}>Purpose: Simple monthly YouTube performance reporting.</Text>
              </div>

              <Alert
                message="Report Requirement Fields"
                description="Month: Reporting month | Views: Views during the month | Last Month Subscribers: Subscriber count from previous month | Total Subscribers: Current total subscribers"
                type="info"
                showIcon
                style={{ marginBottom: 16, borderRadius: 10 }}
              />

              <Row gutter={[12, 12]} style={{ marginBottom: 16 }}>
                <Col span={8}>
                  <Card bodyStyle={{ padding: '14px' }} style={{ borderRadius: 10, background: 'var(--bg-secondary)', border: '1px solid var(--border-color)' }}>
                    <Text type="secondary" style={{ fontSize: 11, fontWeight: 600 }}>MONTHLY VIEWS</Text>
                    <Title level={4} style={{ margin: '4px 0 0 0', color: '#10b981', fontWeight: 800 }}>{(youTubeReportList[0]?.views || 0).toLocaleString()}</Title>
                  </Card>
                </Col>
                <Col span={8}>
                  <Card bodyStyle={{ padding: '14px' }} style={{ borderRadius: 10, background: 'var(--bg-secondary)', border: '1px solid var(--border-color)' }}>
                    <Text type="secondary" style={{ fontSize: 11, fontWeight: 600 }}>LAST MONTH SUBS</Text>
                    <Title level={4} style={{ margin: '4px 0 0 0', color: '#3b82f6', fontWeight: 800 }}>{(youTubeReportList[0]?.lastMonthSubscribers || 0).toLocaleString()}</Title>
                  </Card>
                </Col>
                <Col span={8}>
                  <Card bodyStyle={{ padding: '14px' }} style={{ borderRadius: 10, background: 'var(--bg-secondary)', border: '1px solid var(--border-color)' }}>
                    <Text type="secondary" style={{ fontSize: 11, fontWeight: 600 }}>TOTAL SUBSCRIBERS</Text>
                    <Title level={4} style={{ margin: '4px 0 0 0', color: '#ec4899', fontWeight: 800 }}>{(youTubeReportList[0]?.totalSubscribers || 0).toLocaleString()}</Title>
                  </Card>
                </Col>
              </Row>

              <Card size="small" style={{ borderRadius: 12, marginBottom: 16 }}>
                {youTubeReportList.map((item, idx) => (
                  <Row key={idx} gutter={[16, 12]} align="middle" style={{ padding: '8px 6px' }}>
                    <Col span={6}>
                      <Text style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>Reporting Month</Text>
                      <Input
                        value={item.month}
                        onChange={e => handleYouTubeReportChange(idx, 'month', e.target.value)}
                        placeholder="e.g. Sep 2026"
                      />
                    </Col>
                    <Col span={6}>
                      <Text style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>Views during Month</Text>
                      <InputNumber
                        style={{ width: '100%' }}
                        min={0}
                        value={item.views}
                        onChange={val => handleYouTubeReportChange(idx, 'views', val || 0)}
                      />
                    </Col>
                    <Col span={6}>
                      <Text style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>Last Month Subscribers</Text>
                      <InputNumber
                        style={{ width: '100%' }}
                        min={0}
                        value={item.lastMonthSubscribers}
                        onChange={val => handleYouTubeReportChange(idx, 'lastMonthSubscribers', val || 0)}
                      />
                    </Col>
                    <Col span={6}>
                      <Text style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>Total Subscribers</Text>
                      <InputNumber
                        style={{ width: '100%' }}
                        min={0}
                        value={item.totalSubscribers}
                        onChange={val => handleYouTubeReportChange(idx, 'totalSubscribers', val || 0)}
                      />
                    </Col>
                  </Row>
                ))}
              </Card>

              <Table
                columns={[
                  { title: 'Field', dataIndex: 'field', key: 'field', render: text => <strong style={{ color: 'var(--text-primary)' }}>{text}</strong> },
                  { title: 'Requirement', dataIndex: 'requirement', key: 'requirement', align: 'center', render: val => <Tag color="blue" style={{ fontSize: 13, padding: '3px 12px', fontWeight: 700 }}>{val}</Tag> }
                ]}
                dataSource={[
                  { key: 'month', field: 'Month', requirement: youTubeReportList[0]?.month || 'Sep 2026' },
                  { key: 'views', field: 'Views', requirement: (youTubeReportList[0]?.views || 0).toLocaleString() },
                  { key: 'lastMonthSubscribers', field: 'Last Month Subscribers', requirement: (youTubeReportList[0]?.lastMonthSubscribers || 0).toLocaleString() },
                  { key: 'totalSubscribers', field: 'Total Subscribers', requirement: (youTubeReportList[0]?.totalSubscribers || 0).toLocaleString() }
                ]}
                rowKey="key"
                pagination={false}
                size="middle"
                bordered
              />
            </div>
          </div>
        )}
      </Spin>
    </Modal>
  );
};

export default CreateReportModal;
