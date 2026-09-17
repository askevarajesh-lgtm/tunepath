import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import dayjs from 'dayjs';

const monthNames = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

function addDocHeader(doc, clientName, reportTitle, subTitle) {
  doc.setTextColor(30, 41, 59);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.text(`${clientName} - Client Report`, 14, 20);

  doc.setFontSize(14);
  doc.setTextColor(59, 130, 246);
  doc.text(reportTitle, 14, 30);

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 116, 139);
  doc.text(subTitle, 14, 37);
}

function addDocFooter(doc, clientName, footerLabel) {
  const pageCount = doc.internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(148, 163, 184);
    doc.text(`${clientName} — ${footerLabel}`, 14, 287);
    doc.text(`Page ${i} of ${pageCount}`, 196, 287, { align: 'right' });
  }
}

/**
 * 1. Highlights of the Month
 */
export function generateHighlightsOfTheMonthPDF(data = {}, clientInfo = {}) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const monthStr = data.month ? monthNames[data.month - 1] : dayjs().format('MMMM');
  const yearStr = data.year || dayjs().format('YYYY');
  const clientName = clientInfo.companyName || clientInfo.name || 'Client';

  addDocHeader(
    doc, 
    clientName, 
    `Highlights of the Month (${monthStr} ${yearStr})`, 
    `Purpose: Provide a short management-level summary of the month's completed digital/marketing activities.`
  );

  const digitalInsightsText = [
    `Facebook followers increased: ${data.digitalInsights?.facebookFollowersIncreased ?? 0}`,
    `Total Facebook followers: ${data.digitalInsights?.facebookTotalFollowers ?? 0}`,
    `Facebook reach: ${data.digitalInsights?.facebookReach ?? 0}`,
    `Instagram followers increased: ${data.digitalInsights?.instagramFollowersIncreased ?? 0}`,
    `Total Instagram followers: ${data.digitalInsights?.instagramTotalFollowers ?? 0}`,
    `Instagram reach: ${data.digitalInsights?.instagramReach ?? 0}`
  ].join('; ');

  const blogsText = `Number of blog updates: ${data.blogs?.count ?? 0}${data.blogs?.notes ? ` (${data.blogs.notes})` : ''}`;
  const brandCommText = (data.brandCommunicationDesign?.deliverables && data.brandCommunicationDesign.deliverables.length > 0)
    ? data.brandCommunicationDesign.deliverables.map(d => `${d.name} — ${d.completed} / ${d.total} Completed`).join('; ')
    : (data.brandCommunicationDesign?.notes || `Number of social media post designs: ${data.brandCommunicationDesign?.socialMediaPostDesignsCount ?? 0}; Number of videos: ${data.brandCommunicationDesign?.videosCount ?? 0}`);
  const offlineText = data.offlineCollaterals || 'Internal branding / collateral work completed';
  const specialText = data.specialInitiatives || 'Special initiatives completed during the month';

  autoTable(doc, {
    startY: 44,
    head: [['Category', 'Information to Capture']],
    body: [
      ...(data.hasSocialMediaModule ? [['Digital Insights', digitalInsightsText]] : []),
      ['Blogs', blogsText],
      ['Brand Communication Design', brandCommText],
      ['Offline Collaterals', offlineText],
      ['Special Initiatives', specialText]
    ],
    theme: 'grid',
    headStyles: { fillColor: [224, 242, 254], textColor: [15, 23, 42], fontSize: 10, fontStyle: 'bold', lineColor: [148, 163, 184], lineWidth: 0.3 },
    bodyStyles: { textColor: [30, 41, 59], fontSize: 9.5, lineColor: [203, 213, 225], lineWidth: 0.2, cellPadding: 5 },
    columnStyles: { 0: { fontStyle: 'bold', cellWidth: 55 }, 1: { cellWidth: 127 } },
    margin: { left: 14, right: 14 }
  });

  addDocFooter(doc, clientName, `Highlights of the Month (${monthStr} ${yearStr})`);
  const filename = `Highlights_of_the_Month_${clientName.replace(/\s+/g, '_')}_${monthStr}_${yearStr}.pdf`;
  doc.save(filename);
  return filename;
}

/**
 * 2. Keyword Ranking Overview
 */
export function generateKeywordRankingOverviewPDF(data = {}, clientInfo = {}) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const monthStr = data.month ? monthNames[data.month - 1] : dayjs().format('MMMM');
  const yearStr = data.year || dayjs().format('YYYY');
  const clientName = clientInfo.companyName || clientInfo.name || 'Client';

  addDocHeader(
    doc, 
    clientName, 
    `Keyword Ranking Overview (${monthStr} ${yearStr})`, 
    `Purpose: Show overall organic keyword-ranking performance for the selected month and compare it with previous months.`
  );

  const keywordData = (data.keywordRankingOverview && data.keywordRankingOverview.length > 0)
    ? data.keywordRankingOverview.map(row => [row.month, String(row.top10 || 0), String(row.top20 || 0), String(row.top30Above || 0)])
    : [[`${monthStr} ${yearStr}`, '0', '0', '0']];

  autoTable(doc, {
    startY: 44,
    head: [['Month', 'Keywords Ranking Top 10', 'Keywords Ranking Top 20', 'Keywords Ranking Top 30 Above']],
    body: keywordData,
    theme: 'grid',
    headStyles: { fillColor: [224, 242, 254], textColor: [15, 23, 42], fontSize: 10, fontStyle: 'bold', lineColor: [148, 163, 184], lineWidth: 0.3 },
    bodyStyles: { textColor: [30, 41, 59], fontSize: 9.5, lineColor: [203, 213, 225], lineWidth: 0.2, cellPadding: 5 },
    columnStyles: { 0: { fontStyle: 'bold', cellWidth: 45 }, 1: { cellWidth: 45, halign: 'center' }, 2: { cellWidth: 45, halign: 'center' }, 3: { cellWidth: 47, halign: 'center' } },
    margin: { left: 14, right: 14 }
  });

  addDocFooter(doc, clientName, `Keyword Ranking Overview (${monthStr} ${yearStr})`);
  const filename = `Keyword_Ranking_Overview_${clientName.replace(/\s+/g, '_')}_${monthStr}_${yearStr}.pdf`;
  doc.save(filename);
  return filename;
}

