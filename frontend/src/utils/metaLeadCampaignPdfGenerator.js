import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import dayjs from 'dayjs';

/**
 * Generates PDF report for "3.6 Meta Campaign Insights – Lead Campaign"
 */
export function generateMetaLeadCampaignPDF(reportData = {}, clientInfo = {}) {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  const clientName = clientInfo.companyName || clientInfo.name || reportData.clientName || 'Client';
  const reportDateStr = dayjs().format('MMMM D, YYYY');

  // Title Section
  doc.setTextColor(30, 41, 59);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.text(`${clientName} - Meta Ads Report`, 14, 20);

  doc.setFontSize(14);
  doc.setTextColor(59, 130, 246);
  doc.text(`3.6 Meta Campaign Insights – Lead Campaign`, 14, 30);

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 116, 139);
  doc.text(`Purpose: Simple campaign-wise reporting for Lead campaigns. Keep this report limited to the fields below.`, 14, 37);

  // Field Requirements Specification Table
  autoTable(doc, {
    startY: 44,
    head: [['Field', 'Requirement']],
    body: [
      ['Campaign Name', 'Name of campaign'],
      ['Type of Campaign', 'Lead'],
      ['Amount Spent', 'Campaign spend'],
      ['No. of Leads', 'Leads generated'],
      ['CPL', 'Cost per lead']
    ],
    theme: 'grid',
    headStyles: {
      fillColor: [224, 242, 254], // Light blue header
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
      cellPadding: 4
    },
    columnStyles: {
      0: { fontStyle: 'bold', cellWidth: 60 },
      1: { cellWidth: 122 }
    },
    margin: { left: 14, right: 14 }
  });

  // Section: Real Meta Lead Campaigns Data Table
  let nextY = doc.lastAutoTable ? doc.lastAutoTable.finalY + 12 : 90;

  doc.setFontSize(13);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(30, 41, 59);
  doc.text(`Connected Meta Lead Campaigns`, 14, nextY);

  const campaigns = Array.isArray(reportData.campaigns) ? reportData.campaigns : [];
  const tableRows = campaigns.length > 0
    ? campaigns.map(c => [
        c.campaignName || c.campaign || 'Meta Campaign',
        c.typeOfCampaign || 'Lead',
        c.amountSpent || (typeof c.spend === 'number' ? `₹${c.spend.toLocaleString('en-IN')}` : (c.spend || '₹0')),
        String(c.noOfLeads ?? c.leads ?? 0),
        c.cpl || (typeof c.cpl === 'number' ? `₹${c.cpl}` : (c.cpl || '₹0'))
      ])
    : [
        ['No active Meta Lead campaigns connected in Performance Ads', 'Lead', '₹0', '0', '₹0']
      ];

  autoTable(doc, {
    startY: nextY + 6,
    head: [['Campaign Name', 'Type of Campaign', 'Amount Spent', 'No. of Leads', 'CPL']],
    body: tableRows,
    theme: 'grid',
    headStyles: {
      fillColor: [15, 23, 42], // Sleek dark header
      textColor: [255, 255, 255],
      fontSize: 9.5,
      fontStyle: 'bold',
      lineColor: [51, 65, 85],
      lineWidth: 0.3
    },
    bodyStyles: {
      textColor: [30, 41, 59],
      fontSize: 9,
      lineColor: [203, 213, 225],
      lineWidth: 0.2,
      cellPadding: 5
    },
    columnStyles: {
      0: { fontStyle: 'bold', cellWidth: 65 },
      1: { cellWidth: 32, halign: 'center' },
      2: { cellWidth: 30, halign: 'right' },
      3: { cellWidth: 25, halign: 'right' },
      4: { cellWidth: 30, halign: 'right' }
    },
    margin: { left: 14, right: 14 }
  });

  // Summary Metrics Section
  nextY = doc.lastAutoTable ? doc.lastAutoTable.finalY + 10 : 160;
  if (nextY > 230) {
    doc.addPage();
    nextY = 20;
  }

  const summary = reportData.summary || {};
  const totalSpent = summary.totalAmountSpent || '₹0';
  const totalLeads = summary.totalLeads ?? 0;
  const avgCpl = summary.avgCpl || '₹0';

  autoTable(doc, {
    startY: nextY,
    head: [['Metric Summary', 'Value']],
    body: [
      ['Total Amount Spent across Meta Lead Campaigns', totalSpent],
      ['Total Leads Generated', String(totalLeads)],
      ['Blended Cost Per Lead (CPL)', avgCpl]
    ],
    theme: 'plain',
    headStyles: {
      fillColor: [241, 245, 249],
      textColor: [15, 23, 42],
      fontSize: 9.5,
      fontStyle: 'bold'
    },
    bodyStyles: {
      textColor: [30, 41, 59],
      fontSize: 9,
      cellPadding: 4
    },
    columnStyles: {
      0: { fontStyle: 'bold', cellWidth: 120 },
      1: { cellWidth: 62, halign: 'right', fontStyle: 'bold' }
    },
    margin: { left: 14, right: 14 }
  });

  // Footer
  const pageCount = doc.internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(148, 163, 184);
    doc.text(`Performance Ads Report – ${clientName} (${reportDateStr})`, 14, 287);
    doc.text(`Page ${i} of ${pageCount}`, 196, 287, { align: 'right' });
  }

  const filename = `Meta_Lead_Campaign_Report_${clientName.replace(/\s+/g, '_')}_${dayjs().format('YYYY-MM-DD')}.pdf`;
  doc.save(filename);
  return filename;
}
