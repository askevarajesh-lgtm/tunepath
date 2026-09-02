const ga4 = require('../sources/googleAnalytics.source');
const gsc = require('../sources/searchConsole.source');
const crm = require('../sources/crm.source');
const PerformanceAd = require('../../performanceAds/performanceAds.model');
const { resolveScope } = require('./projectScope.service');
const { resolveDateRange } = require('../utils/dateRange');
const { trendPercent, toPercent, round, formatCurrencyLakhs } = require('../utils/calculations');
const { normalizeChannel } = require('../utils/channelBucket');

function sumOverviews(overviews) {
  const connectedOnes = overviews.filter(o => o.connected);
  const base = { sessions: 0, totalUsers: 0, newUsers: 0, conversions: 0 };
  let bounceWeighted = 0;
  let engagementWeighted = 0;

  for (const o of connectedOnes) {
    base.sessions += o.sessions;
    base.totalUsers += o.totalUsers;
    base.newUsers += o.newUsers;
    base.conversions += o.conversions;
    bounceWeighted += o.bounceRate * o.sessions;
    engagementWeighted += o.engagementRate * o.sessions;
  }

  return {
    connected: connectedOnes.length > 0,
    connectedCount: connectedOnes.length,
    sessions: base.sessions,
    totalUsers: base.totalUsers,
    newUsers: base.newUsers,
    returningUsers: Math.max(base.totalUsers - base.newUsers, 0),
    conversions: base.conversions,
    bounceRate: base.sessions > 0 ? bounceWeighted / base.sessions : 0,
    engagementRate: base.sessions > 0 ? engagementWeighted / base.sessions : 0
  };
}

function sumSearchTotals(totals) {
  const connectedOnes = totals.filter(t => t.connected);
  const clicks = connectedOnes.reduce((s, t) => s + t.clicks, 0);
  const impressions = connectedOnes.reduce((s, t) => s + t.impressions, 0);
  const positionWeighted = connectedOnes.reduce((s, t) => s + t.position * t.impressions, 0);

  return {
    connected: connectedOnes.length > 0,
    connectedCount: connectedOnes.length,
    clicks,
    impressions,
    ctr: impressions > 0 ? (clicks / impressions) * 100 : 0,
    position: impressions > 0 ? positionWeighted / impressions : 0
  };
}

function mergeSearchTraffic(searchArrays) {
  const merged = new Map();
  for (const clientResult of searchArrays) {
    const days = Array.isArray(clientResult) ? clientResult : (clientResult?.searchTraffic || []);
    for (const d of days) {
      if (!merged.has(d.day)) merged.set(d.day, { day: d.day, clicks: 0, impressions: 0 });
      const acc = merged.get(d.day);
      acc.clicks += d.clicks;
      acc.impressions += d.impressions;
    }
  }
  return Array.from(merged.values()).sort((a, b) => a.day.localeCompare(b.day));
}

function mergeBreakdownRows(rowArrays, limit = 10) {
  const merged = new Map();
  for (const clientResult of rowArrays) {
    const rows = Array.isArray(clientResult) ? clientResult : (clientResult?.rows || []);
    for (const row of rows) {
      const key = row.dimension;
      if (!merged.has(key)) {
        merged.set(key, { dimension: key, sessions: 0, sessionWeightedBounce: 0, sessionWeightedEngagement: 0, conversions: 0 });
      }
      const acc = merged.get(key);
      acc.sessions += row.sessions;
      acc.sessionWeightedBounce += row.bounceRate * row.sessions;
      acc.sessionWeightedEngagement += row.engagementRate * row.sessions;
      if (row.conversions) acc.conversions += row.conversions;
    }
  }

  return Array.from(merged.values())
    .map(r => ({
      dimension: r.dimension,
      sessions: round(r.sessions),
      bounceRate: r.sessions > 0 ? round(r.sessionWeightedBounce / r.sessions, 1) : 0,
      engagementRate: r.sessions > 0 ? round(r.sessionWeightedEngagement / r.sessions, 1) : 0,
      conversions: round(r.conversions || 0)
    }))
    .sort((a, b) => b.sessions - a.sessions)
    .slice(0, limit);
}