/**
 * 3. Keyword Ranking Details
 */
export function generateKeywordRankingDetailsPDF(data = {}, clientInfo = {}) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const monthStr = data.month ? monthNames[data.month - 1] : dayjs().format('MMMM');
  const yearStr = data.year || dayjs().format('YYYY');
  const clientName = clientInfo.companyName || clientInfo.name || 'Client';

  addDocHeader(
    doc, 
    clientName, 
    `Keyword Ranking Details (${monthStr} ${yearStr})`, 
    `Purpose: Granular organic keyword rankings with monthly rank trends and category grouping.`
  );

  const keywordDetailsData = (data.keywordRankingDetails && data.keywordRankingDetails.length > 0)
    ? data.keywordRankingDetails.map(row => [
        row.keyword || '',
        row.category || 'General',
        row.volume ? Number(row.volume).toLocaleString() : '0',
        (row.monthRanks && row.monthRanks.length > 0) ? row.monthRanks.map(mr => `${mr.month}: ${mr.rank}`).join(' | ') : '-'
      ])
    : [['No tracked keywords recorded', 'General', '0', '-']];

  autoTable(doc, {
    startY: 44,
    head: [['Keyword', 'Keyword Category', 'Volume', 'Month-wise Rank Progression']],
    body: keywordDetailsData,
    theme: 'grid',
    headStyles: { fillColor: [224, 242, 254], textColor: [15, 23, 42], fontSize: 10, fontStyle: 'bold', lineColor: [148, 163, 184], lineWidth: 0.3 },
    bodyStyles: { textColor: [30, 41, 59], fontSize: 9, lineColor: [203, 213, 225], lineWidth: 0.2, cellPadding: 4 },
    columnStyles: { 0: { fontStyle: 'bold', cellWidth: 50 }, 1: { cellWidth: 40 }, 2: { cellWidth: 25, halign: 'right' }, 3: { cellWidth: 67 } },
    margin: { left: 14, right: 14 }
  });

  addDocFooter(doc, clientName, `Keyword Ranking Details (${monthStr} ${yearStr})`);
  const filename = `Keyword_Ranking_Details_${clientName.replace(/\s+/g, '_')}_${monthStr}_${yearStr}.pdf`;
  doc.save(filename);
  return filename;
}

/**
 * 4. Meta Insights – Facebook
 */
export function generateMetaInsightsFacebookPDF(data = {}, clientInfo = {}) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const monthStr = data.month ? monthNames[data.month - 1] : dayjs().format('MMMM');
  const yearStr = data.year || dayjs().format('YYYY');
  const clientName = clientInfo.companyName || clientInfo.name || 'Client';

  addDocHeader(
    doc, 
    clientName, 
    `Meta Insights – Facebook (${monthStr} ${yearStr})`, 
    `Purpose: Show monthly Facebook performance (views, reach, and followers).`
  );

  const metaFacebookData = (data.metaInsightsFacebook && data.metaInsightsFacebook.length > 0)
    ? data.metaInsightsFacebook.map(row => [
        row.month || '',
        row.views ? Number(row.views).toLocaleString() : '0',
        row.reach ? Number(row.reach).toLocaleString() : '0',
        row.followers ? Number(row.followers).toLocaleString() : '0'
      ])
    : [[`${monthStr} ${yearStr}`, '0', '0', '0']];

  autoTable(doc, {
    startY: 44,
    head: [['Month', 'Views', 'Reach', 'Followers']],
    body: metaFacebookData,
    theme: 'grid',
    headStyles: { fillColor: [224, 242, 254], textColor: [15, 23, 42], fontSize: 10, fontStyle: 'bold', lineColor: [148, 163, 184], lineWidth: 0.3 },
    bodyStyles: { textColor: [30, 41, 59], fontSize: 9.5, lineColor: [203, 213, 225], lineWidth: 0.2, cellPadding: 5 },
    columnStyles: { 0: { fontStyle: 'bold', cellWidth: 45 }, 1: { cellWidth: 45, halign: 'right' }, 2: { cellWidth: 45, halign: 'right' }, 3: { cellWidth: 47, halign: 'right' } },
    margin: { left: 14, right: 14 }
  });

  addDocFooter(doc, clientName, `Meta Insights – Facebook (${monthStr} ${yearStr})`);
  const filename = `Meta_Insights_Facebook_${clientName.replace(/\s+/g, '_')}_${monthStr}_${yearStr}.pdf`;
  doc.save(filename);
  return filename;
}

/**
 * 5. Meta Insights – Instagram
 */
export function generateMetaInsightsInstagramPDF(data = {}, clientInfo = {}) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const monthStr = data.month ? monthNames[data.month - 1] : dayjs().format('MMMM');
  const yearStr = data.year || dayjs().format('YYYY');
  const clientName = clientInfo.companyName || clientInfo.name || 'Client';

  addDocHeader(
    doc, 
    clientName, 
    `Meta Insights – Instagram (${monthStr} ${yearStr})`, 
    `Purpose: Show monthly Instagram performance (views, reach, and followers).`
  );

  const metaInstagramData = (data.metaInsightsInstagram && data.metaInsightsInstagram.length > 0)
    ? data.metaInsightsInstagram.map(row => [
        row.month || '',
        row.views ? Number(row.views).toLocaleString() : '0',
        row.reach ? Number(row.reach).toLocaleString() : '0',
        row.followers ? Number(row.followers).toLocaleString() : '0'
      ])
    : [[`${monthStr} ${yearStr}`, '0', '0', '0']];

  autoTable(doc, {
    startY: 44,
    head: [['Month', 'Views', 'Reach', 'Followers']],
    body: metaInstagramData,
    theme: 'grid',
    headStyles: { fillColor: [224, 242, 254], textColor: [15, 23, 42], fontSize: 10, fontStyle: 'bold', lineColor: [148, 163, 184], lineWidth: 0.3 },
    bodyStyles: { textColor: [30, 41, 59], fontSize: 9.5, lineColor: [203, 213, 225], lineWidth: 0.2, cellPadding: 5 },
    columnStyles: { 0: { fontStyle: 'bold', cellWidth: 45 }, 1: { cellWidth: 45, halign: 'right' }, 2: { cellWidth: 45, halign: 'right' }, 3: { cellWidth: 47, halign: 'right' } },
    margin: { left: 14, right: 14 }
  });

  addDocFooter(doc, clientName, `Meta Insights – Instagram (${monthStr} ${yearStr})`);
  const filename = `Meta_Insights_Instagram_${clientName.replace(/\s+/g, '_')}_${monthStr}_${yearStr}.pdf`;
  doc.save(filename);
  return filename;
}

