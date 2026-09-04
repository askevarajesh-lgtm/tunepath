import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import dayjs from 'dayjs';

/**
 * Extracts form name from customData or lead object
 */
const getFormName = (lead) => {
  return lead?.customData?.form_name || lead?.customData?.formName || lead?.formName || 'Direct / General';
};

/**
 * Extracts creation date from customData or lead object
 */
const getActualLeadDate = (lead) => {
  const customDate = lead?.customData?.created_time || lead?.customData?.createdTime || lead?.customData?.createdtime;
  if (customDate) {
    return dayjs(customDate);
  }
  return dayjs(lead?.createdAt);
};

/**
 * Format numbers cleanly (e.g. 10.5K or 1,250)
 */
const formatNumber = (num) => {
  if (!num && num !== 0) return '0';
  if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
  if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
  return Number(num).toLocaleString();
};

/**
 * Format percentage change string with sign
 */
const formatGrowth = (curr, prev) => {
  if (!prev && !curr) return '0%';
  if (!prev) return '+100%';
  const diff = ((curr - prev) / prev) * 100;
  const sign = diff > 0 ? '+' : '';
  return `${sign}${diff.toFixed(1)}%`;
};

/**
 * Generates and downloads a Month-on-Month Leads Performance PDF Report.
 * @param {Array} leads - Full array of lead objects
 * @param {Object} options - { selectedMonth, clientName, agencyName, reportTitle }
 */
