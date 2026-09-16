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
 * Legacy router helper for backwards compatibility
 */
export function generateMonthlyHighlightsPDF(data = {}, clientInfo = {}, reportType = 'all') {
  if (reportType === 'Keyword Ranking Overview') return generateKeywordRankingOverviewPDF(data, clientInfo);
  if (reportType === 'Keyword Ranking Details') return generateKeywordRankingDetailsPDF(data, clientInfo);
  if (reportType === 'Meta Insights – Facebook') return generateMetaInsightsFacebookPDF(data, clientInfo);
  if (reportType === 'Meta Insights – Instagram') return generateMetaInsightsInstagramPDF(data, clientInfo);
  return generateHighlightsOfTheMonthPDF(data, clientInfo);
}