function mergeDailyTraffic(dayArrays) {
  const merged = new Map();
  for (const clientResult of dayArrays) {
    const days = Array.isArray(clientResult) ? clientResult : (clientResult?.days || []);
    for (const d of days) {
      if (!merged.has(d.day)) merged.set(d.day, { day: d.day, organic: 0, paid: 0, direct: 0, referral: 0 });
      const acc = merged.get(d.day);
      acc.organic += d.organic;
      acc.paid += d.paid;
      acc.direct += d.direct;
      acc.referral += d.referral;
    }
  }
  return Array.from(merged.values());
}

function mergeSearchBreakdown(rowArrays, limit = 10) {
  const merged = new Map();
  for (const clientResult of rowArrays) {
    const rows = Array.isArray(clientResult) ? clientResult : [];
    for (const row of rows) {
      const key = row.dimension;
      if (!merged.has(key)) {
        merged.set(key, { dimension: key, clicks: 0, impressions: 0, ctrSum: 0, positionSum: 0, count: 0 });
      }
      const acc = merged.get(key);
      acc.clicks += row.clicks;
      acc.impressions += row.impressions;
      acc.ctrSum += row.ctr;
      acc.positionSum += row.position;
      acc.count += 1;
    }
  }

  return Array.from(merged.values())
    .map(r => ({
      dimension: r.dimension,
      clicks: r.clicks,
      impressions: r.impressions,
      ctr: r.count > 0 ? round(r.ctrSum / r.count, 2) : 0,
      position: r.count > 0 ? round(r.positionSum / r.count, 1) : 0
    }))
    .sort((a, b) => b.clicks - a.clicks)
    .slice(0, limit);
}

function calculateTrends(currentRowsArrays, previousRowsArrays) {
  const currentMerged = mergeSearchBreakdown(currentRowsArrays, 200);
  const previousMerged = mergeSearchBreakdown(previousRowsArrays, 200);

  const prevMap = new Map(previousMerged.map(r => [r.dimension, r]));
  
  const results = currentMerged.map(curr => {
    const prev = prevMap.get(curr.dimension) || { clicks: 0, impressions: 0 };
    const diff = curr.clicks - prev.clicks;
    const percent = prev.clicks > 0 ? (diff / prev.clicks) * 100 : (curr.clicks > 0 ? 100 : 0);
    return {
      dimension: curr.dimension,
      clicks: curr.clicks,
      impressions: curr.impressions,
      diff,
      percent: round(percent, 1)
    };
  });

  return {
    top: results.sort((a, b) => b.clicks - a.clicks).slice(0, 15),
    trendingUp: [...results].filter(r => r.diff > 0).sort((a, b) => b.diff - a.diff).slice(0, 15),
    trendingDown: [...results].filter(r => r.diff < 0).sort((a, b) => a.diff - b.diff).slice(0, 15)
  };
}