/**
 * 8. Website Traffic – Overview
 */
export function generateWebsiteTrafficOverviewPDF(data = {}, clientInfo = {}) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const monthStr = data.month ? monthNames[data.month - 1] : dayjs().format('MMMM');
  const yearStr = data.year || dayjs().format('YYYY');
  const clientName = clientInfo.companyName || clientInfo.name || 'Client';

  addDocHeader(
    doc, 
    clientName, 
    `Website Traffic – Overview (${monthStr} ${yearStr})`, 
    `Purpose: Show monthly website traffic trend.`
  );

  const websiteTrafficData = (data.websiteTrafficOverview && data.websiteTrafficOverview.length > 0)
    ? data.websiteTrafficOverview.map(row => [
        row.month || '',
        row.users ? Number(row.users).toLocaleString('en-IN') : '0',
        row.newUsers ? Number(row.newUsers).toLocaleString('en-IN') : '0'
      ])
    : [[`${monthStr} ${yearStr}`, '0', '0']];

  autoTable(doc, {
    startY: 44,
    head: [['Month', 'Users', 'New Users']],
    body: websiteTrafficData,
    theme: 'grid',
    headStyles: { fillColor: [224, 242, 254], textColor: [15, 23, 42], fontSize: 10, fontStyle: 'bold', lineColor: [148, 163, 184], lineWidth: 0.3 },
    bodyStyles: { textColor: [30, 41, 59], fontSize: 9.5, lineColor: [203, 213, 225], lineWidth: 0.2, cellPadding: 5 },
    columnStyles: { 0: { fontStyle: 'bold', cellWidth: 60 }, 1: { cellWidth: 60, halign: 'right' }, 2: { cellWidth: 62, halign: 'right' } },
    margin: { left: 14, right: 14 }
  });

  addDocFooter(doc, clientName, `Website Traffic – Overview (${monthStr} ${yearStr})`);
  const filename = `Website_Traffic_Overview_${clientName.replace(/\s+/g, '_')}_${monthStr}_${yearStr}.pdf`;
  doc.save(filename);
  return filename;
}

/**
 * 9. Website Traffic – Landing Page Views
 */
export function generateWebsiteTrafficLandingPagesPDF(data = {}, clientInfo = {}) {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const monthStr = data.month ? monthNames[data.month - 1] : dayjs().format('MMMM');
  const yearStr = data.year || dayjs().format('YYYY');
  const clientName = clientInfo.companyName || clientInfo.name || 'Client';

  addDocHeader(
    doc, 
    clientName, 
    `Website Traffic – Landing Page Views (${monthStr} ${yearStr})`, 
    `Purpose: Show which website pages receive the most traffic and engagement.`
  );

  const landingPageData = (data.websiteTrafficLandingPages && data.websiteTrafficLandingPages.length > 0)
    ? data.websiteTrafficLandingPages.map(row => [
        row.pagePath || '/',
        row.views ? Number(row.views).toLocaleString('en-IN') : '0',
        row.activeUsers ? Number(row.activeUsers).toLocaleString('en-IN') : '0',
        row.viewsPerActiveUser !== undefined ? Number(row.viewsPerActiveUser).toFixed(2) : '0.00',
        row.avgEngagementTime || '0s',
        row.eventCount ? Number(row.eventCount).toLocaleString('en-IN') : '0'
      ])
    : [['No landing page traffic recorded', '0', '0', '0.00', '0s', '0']];

  autoTable(doc, {
    startY: 44,
    head: [['Page path / screen class', 'Views', 'Active users', 'Views per active user', 'Average engagement time', 'Event count']],
    body: landingPageData,
    theme: 'grid',
    headStyles: { fillColor: [224, 242, 254], textColor: [15, 23, 42], fontSize: 9.5, fontStyle: 'bold', lineColor: [148, 163, 184], lineWidth: 0.3 },
    bodyStyles: { textColor: [30, 41, 59], fontSize: 9, lineColor: [203, 213, 225], lineWidth: 0.2, cellPadding: 4 },
    columnStyles: { 
      0: { fontStyle: 'bold', cellWidth: 100 }, 
      1: { cellWidth: 32, halign: 'right' }, 
      2: { cellWidth: 32, halign: 'right' }, 
      3: { cellWidth: 36, halign: 'right' }, 
      4: { cellWidth: 39, halign: 'right' },
      5: { cellWidth: 30, halign: 'right' }
    },
    margin: { left: 14, right: 14 }
  });

  addDocFooter(doc, clientName, `Website Traffic – Landing Page Views (${monthStr} ${yearStr})`);
  const filename = `Website_Traffic_Landing_Page_Views_${clientName.replace(/\s+/g, '_')}_${monthStr}_${yearStr}.pdf`;
  doc.save(filename);
  return filename;
}

/**
 * 10. Website Traffic – Users by City
 */