export function generateLeadReportPDF(leads = [], options = {}) {
  const targetMonth = options.selectedMonth ? dayjs(options.selectedMonth) : dayjs();
  const prevMonth = targetMonth.subtract(1, 'month');

  const currMonthName = targetMonth.format('MMMM YYYY');
  const prevMonthName = prevMonth.format('MMMM YYYY');
  const clientName = options.clientName || options.companyName || 'All Clients';
  const agencyName = options.agencyName || 'Agency Growth OS';

  // --- FILTER LEADS FOR MONTHS ---
  const currMonthLeads = leads.filter(l => {
    const d = getActualLeadDate(l);
    return d.isAfter(targetMonth.startOf('month')) && d.isBefore(targetMonth.endOf('month'));
  });

  const prevMonthLeads = leads.filter(l => {
    const d = getActualLeadDate(l);
    return d.isAfter(prevMonth.startOf('month')) && d.isBefore(prevMonth.endOf('month'));
  });

  // Calculate metrics helper
  const calcMetrics = (leadArr) => {
    let newL = 0, activeL = 0, assignedL = 0, convertedL = 0, followUp = 0;
    let contactReady = 0, phoneAdded = 0, emailAdded = 0;

    leadArr.forEach(l => {
      const status = (l.status || '').toLowerCase();
      if (status === 'new') newL++;
      if (['contacted', 'in_progress', 'follow_up'].includes(status)) activeL++;
      if (status === 'converted') convertedL++;
      if (status === 'follow_up') followUp++;

      if (l.assignedTo) assignedL++;
      if (l.phoneNumber || l.email) contactReady++;
      if (l.phoneNumber) phoneAdded++;
      if (l.email) emailAdded++;
    });

    const total = leadArr.length;
    return {
      total,
      newLeads: newL,
      activeLeads: activeL,
      assignedLeads: assignedL,
      convertedLeads: convertedL,
      followUpLeads: followUp,
      contactReadyLeads: contactReady,
      phoneAddedLeads: phoneAdded,
      emailAddedLeads: emailAdded,
      conversionRate: total ? Math.round((convertedL / total) * 100) : 0,
      assignedRate: total ? Math.round((assignedL / total) * 100) : 0,
      contactReadyRate: total ? Math.round((contactReady / total) * 100) : 0
    };
  };

  const currMetrics = calcMetrics(currMonthLeads);
  const prevMetrics = calcMetrics(prevMonthLeads);

  // Initialize PDF
  const pdf = new jsPDF({
    orientation: 'p',
    unit: 'mm',
    format: 'a4',
  });

  const primaryColor = [22, 119, 255];   // Vibrant Blue #1677FF
  const secondaryColor = [16, 185, 129]; // Emerald Green
  const accentPurple = [139, 92, 246];   // Purple
  const headerBgColor = [240, 245, 255];
  const textColor = [31, 41, 55];
  const lightTextColor = [107, 114, 128];

  const addPageHeader = (title) => {
    pdf.setFillColor(250, 250, 250);
    pdf.rect(0, 0, 210, 30, 'F');
    pdf.setTextColor(...primaryColor);
    pdf.setFontSize(22);
    pdf.setFont('helvetica', 'bold');
    pdf.text(title, 14, 20);
    pdf.setDrawColor(...primaryColor);
    pdf.setLineWidth(1);
    pdf.line(14, 25, 196, 25);
  };

  const addPageFooter = (pageNum, totalPages = 6) => {
    pdf.setFontSize(9);
    pdf.setFont('helvetica', 'normal');
    pdf.setTextColor(...lightTextColor);
    pdf.text(`${agencyName} • Leads Intelligence Report`, 14, 287);
    pdf.text(`Page ${pageNum} of ${totalPages}`, 196, 287, { align: 'right' });
  };

  // ==========================================
  // --- PAGE 1: COVER PAGE ---
  // ==========================================
  pdf.setFillColor(...primaryColor);
  pdf.rect(0, 0, 210, 297, 'F');

  pdf.setTextColor(255, 255, 255);
  pdf.setFontSize(44);
  pdf.setFont('helvetica', 'bold');
  pdf.text('Leads Performance', 20, 95);
  pdf.text('Report', 20, 115);

  pdf.setFontSize(15);
  pdf.setFont('helvetica', 'normal');
  pdf.text('Month-on-Month Intelligence & Pipeline Analysis', 20, 135);

  // Divider Line
  pdf.setDrawColor(255, 255, 255);
  pdf.setLineWidth(0.8);
  pdf.line(20, 145, 190, 145);

  // Metadata Card
  pdf.setFontSize(14);
  pdf.setFont('helvetica', 'bold');
  pdf.text(`Comprehensive Analysis for:`, 20, 160);
  pdf.setFontSize(22);
  pdf.text(`${clientName}`, 20, 172);

  pdf.setFontSize(12);
  pdf.setFont('helvetica', 'normal');
  pdf.text(`Reporting Period: ${currMonthName} (vs ${prevMonthName})`, 20, 190);

  pdf.setFontSize(13);
  pdf.setFont('helvetica', 'normal');
  pdf.text(`Generated on: ${dayjs().format('MMMM D, YYYY')}`, 20, 265);
  pdf.text(`${agencyName}`, 190, 265, { align: 'right' });
  pdf.setFontSize(10);
  pdf.text('Page 1 of 6', 190, 275, { align: 'right' });

  // ==========================================
  // --- PAGE 2: EXECUTIVE SUMMARY & MOM KPIS ---
  // ==========================================
  pdf.addPage();
  addPageHeader('Executive Summary & MoM KPIs');
  let nextY = 38;

  pdf.setTextColor(...textColor);
  pdf.setFontSize(11);
  pdf.setFont('helvetica', 'normal');
  pdf.text('High-level overview of total lead volume, conversions, and Month-on-Month performance metrics.', 14, nextY);
  nextY += 12;

  // KPI Scorecards Table
  const momConvDiff = currMetrics.conversionRate - prevMetrics.conversionRate;
  const momConvStr = `${momConvDiff >= 0 ? '+' : ''}${momConvDiff}% pts`;

  autoTable(pdf, {
    startY: nextY,
    head: [['Metric', `Current Month (${targetMonth.format('MMM')})`, `Prev Month (${prevMonth.format('MMM')})`, 'MoM Change']],
    body: [
      ['Total Leads', formatNumber(currMetrics.total), formatNumber(prevMetrics.total), formatGrowth(currMetrics.total, prevMetrics.total)],
      ['New Leads', formatNumber(currMetrics.newLeads), formatNumber(prevMetrics.newLeads), formatGrowth(currMetrics.newLeads, prevMetrics.newLeads)],
      ['Active Leads', formatNumber(currMetrics.activeLeads), formatNumber(prevMetrics.activeLeads), formatGrowth(currMetrics.activeLeads, prevMetrics.activeLeads)],
      ['Converted Leads', formatNumber(currMetrics.convertedLeads), formatNumber(prevMetrics.convertedLeads), formatGrowth(currMetrics.convertedLeads, prevMetrics.convertedLeads)],
      ['Conversion Rate', `${currMetrics.conversionRate}%`, `${prevMetrics.conversionRate}%`, momConvStr]
    ],
    theme: 'grid',
    headStyles: { fillColor: primaryColor, textColor: 255, halign: 'center', fontSize: 11, fontStyle: 'bold' },
    bodyStyles: { halign: 'center', fontSize: 11, textColor: textColor },
    columnStyles: { 0: { halign: 'left', fontStyle: 'bold' } },
    margin: { left: 14, right: 14 }
  });

  nextY = pdf.lastAutoTable.finalY + 16;

  // Lead Status Comparison
  pdf.setFontSize(14);
  pdf.setFont('helvetica', 'bold');
  pdf.text('Lead Status Distribution', 14, nextY);
  nextY += 8;

  autoTable(pdf, {
    startY: nextY,
    head: [['Status Category', 'Current Month Count', 'Prev Month Count', 'MoM Delta']],
    body: [
      ['New Leads', currMetrics.newLeads, prevMetrics.newLeads, formatGrowth(currMetrics.newLeads, prevMetrics.newLeads)],
      ['Active / In Progress', currMetrics.activeLeads, prevMetrics.activeLeads, formatGrowth(currMetrics.activeLeads, prevMetrics.activeLeads)],
      ['Follow-up Needed', currMetrics.followUpLeads, prevMetrics.followUpLeads, formatGrowth(currMetrics.followUpLeads, prevMetrics.followUpLeads)],
      ['Successfully Converted', currMetrics.convertedLeads, prevMetrics.convertedLeads, formatGrowth(currMetrics.convertedLeads, prevMetrics.convertedLeads)],
    ],
    theme: 'grid',
    headStyles: { fillColor: headerBgColor, textColor: textColor, halign: 'center', fontSize: 10, fontStyle: 'bold' },
    bodyStyles: { halign: 'center', fontSize: 10, textColor: textColor },
    columnStyles: { 0: { halign: 'left' } }
  });

  nextY = pdf.lastAutoTable.finalY + 16;

  // Management Health & Contact Readiness
  pdf.setFontSize(14);
  pdf.setFont('helvetica', 'bold');
  pdf.text('Lead Management Health & Contact Readiness', 14, nextY);
  nextY += 8;

  autoTable(pdf, {
    startY: nextY,
    head: [['Health Indicator', 'Count', 'Coverage Rate %', 'Status']],
    body: [
      ['Assigned Leads', currMetrics.assignedLeads, `${currMetrics.assignedRate}%`, currMetrics.assignedRate >= 80 ? 'Optimal' : 'Needs Assignment'],
      ['Contact Ready (Email or Phone)', currMetrics.contactReadyLeads, `${currMetrics.contactReadyRate}%`, currMetrics.contactReadyRate >= 90 ? 'Excellent' : 'Fair'],
      ['Phone Number Captured', currMetrics.phoneAddedLeads, `${currMetrics.total ? Math.round((currMetrics.phoneAddedLeads / currMetrics.total)*100) : 0}%`, 'Captured'],
      ['Email Address Captured', currMetrics.emailAddedLeads, `${currMetrics.total ? Math.round((currMetrics.emailAddedLeads / currMetrics.total)*100) : 0}%`, 'Captured']
    ],
    theme: 'grid',
    headStyles: { fillColor: headerBgColor, textColor: textColor, halign: 'center', fontSize: 10, fontStyle: 'bold' },
    bodyStyles: { halign: 'center', fontSize: 10, textColor: textColor },
    columnStyles: { 0: { halign: 'left' } }
  });

  addPageFooter(2);

  // ==========================================
  // --- PAGE 3: LEAD SOURCES & CAMPAIGNS ---
  // ==========================================
  pdf.addPage();
  addPageHeader('Lead Sources & Channel Acquisition');
  nextY = 38;

  pdf.setTextColor(...textColor);
  pdf.setFontSize(11);
  pdf.setFont('helvetica', 'normal');
  pdf.text('Channel breakdown showing lead acquisition sources, form submissions, and source conversion efficiency.', 14, nextY);
  nextY += 12;

  // Source breakdown aggregation
  const getSourceStats = (leadArr) => {
    const map = {};
    leadArr.forEach(l => {
      const src = l.source || 'Unknown / Direct';
      if (!map[src]) map[src] = { count: 0, converted: 0 };
      map[src].count++;
      if ((l.status || '').toLowerCase() === 'converted') map[src].converted++;
    });
    return map;
  };

  const currSources = getSourceStats(currMonthLeads);
  const prevSources = getSourceStats(prevMonthLeads);
  const allSourceNames = Array.from(new Set([...Object.keys(currSources), ...Object.keys(prevSources)]));

  const sourceRows = allSourceNames.map(src => {
    const cCount = currSources[src]?.count || 0;
    const pCount = prevSources[src]?.count || 0;
    const cConv = currSources[src]?.converted || 0;
    const convRate = cCount ? Math.round((cConv / cCount) * 100) : 0;
    const growth = formatGrowth(cCount, pCount);

    return [src, cCount, pCount, cConv, `${convRate}%`, growth];
  });

  pdf.setFontSize(14);
  pdf.setFont('helvetica', 'bold');
  pdf.text('Lead Sources Performance Breakdown', 14, nextY);
  nextY += 8;

  autoTable(pdf, {
    startY: nextY,
    head: [['Channel / Source', `Curr Month (${targetMonth.format('MMM')})`, `Prev Month (${prevMonth.format('MMM')})`, 'Converted', 'Conv. Rate %', 'MoM Growth']],
    body: sourceRows.length ? sourceRows : [['No lead sources recorded', '-', '-', '-', '-', '-']],
    theme: 'striped',
    headStyles: { fillColor: primaryColor, textColor: 255, fontSize: 10 },
    styles: { fontSize: 10, textColor: textColor },
    columnStyles: { 0: { fontStyle: 'bold' } },
    alternateRowStyles: { fillColor: [249, 250, 251] }
  });

  nextY = pdf.lastAutoTable.finalY + 16;

  // Form Performance breakdown
  const formMap = {};
  currMonthLeads.forEach(l => {
    const fname = getFormName(l);
    if (!formMap[fname]) formMap[fname] = { count: 0, converted: 0 };
    formMap[fname].count++;
    if ((l.status || '').toLowerCase() === 'converted') formMap[fname].converted++;
  });

  const formRows = Object.entries(formMap).map(([fname, data]) => {
    const convRate = data.count ? Math.round((data.converted / data.count) * 100) : 0;
    return [fname, data.count, data.converted, `${convRate}%`];
  }).sort((a,b) => b[1] - a[1]).slice(0, 10);

  pdf.setFontSize(14);
  pdf.setFont('helvetica', 'bold');
  pdf.text('Top Lead Forms / Campaign Submissions', 14, nextY);
  nextY += 8;

  autoTable(pdf, {
    startY: nextY,
    head: [['Form / Campaign Name', 'Submissions', 'Converted', 'Conversion Rate %']],
    body: formRows.length ? formRows : [['No specific form data', '-', '-', '-']],
    theme: 'grid',
    headStyles: { fillColor: accentPurple, textColor: 255, fontSize: 10 },
    styles: { fontSize: 10, textColor: textColor },
    columnStyles: { 0: { fontStyle: 'bold' } }
  });

  addPageFooter(3);

  // ==========================================
  // --- PAGE 4: TEAM PERFORMANCE & WORKLOAD ---
  // ==========================================
  pdf.addPage();
  addPageHeader('Team Performance & Lead Workload');
  nextY = 38;

  pdf.setTextColor(...textColor);
  pdf.setFontSize(11);
  pdf.setFont('helvetica', 'normal');
  pdf.text('Lead allocation, response tracking, and conversion performance per team member.', 14, nextY);
  nextY += 12;

  const ownerMap = {};
  currMonthLeads.forEach(l => {
    const owner = l.assignedTo || 'Unassigned';
    if (!ownerMap[owner]) {
      ownerMap[owner] = { total: 0, newL: 0, activeL: 0, followUp: 0, converted: 0, contactReady: 0 };
    }
    ownerMap[owner].total++;
    const status = (l.status || '').toLowerCase();
    if (status === 'new') ownerMap[owner].newL++;
    if (['contacted', 'in_progress', 'follow_up'].includes(status)) ownerMap[owner].activeL++;
    if (status === 'follow_up') ownerMap[owner].followUp++;
    if (status === 'converted') ownerMap[owner].converted++;
    if (l.phoneNumber || l.email) ownerMap[owner].contactReady++;
  });

  const ownerRows = Object.entries(ownerMap).map(([owner, data]) => {
    const crRate = data.total ? Math.round((data.contactReady / data.total) * 100) : 0;
    const convRate = data.total ? Math.round((data.converted / data.total) * 100) : 0;
    return [owner, data.total, data.newL, data.activeL, data.followUp, `${crRate}%`, `${convRate}%`];
  }).sort((a,b) => b[1] - a[1]);

  autoTable(pdf, {
    startY: nextY,
    head: [['Owner / Team Member', 'Assigned', 'New', 'Active', 'Follow Up', 'Contact Ready %', 'Conv. Rate %']],
    body: ownerRows.length ? ownerRows : [['No team data', 0, 0, 0, 0, '0%', '0%']],
    theme: 'grid',
    headStyles: { fillColor: secondaryColor, textColor: 255, fontSize: 10, fontStyle: 'bold' },
    styles: { fontSize: 10, textColor: textColor, halign: 'center' },
    columnStyles: { 0: { halign: 'left', fontStyle: 'bold' } }
  });

  nextY = pdf.lastAutoTable.finalY + 16;

  // Workload Insights
  pdf.setFontSize(14);
  pdf.setFont('helvetica', 'bold');
  pdf.text('Workload & Operational Highlights', 14, nextY);
  nextY += 10;

  const topOwner = ownerRows[0] ? ownerRows[0][0] : 'N/A';
  const unassignedCount = ownerMap['Unassigned']?.total || 0;

  pdf.setFontSize(10);
  pdf.setFont('helvetica', 'normal');
  pdf.text(`• Top Performing Lead Owner: ${topOwner}`, 18, nextY);
  nextY += 6;
  pdf.text(`• Unassigned Leads Pending Review: ${unassignedCount} lead(s)`, 18, nextY);
  nextY += 6;
  pdf.text(`• Average Team Lead Contact Readiness: ${currMetrics.contactReadyRate}%`, 18, nextY);

  addPageFooter(4);

  // ==========================================
  // --- PAGE 5: HISTORICAL MOM TREND ---
  // ==========================================
  pdf.addPage();
  addPageHeader('Historical Month-on-Month Trend');
  nextY = 38;

  pdf.setTextColor(...textColor);
  pdf.setFontSize(11);
  pdf.setFont('helvetica', 'normal');
  pdf.text('6-Month historical analysis tracking overall lead volume, pipeline velocity, and conversion progression.', 14, nextY);
  nextY += 12;

  // Generate 6 Month Trend Data
  const trendMonths = [];
  for (let i = 5; i >= 0; i--) {
    const mDate = targetMonth.subtract(i, 'month');
    const mLeads = leads.filter(l => {
      const d = getActualLeadDate(l);
      return d.isAfter(mDate.startOf('month')) && d.isBefore(mDate.endOf('month'));
    });
    const mMetrics = calcMetrics(mLeads);
    trendMonths.push({
      monthLabel: mDate.format('MMM YYYY'),
      total: mMetrics.total,
      newLeads: mMetrics.newLeads,
      activeLeads: mMetrics.activeLeads,
      converted: mMetrics.convertedLeads,
      convRate: mMetrics.conversionRate
    });
  }

  const trendRows = trendMonths.map((m, idx) => {
    const prev = idx > 0 ? trendMonths[idx - 1].total : null;
    const growth = prev !== null ? formatGrowth(m.total, prev) : '-';
    return [m.monthLabel, formatNumber(m.total), formatNumber(m.newLeads), formatNumber(m.activeLeads), formatNumber(m.converted), `${m.convRate}%`, growth];
  });

  autoTable(pdf, {
    startY: nextY,
    head: [['Month', 'Total Leads', 'New Leads', 'Active Leads', 'Converted', 'Conv. Rate %', 'MoM Growth']],
    body: trendRows,
    theme: 'striped',
    headStyles: { fillColor: primaryColor, textColor: 255, fontSize: 10, fontStyle: 'bold' },
    styles: { fontSize: 10, textColor: textColor, halign: 'center' },
    columnStyles: { 0: { halign: 'left', fontStyle: 'bold' } },
    alternateRowStyles: { fillColor: [249, 250, 251] }
  });

  nextY = pdf.lastAutoTable.finalY + 16;

  // Summary Commentary Box
  pdf.setFillColor(239, 246, 255); // light blue box
  pdf.setDrawColor(191, 219, 254);
  pdf.roundedRect(14, nextY, 182, 35, 2, 2, 'FD');

  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(11);
  pdf.setTextColor(30, 58, 138);
  pdf.text('Strategic Recommendation & Summary', 18, nextY + 8);

  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(9.5);
  pdf.setTextColor(51, 65, 85);
  const commentaryText = `During ${currMonthName}, total lead volume reached ${currMetrics.total} leads with a ${currMetrics.conversionRate}% conversion rate. To maximize client ROI, ensure unassigned leads (${unassignedCount}) are immediately delegated and prioritize high-converting channels (${allSourceNames[0] || 'Meta Ads'}).`;
  const splitText = pdf.splitTextToSize(commentaryText, 174);
  pdf.text(splitText, 18, nextY + 16);

  addPageFooter(5);

  // ==========================================
  // --- PAGE 6: RECENT LEADS AUDIT LOG ---
  // ==========================================
  pdf.addPage();
  addPageHeader('Recent Lead Log Audit');
  nextY = 38;

  pdf.setTextColor(...textColor);
  pdf.setFontSize(11);
  pdf.setFont('helvetica', 'normal');
  pdf.text(`Detailed record of recent leads captured during ${currMonthName}.`, 14, nextY);
  nextY += 12;

  const topRecentLeads = currMonthLeads
    .sort((a, b) => getActualLeadDate(b).valueOf() - getActualLeadDate(a).valueOf())
    .slice(0, 22)
    .map(l => [
      getActualLeadDate(l).format('DD MMM YYYY'),
      l.fullName || l.companyName || 'Lead #' + String(l._id || '').substring(0, 5),
      l.phoneNumber || l.email || '-',
      l.source || 'Direct',
      (l.status || 'new').toUpperCase(),
      l.assignedTo || 'Unassigned'
    ]);

  autoTable(pdf, {
    startY: nextY,
    head: [['Date', 'Lead Name', 'Contact Info', 'Source', 'Status', 'Owner']],
    body: topRecentLeads.length ? topRecentLeads : [['No leads recorded in this period', '-', '-', '-', '-', '-']],
    theme: 'grid',
    headStyles: { fillColor: [15, 23, 42], textColor: 255, fontSize: 9, fontStyle: 'bold' },
    styles: { fontSize: 8.5, textColor: textColor },
    columnStyles: { 0: { cellWidth: 26 }, 1: { fontStyle: 'bold', cellWidth: 38 }, 2: { cellWidth: 38 } }
  });

  addPageFooter(6);

  // Download PDF
  const filename = `Leads_Performance_Report_${clientName.replace(/\s+/g, '_')}_${targetMonth.format('MMM_YYYY')}.pdf`;
  pdf.save(filename);
  return filename;
}