async function buildAnalyticsDashboard({ agencyId, projectId, rawDateRange, attributionModel, clientUserId }) {
  const range = resolveDateRange(rawDateRange);
  const { scope, projects } = await resolveScope({ agencyId, projectId });
  
  // Collect all unique client IDs from the resolved projects for CRM metrics
  const crmClientIds = [...new Set(projects.map(p => String(p.clientId)).filter(Boolean))];
  
  let crmScopedClientId = null;
  if (clientUserId) {
    crmScopedClientId = clientUserId;
  } else if (projects.length > 0) {
    crmScopedClientId = projects[0]?.clientId;
  } else {
    // Prevent fetching all agency leads if there are no projects.
    const mongoose = require('mongoose');
    crmScopedClientId = new mongoose.Types.ObjectId().toString();
  }

  const ga4Clients = projects.filter(p => p.credentials?.ga4PropertyId).map(p => ({ ga4PropertyId: p.credentials.ga4PropertyId, ...p.toObject() }));
  
  const getBareDomain = (d) => {
    if (!d) return '';
    let cleaned = d;
    while (cleaned.match(/^https?:\/\//)) cleaned = cleaned.replace(/^https?:\/\//, '');
    while (cleaned.endsWith('/')) cleaned = cleaned.slice(0, -1);
    return cleaned;
  };
  const gscClients = projects.filter(p => p.domain).map(p => {
    let gscSiteUrl;
    if (p.credentials?.gscServiceAccount && (p.credentials.gscServiceAccount.startsWith('http') || p.credentials.gscServiceAccount.startsWith('sc-domain:'))) {
      gscSiteUrl = p.credentials.gscServiceAccount;
    } else {
      const bareDomain = getBareDomain(p.domain);
      gscSiteUrl = p.credentials?.gscServiceAccount ? `sc-domain:${bareDomain}` : `https://${bareDomain}/`;
    }
    return {
      gscSiteUrl,
      ...p.toObject()
    };
  });

  const [
    currentOverviews,
    previousOverviews,
    currentSearchTotals,
    previousSearchTotals,
    queryRowsPerClient,
    searchPageRowsPerClient,
    channelRowsPerClient,
    deviceRowsPerClient,
    countryRowsPerClient,
    referrerRowsPerClient,
    landingPageRowsPerClient,
    organicPageRowsPerClient,
    dailyTrafficPerClient,
    leadMetrics,
    previousLeadMetrics,
    revenueMetrics,
    previousRevenueMetrics,
    performanceAd,
    previousSearchPageRowsPerClient,
    previousQueryRowsPerClient,
    gscCountryRowsPerClient,
    imageSearchTotals,
    videoSearchTotals,
    gscDeviceRowsPerClient,
    gscSearchAppearanceRowsPerClient
  ] = await Promise.all([
    Promise.all(ga4Clients.map(c => ga4.getOverviewMetrics(c.ga4PropertyId, range.ga4Start, range.ga4End))),
    Promise.all(ga4Clients.map(c => ga4.getOverviewMetrics(c.ga4PropertyId, range.previousGa4Start, range.previousGa4End))),
    Promise.all(gscClients.map(c => gsc.getSearchTotals(c.gscSiteUrl, range.ga4Start, range.ga4End))),
    Promise.all(gscClients.map(c => gsc.getSearchTotals(c.gscSiteUrl, range.previousGa4Start, range.previousGa4End))),
    Promise.all(gscClients.map(c => gsc.getSearchBreakdown(c.gscSiteUrl, 'query', range.ga4Start, range.ga4End, 1000))),
    Promise.all(gscClients.map(c => gsc.getSearchBreakdown(c.gscSiteUrl, 'page', range.ga4Start, range.ga4End, 1000))),
    Promise.all(ga4Clients.map(c => ga4.getBreakdown(c.ga4PropertyId, 'sessionSourceMedium', range.ga4Start, range.ga4End, 20))),
    Promise.all(ga4Clients.map(c => ga4.getBreakdown(c.ga4PropertyId, 'deviceCategory', range.ga4Start, range.ga4End, 10))),
    Promise.all(ga4Clients.map(c => ga4.getBreakdown(c.ga4PropertyId, 'country', range.ga4Start, range.ga4End, 10))),
    Promise.all(ga4Clients.map(c => ga4.getBreakdown(c.ga4PropertyId, 'sessionSource', range.ga4Start, range.ga4End, 15))),
    Promise.all(ga4Clients.map(c => ga4.getBreakdown(c.ga4PropertyId, 'pagePath', range.ga4Start, range.ga4End, 50))),
    Promise.all(ga4Clients.map(c => ga4.getOrganicPageBreakdown(c.ga4PropertyId, range.ga4Start, range.ga4End, 10))),
    Promise.all(ga4Clients.map(c => ga4.getDailyTrafficBySourceBucket(c.ga4PropertyId, range.ga4Start, range.ga4End))),
    crm.getLeadMetrics({ companyId: agencyId, clientId: crmScopedClientId, start: range.start, end: range.endExclusive }),
    crm.getLeadMetrics({ companyId: agencyId, clientId: crmScopedClientId, start: range.previousStart, end: range.previousEndExclusive }),
    crm.getRevenueMetrics({ agencyId, clientId: crmScopedClientId, start: range.start, end: range.endExclusive }),
    crm.getRevenueMetrics({ agencyId, clientId: crmScopedClientId, start: range.previousStart, end: range.previousEndExclusive }),
    PerformanceAd.findOne({ agency: agencyId }).select('metrics'),
    Promise.all(gscClients.map(c => gsc.getSearchBreakdown(c.gscSiteUrl, 'page', range.previousGa4Start, range.previousGa4End, 50))),
    Promise.all(gscClients.map(c => gsc.getSearchBreakdown(c.gscSiteUrl, 'query', range.previousGa4Start, range.previousGa4End, 50))),
    Promise.all(gscClients.map(c => gsc.getSearchBreakdown(c.gscSiteUrl, 'country', range.ga4Start, range.ga4End, 20))),
    Promise.all(gscClients.map(c => gsc.getSearchTotals(c.gscSiteUrl, range.ga4Start, range.ga4End, 'image'))),
    Promise.all(gscClients.map(c => gsc.getSearchTotals(c.gscSiteUrl, range.ga4Start, range.ga4End, 'video'))),
    Promise.all(gscClients.map(c => gsc.getSearchBreakdown(c.gscSiteUrl, 'device', range.ga4Start, range.ga4End, 5))),
    Promise.all(gscClients.map(c => gsc.getSearchBreakdown(c.gscSiteUrl, 'searchAppearance', range.ga4Start, range.ga4End, 10)))
  ]);

  const current = sumOverviews(currentOverviews);
  const previous = sumOverviews(previousOverviews);
  const currentSearch = sumSearchTotals(currentSearchTotals);
  const previousSearch = sumSearchTotals(previousSearchTotals);

  const mergedChannelRows = mergeBreakdownRows(channelRowsPerClient, 100);

  const organicSessions = mergedChannelRows
    .filter(r => normalizeChannel(r.dimension) === 'Organic Search')
    .reduce((s, r) => s + r.sessions, 0);

  const conversionRate = current.sessions > 0 ? (leadMetrics.totalLeads / current.sessions) * 100 : 0;
  const previousConversionRate = previous.sessions > 0 ? (previousLeadMetrics.totalLeads / previous.sessions) * 100 : 0;

  const channelSessions = new Map();
  for (const row of mergedChannelRows) {
    const bucket = normalizeChannel(row.dimension);
    channelSessions.set(bucket, (channelSessions.get(bucket) || 0) + row.sessions);
  }
  const channelLeads = new Map();
  for (const row of leadMetrics.leadsByChannel) {
    channelLeads.set(row.channel, (channelLeads.get(row.channel) || 0) + row.leads);
  }
  const allChannelKeys = new Set([...channelSessions.keys(), ...channelLeads.keys()]);
  const channelBreakdown = Array.from(allChannelKeys).map(channel => {
    const sessions = channelSessions.get(channel) || 0;
    const leads = channelLeads.get(channel) || 0;
    return {
      channel,
      sessions,
      leads,
      conversionRate: sessions > 0 ? toPercent((leads / sessions) * 100) : '—'
    };
  }).sort((a, b) => b.sessions - a.sessions);

  const metrics = {
    sessions: round(current.sessions),
    sessionsTrend: trendPercent(current.sessions, previous.sessions),

    users: round(current.totalUsers),
    usersTrend: trendPercent(current.totalUsers, previous.totalUsers),

    newUsers: round(current.newUsers),
    newUsersTrend: trendPercent(current.newUsers, previous.newUsers),

    returningUsers: round(current.returningUsers),
    returningUsersTrend: trendPercent(current.returningUsers, previous.returningUsers),

    organicSessions: round(organicSessions),
    organicTrafficShare: current.sessions > 0 ? toPercent((organicSessions / current.sessions) * 100) : '0%',

    clicks: round(currentSearch.clicks),
    clicksTrend: trendPercent(currentSearch.clicks, previousSearch.clicks),

    impressions: round(currentSearch.impressions),
    impressionsTrend: trendPercent(currentSearch.impressions, previousSearch.impressions),

    ctr: toPercent(currentSearch.ctr, 2),
    ctrTrend: trendPercent(currentSearch.ctr, previousSearch.ctr),

    averagePosition: round(currentSearch.position, 1),
    averagePositionTrend: trendPercent(previousSearch.position, currentSearch.position), // lower position number = better, so trend direction is flipped

    bounceRate: toPercent(current.bounceRate),
    bounceRateTrend: trendPercent(previous.bounceRate, current.bounceRate), // lower bounce = better

    engagementRate: toPercent(current.engagementRate),
    engagementRateTrend: trendPercent(current.engagementRate, previous.engagementRate),

    conversions: round(current.conversions),
    conversionsTrend: trendPercent(current.conversions, previous.conversions),

    leads: leadMetrics.totalLeads,
    leadsTrend: trendPercent(leadMetrics.totalLeads, previousLeadMetrics.totalLeads),

    revenue: round(revenueMetrics.revenue),
    revenueFormatted: formatCurrencyLakhs(revenueMetrics.revenue),
    revenueTrend: trendPercent(revenueMetrics.revenue, previousRevenueMetrics.revenue),

    conversionRate: toPercent(conversionRate),
    conversionRateTrend: trendPercent(conversionRate, previousConversionRate),

    totalAdSpend: formatCurrencyLakhs(performanceAd?.metrics?.adSpendMTD || 0),
    blendedRoas: `${round(performanceAd?.metrics?.roas || 0, 1)}x`
  };

  const topReferrers = mergeBreakdownRows(referrerRowsPerClient, 10)
    .filter(r => !['(direct)', 'google', '(not set)'].includes((r.dimension || '').toLowerCase()))
    .map(r => ({ referrer: r.dimension, sessions: r.sessions }));

  const landingPageSessionsAll = mergeBreakdownRows(landingPageRowsPerClient, 50);
  const topLandingPages = landingPageSessionsAll.slice(0, 10).map(r => ({
    path: r.dimension,
    sessions: r.sessions,
    bounceRate: toPercent(r.bounceRate),
    engagementRate: toPercent(r.engagementRate)
  }));

  const organicPageSessions = mergeBreakdownRows(organicPageRowsPerClient, 10).map(r => ({
    path: r.dimension,
    sessions: r.sessions,
    bounceRate: toPercent(r.bounceRate),
    engagementRate: toPercent(r.engagementRate)
  }));



  const topSearchQueries = mergeSearchBreakdown(queryRowsPerClient, 20).map(r => ({ query: r.dimension, clicks: r.clicks, impressions: r.impressions, ctr: r.ctr, position: r.position }));
  const topSearchPages = mergeSearchBreakdown(searchPageRowsPerClient, 20).map(r => ({ page: r.dimension, clicks: r.clicks, impressions: r.impressions, ctr: r.ctr, position: r.position }));

  const gscPerformance = {
    queries: mergeSearchBreakdown(queryRowsPerClient, 1000).map(r => ({ dimension: r.dimension, clicks: r.clicks, impressions: r.impressions })),
    pages: mergeSearchBreakdown(searchPageRowsPerClient, 1000).map(r => ({ dimension: r.dimension, clicks: r.clicks, impressions: r.impressions })),
    countries: mergeSearchBreakdown(gscCountryRowsPerClient, 20).map(r => ({ dimension: r.dimension, clicks: r.clicks, impressions: r.impressions })),
    devices: mergeSearchBreakdown(gscDeviceRowsPerClient, 5).map(r => ({ dimension: r.dimension, clicks: r.clicks, impressions: r.impressions })),
    searchAppearances: mergeSearchBreakdown(gscSearchAppearanceRowsPerClient, 10).map(r => ({ dimension: r.dimension, clicks: r.clicks, impressions: r.impressions }))
  };

  const gscInsights = {
    pages: calculateTrends(searchPageRowsPerClient, previousSearchPageRowsPerClient),
    queries: calculateTrends(queryRowsPerClient, previousQueryRowsPerClient),
    countries: mergeSearchBreakdown(gscCountryRowsPerClient, 10).map(r => ({ country: r.dimension, clicks: r.clicks })),
    additionalSources: [
      { source: 'Image search', clicks: sumSearchTotals(imageSearchTotals).clicks },
      { source: 'Video search', clicks: sumSearchTotals(videoSearchTotals).clicks }
    ].filter(s => s.clicks > 0)
  };

  return {
    meta: {
      agencyId: String(agencyId),
      projectId: scope === 'single' ? String(projectId) : null,
      scope,
      dateRange: { start: range.ga4Start, end: range.ga4End },
      previousDateRange: { start: range.previousGa4Start, end: range.previousGa4End },
      generatedAt: new Date().toISOString(),
      connections: {
        ga4: { connectedClients: current.connectedCount, configuredClients: ga4Clients.length, totalClients: projects.length },
        gsc: { connectedClients: currentSearch.connectedCount, configuredClients: gscClients.length, totalClients: projects.length }
      }
    },
    metrics,
    websiteTraffic: mergeDailyTraffic(dailyTrafficPerClient),
    searchTraffic: mergeSearchTraffic(currentSearchTotals),
    topSearchQueries,
    topSearchPages,
    leadsByChannel: leadMetrics.leadsByChannel,
    channelBreakdown,
    topLandingPages,
    topChannels: mergedChannelRows.slice(0, 10).map(r => ({ channel: r.dimension, sessions: r.sessions })),
    topDevices: mergeBreakdownRows(deviceRowsPerClient, 10).map(r => ({ device: r.dimension, sessions: r.sessions })),
    topCountries: mergeBreakdownRows(countryRowsPerClient, 10).map(r => ({ country: r.dimension, sessions: r.sessions })),
    topReferrers,
    gscInsights,
    gscPerformance
  };
}

module.exports = { buildAnalyticsDashboard };