export function generateWebsiteTrafficUsersByCityPDF(data = {}, clientInfo = {}) {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const monthStr = data.month ? monthNames[data.month - 1] : dayjs().format('MMMM');
  const yearStr = data.year || dayjs().format('YYYY');
  const clientName = clientInfo.companyName || clientInfo.name || 'Client';

  addDocHeader(
    doc, 
    clientName, 
    `Website Traffic – Users by City (${monthStr} ${yearStr})`, 
    `Purpose: Show website audience and engagement by city.`
  );

  const cityData = (data.websiteTrafficUsersByCity && data.websiteTrafficUsersByCity.length > 0)
    ? data.websiteTrafficUsersByCity.map(row => [
        row.city || '(not set)',
        row.activeUsers ? Number(row.activeUsers).toLocaleString('en-IN') : '0',
        row.newUsers ? Number(row.newUsers).toLocaleString('en-IN') : '0',
        row.engagedSessions ? Number(row.engagedSessions).toLocaleString('en-IN') : '0',
        row.engagementRate || '0.0%',
        row.engagedSessionsPerActiveUser !== undefined ? Number(row.engagedSessionsPerActiveUser).toFixed(2) : '0.00',
        row.avgEngagementTime || '0s',
        row.eventCount ? Number(row.eventCount).toLocaleString('en-IN') : '0',
        row.keyEvents ? Number(row.keyEvents).toLocaleString('en-IN') : '0',
        row.userKeyEventRate || '0.0%'
      ])
    : [['No city traffic recorded', '0', '0', '0', '0.0%', '0.00', '0s', '0', '0', '0.0%']];

  autoTable(doc, {
    startY: 44,
    head: [['City', 'Active users', 'New users', 'Engaged sessions', 'Engagement rate', 'Sessions/User', 'Avg engagement time', 'Event count', 'Key events', 'Key event rate']],
    body: cityData,
    theme: 'grid',
    headStyles: { fillColor: [224, 242, 254], textColor: [15, 23, 42], fontSize: 8.5, fontStyle: 'bold', lineColor: [148, 163, 184], lineWidth: 0.3 },
    bodyStyles: { textColor: [30, 41, 59], fontSize: 8, lineColor: [203, 213, 225], lineWidth: 0.2, cellPadding: 3.5 },
    columnStyles: { 
      0: { fontStyle: 'bold', cellWidth: 45 }, 
      1: { cellWidth: 24, halign: 'right' }, 
      2: { cellWidth: 24, halign: 'right' }, 
      3: { cellWidth: 26, halign: 'right' }, 
      4: { cellWidth: 26, halign: 'right' },
      5: { cellWidth: 24, halign: 'right' },
      6: { cellWidth: 32, halign: 'right' },
      7: { cellWidth: 22, halign: 'right' },
      8: { cellWidth: 20, halign: 'right' },
      9: { cellWidth: 26, halign: 'right' }
    },
    margin: { left: 10, right: 10 }
  });

  addDocFooter(doc, clientName, `Website Traffic – Users by City (${monthStr} ${yearStr})`);
  const filename = `Website_Traffic_Users_by_City_${clientName.replace(/\s+/g, '_')}_${monthStr}_${yearStr}.pdf`;
  doc.save(filename);
  return filename;
}

/**
 * 12. Social Media Post Insights (Section 3.12)
 */
export function generateSocialMediaPostInsightsPDF(data = {}, clientInfo = {}) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const monthStr = data.month ? monthNames[data.month - 1] : dayjs().format('MMMM');
  const yearStr = data.year || dayjs().format('YYYY');
  const clientName = clientInfo.companyName || clientInfo.name || 'Client';

  addDocHeader(
    doc, 
    clientName, 
    `3.12 Social Media Post Insights (${monthStr} ${yearStr})`, 
    `Purpose: Track the number of social media contents published during the month.`
  );

  const videoCount = data.socialMediaPostInsights?.videoCount ?? data.brandCommunicationDesign?.videosCount ?? 0;
  const postCount = data.socialMediaPostInsights?.postCount ?? data.brandCommunicationDesign?.socialMediaPostDesignsCount ?? 0;
  const totalCount = data.socialMediaPostInsights?.totalCount ?? (videoCount + postCount);

  autoTable(doc, {
    startY: 44,
    head: [['Field / Type of Post', 'Requirement / Number Published']],
    body: [
      ['Video', String(videoCount)],
      ['Post', String(postCount)],
      ['Total Content Published', String(totalCount)]
    ],
    theme: 'grid',
    headStyles: { fillColor: [224, 242, 254], textColor: [15, 23, 42], fontSize: 10, fontStyle: 'bold', lineColor: [148, 163, 184], lineWidth: 0.3 },
    bodyStyles: { textColor: [30, 41, 59], fontSize: 9.5, lineColor: [203, 213, 225], lineWidth: 0.2, cellPadding: 5 },
    columnStyles: { 
      0: { fontStyle: 'bold', cellWidth: 90 }, 
      1: { cellWidth: 92, halign: 'center' } 
    },
    margin: { left: 14, right: 14 }
  });

  addDocFooter(doc, clientName, `3.12 Social Media Post Insights (${monthStr} ${yearStr})`);
  const filename = `Social_Media_Post_Insights_${clientName.replace(/\s+/g, '_')}_${monthStr}_${yearStr}.pdf`;
  doc.save(filename);
  return filename;
}

/**
 * 14. YouTube Report (Section 3.14)
 */
