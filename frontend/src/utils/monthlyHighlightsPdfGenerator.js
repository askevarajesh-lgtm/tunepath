import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import dayjs from 'dayjs';

/**
 * Generates executive Month-on-Month "3.1 Highlights of the Month" PDF report matching client document specs.
 */
export function generateMonthlyHighlightsPDF(data = {}, clientInfo = {}) {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const monthStr = data.month ? monthNames[data.month - 1] : dayjs().format('MMMM');
  const yearStr = data.year || dayjs().format('YYYY');
  const clientName = clientInfo.companyName || clientInfo.name || 'Client';

  // Digital Insights formatted line
  const digitalInsightsText = [
    `Facebook followers increased: ${data.digitalInsights?.facebookFollowersIncreased ?? 0}`,
    `Total Facebook followers: ${data.digitalInsights?.facebookTotalFollowers ?? 0}`,
    `Facebook reach: ${data.digitalInsights?.facebookReach ?? 0}`,
    `Instagram followers increased: ${data.digitalInsights?.instagramFollowersIncreased ?? 0}`,
    `Total Instagram followers: ${data.digitalInsights?.instagramTotalFollowers ?? 0}`,
    `Instagram reach: ${data.digitalInsights?.instagramReach ?? 0}`
  ].join('; ');

  // Blogs formatted line
  const blogsText = `Number of blog updates: ${data.blogs?.count ?? 0}${data.blogs?.notes ? ` (${data.blogs.notes})` : ''}`;

  // Brand Communication Design formatted line
  const brandCommText = (data.brandCommunicationDesign?.deliverables && data.brandCommunicationDesign.deliverables.length > 0)
    ? data.brandCommunicationDesign.deliverables.map(d => `${d.name} — ${d.completed} / ${d.total} Completed`).join('; ')
    : (data.brandCommunicationDesign?.notes || `Number of social media post designs: ${data.brandCommunicationDesign?.socialMediaPostDesignsCount ?? 0}; Number of videos: ${data.brandCommunicationDesign?.videosCount ?? 0}`);

  // Offline Collaterals
  const offlineText = data.offlineCollaterals || 'Internal branding / collateral work completed';

  // Special Initiatives
  const specialText = data.specialInitiatives || 'Special initiatives completed during the month';

  // Title section
  doc.setTextColor(30, 41, 59);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.text(`${clientName} - Monthly Client Report`, 14, 20);

  doc.setFontSize(14);
  doc.setTextColor(59, 130, 246);
  doc.text(`Highlights of the Month (${monthStr} ${yearStr})`, 14, 30);

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 116, 139);
  doc.text(`Purpose: Provide a short management-level summary of the month's completed digital/marketing activities.`, 14, 37);

  // Table rendering matching client spec header styling
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
    headStyles: {
      fillColor: [224, 242, 254], // Light soft blue header background
      textColor: [15, 23, 42],
      fontSize: 10,
      fontStyle: 'bold',
      lineColor: [148, 163, 184],
      lineWidth: 0.3
    },
    bodyStyles: {
      textColor: [30, 41, 59],
      fontSize: 9.5,
      lineColor: [203, 213, 225],
      lineWidth: 0.2,
      cellPadding: 5
    },
    columnStyles: {
      0: { fontStyle: 'bold', cellWidth: 55 },
      1: { cellWidth: 127 }
    },
    margin: { left: 14, right: 14 }
  });

  // Footer
  const pageCount = doc.internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(148, 163, 184);
    doc.text(`Tunepath Technologies - Month-on-Month Client Report (${monthStr} ${yearStr})`, 14, 287);
    doc.text(`Page ${i} of ${pageCount}`, 196, 287, { align: 'right' });
  }

  const filename = `Highlights_of_the_Month_${clientName.replace(/\s+/g, '_')}_${monthStr}_${yearStr}.pdf`;
  doc.save(filename);
  return filename;
}