export function generateYouTubeReportPDF(data = {}, clientInfo = {}) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const monthStr = data.month ? monthNames[data.month - 1] : dayjs().format('MMMM');
  const yearStr = data.year || dayjs().format('YYYY');
  const clientName = clientInfo.companyName || clientInfo.name || 'Client';

  addDocHeader(
    doc, 
    clientName, 
    `3.14 YouTube Report (${monthStr} ${yearStr})`, 
    `Purpose: Simple monthly YouTube performance reporting.`
  );

  const reportItem = Array.isArray(data.youTubeReport) && data.youTubeReport.length > 0 
    ? data.youTubeReport[0] 
    : (data.youTubeReport || {});

  const repMonth = reportItem.month || `${monthStr} ${yearStr}`;
  const views = reportItem.views ?? 0;
  const lastMonthSubs = reportItem.lastMonthSubscribers ?? 0;
  const totalSubs = reportItem.totalSubscribers ?? 0;

  autoTable(doc, {
    startY: 44,
    head: [['Field', 'Requirement']],
    body: [
      ['Month', String(repMonth)],
      ['Views', typeof views === 'number' ? views.toLocaleString() : String(views)],
      ['Last Month Subscribers', typeof lastMonthSubs === 'number' ? lastMonthSubs.toLocaleString() : String(lastMonthSubs)],
      ['Total Subscribers', typeof totalSubs === 'number' ? totalSubs.toLocaleString() : String(totalSubs)]
    ],
    theme: 'grid',
    headStyles: { fillColor: [224, 242, 254], textColor: [15, 23, 42], fontSize: 10, fontStyle: 'bold', lineColor: [148, 163, 184], lineWidth: 0.3 },
    bodyStyles: { textColor: [30, 41, 59], fontSize: 9.5, lineColor: [203, 213, 225], lineWidth: 0.2, cellPadding: 5 },
    columnStyles: { 
      0: { fontStyle: 'bold', cellWidth: 90 }, 
      1: { cellWidth: 92, halign: 'center' } 
    },
    margin: { left: 14, right: 14 }
  });

  addDocFooter(doc, clientName, `3.14 YouTube Report (${monthStr} ${yearStr})`);
  const filename = `YouTube_Report_${clientName.replace(/\s+/g, '_')}_${monthStr}_${yearStr}.pdf`;
  doc.save(filename);
  return filename;
}

/**
 * Combined PDF: Keywords Report (Section 3.2 Overview + Section 3.3 Details)
 */
export function generateKeywordsCombinedPDF(data = {}, clientInfo = {}) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const monthStr = data.month ? monthNames[data.month - 1] : dayjs().format('MMMM');
  const yearStr = data.year || dayjs().format('YYYY');
  const clientName = clientInfo.companyName || clientInfo.name || 'Client';

  addDocHeader(
    doc, 
    clientName, 
    `Keywords Report (${monthStr} ${yearStr})`, 
    `Purpose: Organic keyword performance metrics including ranking overview and granular keyword details.`
  );

  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(16, 185, 129);
  doc.text('3.2 Keyword Ranking Overview', 14, 44);

  const overviewRows = (data.keywordRankingOverview || []).map(item => [
    item.month || '',
    String(item.top10 ?? 0),
    String(item.top20 ?? 0),
    String(item.top30Above ?? 0)
  ]);

  autoTable(doc, {
    startY: 48,
    head: [['Month', 'Top 10', 'Top 20', 'Top 30 Above']],
    body: overviewRows.length > 0 ? overviewRows : [['No data', '0', '0', '0']],
    theme: 'grid',
    headStyles: { fillColor: [209, 250, 229], textColor: [6, 78, 59], fontSize: 9.5, fontStyle: 'bold', lineColor: [110, 231, 183], lineWidth: 0.3 },
    bodyStyles: { textColor: [30, 41, 59], fontSize: 9, lineColor: [203, 213, 225], lineWidth: 0.2, cellPadding: 3.5 },
    columnStyles: { 0: { fontStyle: 'bold', cellWidth: 50 }, 1: { halign: 'center' }, 2: { halign: 'center' }, 3: { halign: 'center' } },
    margin: { left: 14, right: 14 }
  });

  let currentY = (doc.lastAutoTable ? doc.lastAutoTable.finalY : 48) + 12;

  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(5, 150, 105);
  doc.text('3.3 Keyword Ranking Details', 14, currentY);

  const monthAbbrs = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const curMonthIndex = data.month ? (data.month - 1) : dayjs().month();
  const prevMonthIndex = (curMonthIndex - 1 + 12) % 12;
  const m1Header = monthAbbrs[prevMonthIndex];
  const m2Header = monthAbbrs[curMonthIndex];

  const detailRows = (data.keywordRankingDetails || []).map(item => [
    item.keyword || '',
    item.category || 'General',
    item.searchVolume ? Number(item.searchVolume).toLocaleString() : '—',
    item.rankMonth1 !== undefined && item.rankMonth1 !== null ? String(item.rankMonth1) : '—',
    item.rankMonth2 !== undefined && item.rankMonth2 !== null ? String(item.rankMonth2) : '—'
  ]);

  autoTable(doc, {
    startY: currentY + 4,
    head: [['Keyword', 'Category', 'Search Vol', m1Header, m2Header]],
    body: detailRows.length > 0 ? detailRows : [['No keywords added', '—', '—', '—', '—']],
    theme: 'grid',
    headStyles: { fillColor: [209, 250, 229], textColor: [6, 78, 59], fontSize: 9.5, fontStyle: 'bold', lineColor: [110, 231, 183], lineWidth: 0.3 },
    bodyStyles: { textColor: [30, 41, 59], fontSize: 8.5, lineColor: [203, 213, 225], lineWidth: 0.2, cellPadding: 3.5 },
    columnStyles: { 0: { fontStyle: 'bold', cellWidth: 55 }, 1: { cellWidth: 40 }, 2: { halign: 'right' }, 3: { halign: 'center' }, 4: { halign: 'center' } },
    margin: { left: 14, right: 14 }
  });

  addDocFooter(doc, clientName, `Keywords Report (${monthStr} ${yearStr})`);
  const filename = `Keywords_Report_${clientName.replace(/\s+/g, '_')}_${monthStr}_${yearStr}.pdf`;
  doc.save(filename);
  return filename;
}

/**
 * Combined PDF: Meta Insights Report (Facebook + Instagram)
 */
export function generateMetaInsightsCombinedPDF(data = {}, clientInfo = {}) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const monthStr = data.month ? monthNames[data.month - 1] : dayjs().format('MMMM');
  const yearStr = data.year || dayjs().format('YYYY');
  const clientName = clientInfo.companyName || clientInfo.name || 'Client';

  addDocHeader(
    doc, 
    clientName, 
    `Meta Insights Report (${monthStr} ${yearStr})`, 
    `Purpose: Monthly profile performance metrics for Facebook Page Insights and Instagram Profile Insights.`
  );

  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(24, 119, 242);
  doc.text('3.5 Meta Insights – Facebook', 14, 44);

  const fbRows = (data.metaInsightsFacebook || []).map(item => [
    item.month || '',
    Number(item.views || 0).toLocaleString(),
    Number(item.reach || 0).toLocaleString(),
    Number(item.followers || 0).toLocaleString()
  ]);

  autoTable(doc, {
    startY: 48,
    head: [['Month', 'Views', 'Reach', 'Followers']],
    body: fbRows.length > 0 ? fbRows : [['No data', '0', '0', '0']],
    theme: 'grid',
    headStyles: { fillColor: [219, 234, 254], textColor: [30, 58, 138], fontSize: 9.5, fontStyle: 'bold', lineColor: [147, 197, 253], lineWidth: 0.3 },
    bodyStyles: { textColor: [30, 41, 59], fontSize: 9, lineColor: [203, 213, 225], lineWidth: 0.2, cellPadding: 3.5 },
    columnStyles: { 0: { fontStyle: 'bold', cellWidth: 50 }, 1: { halign: 'right' }, 2: { halign: 'right' }, 3: { halign: 'right' } },
    margin: { left: 14, right: 14 }
  });

  let currentY = (doc.lastAutoTable ? doc.lastAutoTable.finalY : 48) + 12;

  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(225, 48, 108);
  doc.text('3.6 Meta Insights – Instagram', 14, currentY);

  const igRows = (data.metaInsightsInstagram || []).map(item => [
    item.month || '',
    Number(item.views || 0).toLocaleString(),
    Number(item.reach || 0).toLocaleString(),
    Number(item.followers || 0).toLocaleString()
  ]);

  autoTable(doc, {
    startY: currentY + 4,
    head: [['Month', 'Views', 'Reach', 'Followers']],
    body: igRows.length > 0 ? igRows : [['No data', '0', '0', '0']],
    theme: 'grid',
    headStyles: { fillColor: [252, 231, 243], textColor: [131, 24, 67], fontSize: 9.5, fontStyle: 'bold', lineColor: [249, 168, 212], lineWidth: 0.3 },
    bodyStyles: { textColor: [30, 41, 59], fontSize: 9, lineColor: [203, 213, 225], lineWidth: 0.2, cellPadding: 3.5 },
    columnStyles: { 0: { fontStyle: 'bold', cellWidth: 50 }, 1: { halign: 'right' }, 2: { halign: 'right' }, 3: { halign: 'right' } },
    margin: { left: 14, right: 14 }
  });

  addDocFooter(doc, clientName, `Meta Insights Report (${monthStr} ${yearStr})`);
  const filename = `Meta_Insights_Report_${clientName.replace(/\s+/g, '_')}_${monthStr}_${yearStr}.pdf`;
  doc.save(filename);
  return filename;
}

/**
 * Combined PDF: Website Traffic Report (Overview + Landing Pages + Users by City)
 */
export function generateWebsiteTrafficCombinedPDF(data = {}, clientInfo = {}) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const monthStr = data.month ? monthNames[data.month - 1] : dayjs().format('MMMM');
  const yearStr = data.year || dayjs().format('YYYY');
  const clientName = clientInfo.companyName || clientInfo.name || 'Client';

  addDocHeader(
    doc, 
    clientName, 
    `Website Traffic Report (${monthStr} ${yearStr})`, 
    `Purpose: Comprehensive website traffic analysis including traffic overview, top landing pages, and user location breakdown.`
  );

  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(2, 132, 199);
  doc.text('8. Website Traffic – Overview', 14, 44);

  const overviewRows = (data.websiteTrafficOverview || []).map(item => [
    item.month || '',
    Number(item.users || 0).toLocaleString(),
    Number(item.newUsers || 0).toLocaleString()
  ]);

  autoTable(doc, {
    startY: 48,
    head: [['Month', 'Users', 'New Users']],
    body: overviewRows.length > 0 ? overviewRows : [['No data', '0', '0']],
    theme: 'grid',
    headStyles: { fillColor: [224, 242, 254], textColor: [12, 74, 110], fontSize: 9.5, fontStyle: 'bold', lineColor: [148, 163, 184], lineWidth: 0.3 },
    bodyStyles: { textColor: [30, 41, 59], fontSize: 9, lineColor: [203, 213, 225], lineWidth: 0.2, cellPadding: 3.5 },
    columnStyles: { 0: { fontStyle: 'bold', cellWidth: 50 }, 1: { halign: 'right' }, 2: { halign: 'right' } },
    margin: { left: 14, right: 14 }
  });

  let currentY = (doc.lastAutoTable ? doc.lastAutoTable.finalY : 48) + 12;

  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(14, 165, 233);
  doc.text('9. Website Traffic – Landing Page Views', 14, currentY);

  const lpRows = (data.websiteTrafficLandingPages || []).map(item => [
    item.pagePath || '',
    Number(item.views || 0).toLocaleString(),
    Number(item.activeUsers || 0).toLocaleString(),
    String(item.viewsPerUser ?? 0),
    String(item.avgEngagementTime || '0s'),
    Number(item.eventCount || 0).toLocaleString()
  ]);

  autoTable(doc, {
    startY: currentY + 4,
    head: [['Landing Page', 'Views', 'Active Users', 'Views/User', 'Avg Time', 'Events']],
    body: lpRows.length > 0 ? lpRows : [['No landing page data', '0', '0', '0', '0s', '0']],
    theme: 'grid',
    headStyles: { fillColor: [224, 242, 254], textColor: [12, 74, 110], fontSize: 9, fontStyle: 'bold', lineColor: [148, 163, 184], lineWidth: 0.3 },
    bodyStyles: { textColor: [30, 41, 59], fontSize: 8.5, lineColor: [203, 213, 225], lineWidth: 0.2, cellPadding: 3 },
    columnStyles: { 0: { fontStyle: 'bold', cellWidth: 65 }, 1: { halign: 'right' }, 2: { halign: 'right' }, 3: { halign: 'center' }, 4: { halign: 'center' }, 5: { halign: 'right' } },
    margin: { left: 14, right: 14 }
  });

  currentY = (doc.lastAutoTable ? doc.lastAutoTable.finalY : currentY) + 12;
  if (currentY > 230) {
    doc.addPage();
    currentY = 20;
  }

  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(2, 132, 199);
  doc.text('10. Website Traffic – Users by City', 14, currentY);

  const cityRows = (data.websiteTrafficUsersByCity || []).map(item => [
    item.city || '',
    Number(item.activeUsers || 0).toLocaleString(),
    Number(item.newUsers || 0).toLocaleString(),
    Number(item.engagedSessions || 0).toLocaleString(),
    String(item.engagementRate || '0%'),
    String(item.sessionsPerUser ?? 0),
    String(item.avgEngagementTime || '0s')
  ]);

  autoTable(doc, {
    startY: currentY + 4,
    head: [['City', 'Active Users', 'New Users', 'Engaged Sessions', 'Engage Rate', 'Sess/User', 'Avg Time']],
    body: cityRows.length > 0 ? cityRows : [['No city data', '0', '0', '0', '0%', '0', '0s']],
    theme: 'grid',
    headStyles: { fillColor: [224, 242, 254], textColor: [12, 74, 110], fontSize: 8.5, fontStyle: 'bold', lineColor: [148, 163, 184], lineWidth: 0.3 },
    bodyStyles: { textColor: [30, 41, 59], fontSize: 8, lineColor: [203, 213, 225], lineWidth: 0.2, cellPadding: 3 },
    columnStyles: { 0: { fontStyle: 'bold', cellWidth: 45 }, 1: { halign: 'right' }, 2: { halign: 'right' }, 3: { halign: 'right' }, 4: { halign: 'center' }, 5: { halign: 'center' }, 6: { halign: 'center' } },
    margin: { left: 14, right: 14 }
  });

  addDocFooter(doc, clientName, `Website Traffic Report (${monthStr} ${yearStr})`);
  const filename = `Website_Traffic_Report_${clientName.replace(/\s+/g, '_')}_${monthStr}_${yearStr}.pdf`;
  doc.save(filename);
  return filename;
}

/**
 * Combined PDF: Social Media Post Insights Report (3.12 Post Insights + 3.14 YouTube Report)
 */
export function generateSocialMediaInsightsCombinedPDF(data = {}, clientInfo = {}) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const monthStr = data.month ? monthNames[data.month - 1] : dayjs().format('MMMM');
  const yearStr = data.year || dayjs().format('YYYY');
  const clientName = clientInfo.companyName || clientInfo.name || 'Client';

  addDocHeader(
    doc, 
    clientName, 
    `Social Media Post Insights Report (${monthStr} ${yearStr})`, 
    `Purpose: Track content published across social media channels and YouTube performance.`
  );

  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(236, 72, 153);
  doc.text('3.12 Social Media Post Insights', 14, 44);

  const videoCount = data.socialMediaPostInsights?.videoCount ?? data.brandCommunicationDesign?.videosCount ?? 0;
  const postCount = data.socialMediaPostInsights?.postCount ?? data.brandCommunicationDesign?.socialMediaPostDesignsCount ?? 0;
  const totalCount = data.socialMediaPostInsights?.totalCount ?? (videoCount + postCount);

  autoTable(doc, {
    startY: 48,
    head: [['Field / Type of Post', 'Requirement / Number Published']],
    body: [
      ['Video', String(videoCount)],
      ['Post', String(postCount)],
      ['Total Content Published', String(totalCount)]
    ],
    theme: 'grid',
    headStyles: { fillColor: [252, 231, 243], textColor: [131, 24, 67], fontSize: 9.5, fontStyle: 'bold', lineColor: [249, 168, 212], lineWidth: 0.3 },
    bodyStyles: { textColor: [30, 41, 59], fontSize: 9, lineColor: [203, 213, 225], lineWidth: 0.2, cellPadding: 4 },
    columnStyles: { 0: { fontStyle: 'bold', cellWidth: 90 }, 1: { halign: 'center' } },
    margin: { left: 14, right: 14 }
  });

  let currentY = (doc.lastAutoTable ? doc.lastAutoTable.finalY : 48) + 12;

  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(239, 68, 68);
  doc.text('3.14 YouTube Report', 14, currentY);

  const ytItem = Array.isArray(data.youTubeReport) && data.youTubeReport.length > 0 
    ? data.youTubeReport[0] 
    : (data.youTubeReport || {});
  const repMonth = ytItem.month || `${monthStr} ${yearStr}`;
  const views = ytItem.views ?? 0;
  const lastMonthSubs = ytItem.lastMonthSubscribers ?? 0;
  const totalSubs = ytItem.totalSubscribers ?? 0;

  autoTable(doc, {
    startY: currentY + 4,
    head: [['Field', 'Requirement']],
    body: [
      ['Month', String(repMonth)],
      ['Views', typeof views === 'number' ? views.toLocaleString() : String(views)],
      ['Last Month Subscribers', typeof lastMonthSubs === 'number' ? lastMonthSubs.toLocaleString() : String(lastMonthSubs)],
      ['Total Subscribers', typeof totalSubs === 'number' ? totalSubs.toLocaleString() : String(totalSubs)]
    ],
    theme: 'grid',
    headStyles: { fillColor: [254, 226, 226], textColor: [153, 27, 27], fontSize: 9.5, fontStyle: 'bold', lineColor: [252, 165, 165], lineWidth: 0.3 },
    bodyStyles: { textColor: [30, 41, 59], fontSize: 9, lineColor: [203, 213, 225], lineWidth: 0.2, cellPadding: 4 },
    columnStyles: { 0: { fontStyle: 'bold', cellWidth: 90 }, 1: { halign: 'center' } },
    margin: { left: 14, right: 14 }
  });

  addDocFooter(doc, clientName, `Social Media Post Insights Report (${monthStr} ${yearStr})`);
  const filename = `Social_Media_Post_Insights_${clientName.replace(/\s+/g, '_')}_${monthStr}_${yearStr}.pdf`;
  doc.save(filename);
  return filename;
}

/**
 * Combined PDF: Meta Campaign Report (Lead Campaigns + Reach Campaigns)
 */
export function generateMetaCampaignCombinedPDF(leadReportData = {}, reachReportData = {}, clientInfo = {}) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const clientName = clientInfo.companyName || clientInfo.name || leadReportData.clientName || 'Client';

  addDocHeader(
    doc, 
    clientName, 
    `Meta Campaign Report`, 
    `Purpose: Campaign-wise reporting for Meta Lead Campaigns and Meta Reach Campaigns.`
  );

  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(59, 130, 246);
  doc.text('3.6 Meta Campaign Insights – Lead Campaign', 14, 44);

  const leadRows = (leadReportData.campaigns || []).map(c => [
    c.name || c.campaignName || '',
    'Lead',
    c.spend ? `₹${Number(c.spend).toLocaleString()}` : '₹0',
    Number(c.leads || 0).toLocaleString(),
    c.cpl ? `₹${Number(c.cpl).toFixed(2)}` : '₹0'
  ]);

  autoTable(doc, {
    startY: 48,
    head: [['Campaign Name', 'Type', 'Amount Spent', 'No. of Leads', 'CPL']],
    body: leadRows.length > 0 ? leadRows : [['No lead campaign data', 'Lead', '₹0', '0', '₹0']],
    theme: 'grid',
    headStyles: { fillColor: [224, 242, 254], textColor: [15, 23, 42], fontSize: 9.5, fontStyle: 'bold', lineColor: [148, 163, 184], lineWidth: 0.3 },
    bodyStyles: { textColor: [30, 41, 59], fontSize: 9, lineColor: [203, 213, 225], lineWidth: 0.2, cellPadding: 3.5 },
    columnStyles: { 0: { fontStyle: 'bold', cellWidth: 70 }, 1: { halign: 'center' }, 2: { halign: 'right' }, 3: { halign: 'right' }, 4: { halign: 'right' } },
    margin: { left: 14, right: 14 }
  });

  let currentY = (doc.lastAutoTable ? doc.lastAutoTable.finalY : 48) + 12;

  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(236, 72, 153);
  doc.text('3.7 Meta Campaign Insights – Reach Campaign', 14, currentY);

  const reachRows = (reachReportData.campaigns || []).map(c => [
    c.name || c.campaignName || '',
    'Reach',
    c.spend ? `₹${Number(c.spend).toLocaleString()}` : '₹0',
    Number(c.views || c.impressions || 0).toLocaleString(),
    Number(c.reach || 0).toLocaleString(),
    Number(c.followersGained || 0).toLocaleString()
  ]);

  autoTable(doc, {
    startY: currentY + 4,
    head: [['Campaign Name', 'Type', 'Amount Spent', 'Views', 'Reach', 'Followers Gained']],
    body: reachRows.length > 0 ? reachRows : [['No reach campaign data', 'Reach', '₹0', '0', '0', '0']],
    theme: 'grid',
    headStyles: { fillColor: [252, 231, 243], textColor: [131, 24, 67], fontSize: 9.5, fontStyle: 'bold', lineColor: [249, 168, 212], lineWidth: 0.3 },
    bodyStyles: { textColor: [30, 41, 59], fontSize: 9, lineColor: [203, 213, 225], lineWidth: 0.2, cellPadding: 3.5 },
    columnStyles: { 0: { fontStyle: 'bold', cellWidth: 60 }, 1: { halign: 'center' }, 2: { halign: 'right' }, 3: { halign: 'right' }, 4: { halign: 'right' }, 5: { halign: 'right' } },
    margin: { left: 14, right: 14 }
  });

  addDocFooter(doc, clientName, `Meta Campaign Report`);
  const filename = `Meta_Campaign_Report_${clientName.replace(/\s+/g, '_')}.pdf`;
  doc.save(filename);
  return filename;
}

/**
 * Main router helper for monthly highlights PDF generation
 */
export function generateMonthlyHighlightsPDF(data = {}, clientInfo = {}, reportType = 'all') {
  if (reportType === 'Keywords' || reportType === '2. Keywords' || reportType?.includes('Keyword')) return generateKeywordsCombinedPDF(data, clientInfo);
  if (reportType === 'Meta Insights' || reportType === '4. Meta Insights' || reportType?.includes('Meta Insights')) return generateMetaInsightsCombinedPDF(data, clientInfo);
  if (reportType === 'Website Traffic' || reportType === '5. Website Traffic' || reportType?.includes('Website Traffic')) return generateWebsiteTrafficCombinedPDF(data, clientInfo);
  if (reportType === 'Social Media Post Insights' || reportType === '6. Social Media Post Insights' || reportType?.includes('Social Media')) return generateSocialMediaInsightsCombinedPDF(data, clientInfo);

  // Individual legacy fallbacks
  if (reportType === 'Keyword Ranking Overview') return generateKeywordRankingOverviewPDF(data, clientInfo);
  if (reportType === 'Keyword Ranking Details') return generateKeywordRankingDetailsPDF(data, clientInfo);
  if (reportType === 'Meta Insights – Facebook') return generateMetaInsightsFacebookPDF(data, clientInfo);
  if (reportType === 'Meta Insights – Instagram') return generateMetaInsightsInstagramPDF(data, clientInfo);
  if (reportType === 'Website Traffic – Overview' || reportType === 'Website Traffic Overview') return generateWebsiteTrafficOverviewPDF(data, clientInfo);
  if (reportType === 'Website Traffic – Landing Page Views' || reportType === 'Website Traffic Landing Page Views') return generateWebsiteTrafficLandingPagesPDF(data, clientInfo);
  if (reportType === 'Website Traffic – Users by City' || reportType === 'Website Traffic Users by City') return generateWebsiteTrafficUsersByCityPDF(data, clientInfo);
  if (reportType === 'YouTube Report' || reportType === '3.14 YouTube Report') return generateYouTubeReportPDF(data, clientInfo);
  
  return generateHighlightsOfTheMonthPDF(data, clientInfo);
}
