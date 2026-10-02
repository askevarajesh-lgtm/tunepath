import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import dayjs from 'dayjs';

/**
 * Cleanly format trend strings and remove unprintable / garbled characters.
 */
function formatTrendBadge(trend) {
  if (trend === undefined || trend === null || trend === '') return null;
  const str = String(trend).trim().replace(/^[!‘“"'`\s]+/, '');
  const isNegative = str.startsWith('-');
  const isPositive = str.startsWith('+');
  let cleanVal = str;
  if (!isNegative && !isPositive) {
    const num = parseFloat(str);
    if (!isNaN(num) && num > 0) {
      cleanVal = `+${str}`;
    }
  }
  return {
    text: cleanVal,
    isNegative: cleanVal.startsWith('-'),
    isPositive: cleanVal.startsWith('+') && cleanVal !== '+0%' && cleanVal !== '+0.0%'
  };
}

/**
 * Format CTR value cleanly.
 */
function formatCtr(ctrVal, clicks, impressions) {
  if (ctrVal != null && ctrVal !== '' && ctrVal !== '-') {
    const s = String(ctrVal).trim();
    if (s.includes('%')) return s;
    const num = parseFloat(s);
    if (!isNaN(num)) return `${(num <= 1 && num > 0 ? num * 100 : num).toFixed(2)}%`;
  }
  if (impressions && impressions > 0 && clicks != null) {
    return `${((clicks / impressions) * 100).toFixed(2)}%`;
  }
  return '0.00%';
}

/**
 * Helper to draw a section banner across the page width.
 */
function drawSectionBanner(doc, { y, title, subtitle, tag, pageWidth, margin, brandDark, brandPrimary, textDark, textMuted }) {
  const contentWidth = pageWidth - (margin * 2);
  const bannerHeight = subtitle ? 16 : 12;

  // Background card
  doc.setFillColor(241, 245, 249); // slate-100
  doc.setDrawColor(226, 232, 240); // slate-200
  doc.roundedRect(margin, y, contentWidth, bannerHeight, 2, 2, 'FD');

  // Left accent bar
  doc.setFillColor(...brandPrimary);
  doc.rect(margin, y, 3.5, bannerHeight, 'F');

  // Title
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.5);
  doc.setTextColor(...textDark);
  doc.text(title, margin + 8, y + (subtitle ? 6.5 : 8));

  // Tag / Badge on the right
  if (tag) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(...brandPrimary);
    doc.text(tag, pageWidth - margin - 6, y + (subtitle ? 6.5 : 8), { align: 'right' });
  }

  // Subtitle
  if (subtitle) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(...textMuted);
    doc.text(subtitle, margin + 8, y + 12.5);
  }

  return y + bannerHeight + 6;
}

/**
 * Generates a modern, multi-tab comprehensive PDF report for Google Analytics, Search Console Insights, and Performance.
 */
export function generateAnalyticsPdf({
  data = {},
  projectInfo,
  companyName,
  dateRange,
  executiveSummary,
  selectedSections = {}
}) {
  const doc = new jsPDF('p', 'mm', 'a4');
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 14;
  const contentWidth = pageWidth - (margin * 2);

  const headerBrandName = (companyName || 'TUNEPATH').toUpperCase();

  // Premium Color Palette
  const brandDark = [15, 23, 42];        // Slate 900 (#0f172a)
  const brandPrimary = [79, 70, 229];     // Indigo 600 (#4f46e5)
  const brandAccent = [99, 102, 241];     // Indigo 500 (#6366f1)
  const textDark = [30, 41, 59];         // Slate 800 (#1e293b)
  const textMuted = [100, 116, 139];     // Slate 500 (#64748b)
  const bgLight = [248, 250, 252];       // Slate 50 (#f8fafc)
  const cardBorder = [226, 232, 240];    // Slate 200 (#e2e8f0)
  const successGreen = [16, 185, 129];   // Emerald 500 (#10b981)
  const dangerRed = [239, 68, 68];       // Red 500 (#ef4444)

  const dateRangeStr = dateRange
    ? `${dayjs(dateRange[0]).format('MMM D, YYYY')} — ${dayjs(dateRange[1]).format('MMM D, YYYY')}`
    : 'Last 30 Days';

  const projectName = projectInfo?.name || projectInfo?.domain || 'Website Analytics';
  const rawDomain = projectInfo?.domain ? projectInfo.domain.replace(/^https?:\/\//, '').replace(/\/$/, '') : '';

  let currentY = 0;

  // -------------------------------------------------------------
  // HELPER: AutoTable Default Styling
  // -------------------------------------------------------------
  const baseTableHeader = {
    fillColor: brandPrimary,
    textColor: [255, 255, 255],
    fontSize: 8,
    fontStyle: 'bold',
    cellPadding: 2.8
  };

  const baseTableBody = {
    fontSize: 7.5,
    textColor: textDark,
    cellPadding: 2.2
  };

  // -------------------------------------------------------------
  // PAGE 1: COVER META & TAB 1 (ANALYTICS OVERVIEW & KPIS)
  // -------------------------------------------------------------

  // Top Spacing for running header (we draw headers in a final pass, leave top 34mm)
  currentY = 34;

  // Meta Project Card
  doc.setFillColor(...bgLight);
  doc.setDrawColor(...cardBorder);
  doc.roundedRect(margin, currentY, contentWidth, 20, 2, 2, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(...textDark);
  doc.text(projectName, margin + 6, currentY + 8);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(...textMuted);
  if (rawDomain) {
    doc.text(`Domain: ${rawDomain}`, margin + 6, currentY + 15);
  }

  doc.setFontSize(8);
  doc.text(`Report Generated: ${dayjs().format('MMM D, YYYY · h:mm A')}`, pageWidth - margin - 6, currentY + 8, { align: 'right' });
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...brandPrimary);
  doc.text(`3-Tab Comprehensive Report`, pageWidth - margin - 6, currentY + 15, { align: 'right' });

  currentY += 26;

  // Executive Summary / Notes (if provided)
  if (executiveSummary && executiveSummary.trim()) {
    doc.setFillColor(238, 242, 255);
    doc.setDrawColor(199, 210, 254);
    doc.roundedRect(margin, currentY, contentWidth, 20, 2, 2, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(...brandPrimary);
    doc.text('EXECUTIVE HIGHLIGHTS & NOTES', margin + 6, currentY + 6.5);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(...textDark);
    const summaryLines = doc.splitTextToSize(executiveSummary, contentWidth - 12);
    doc.text(summaryLines.slice(0, 2), margin + 6, currentY + 13);

    currentY += 25;
  }

  // Section 1 Header: Tab 1 Analytics Overview
  currentY = drawSectionBanner(doc, {
    y: currentY,
    title: 'TAB 1: ANALYTICS OVERVIEW & KEY PERFORMANCE INDICATORS',
    subtitle: 'Unified Google Analytics 4 & Search Console aggregated performance summary',
    tag: 'ANALYTICS TAB',
    pageWidth,
    margin,
    brandDark,
    brandPrimary,
    textDark,
    textMuted
  });

  // KPI Grid (8 Cards)
  const metrics = data.metrics || {};
  const kpiItems = [
    { label: 'SEARCH CLICKS', val: metrics.clicks ?? 0, trend: metrics.clicksTrend },
    { label: 'IMPRESSIONS', val: metrics.impressions ?? 0, trend: metrics.impressionsTrend },
    { label: 'AVG CTR', val: formatCtr(metrics.ctr, metrics.clicks, metrics.impressions), trend: metrics.ctrTrend },
    { label: 'AVG POSITION', val: metrics.averagePosition ?? '-', trend: metrics.averagePositionTrend },
    { label: 'GA4 SESSIONS', val: metrics.sessions ?? metrics.clicks ?? 0, trend: metrics.sessionsTrend || metrics.clicksTrend },
    { label: 'TOTAL USERS', val: metrics.users ?? 0, trend: metrics.usersTrend },
    { label: 'ORGANIC SESSIONS', val: metrics.organicSessions ?? 0, trend: metrics.organicTrafficShare },
    { label: 'BOUNCE RATE', val: metrics.bounceRate ? (String(metrics.bounceRate).includes('%') ? metrics.bounceRate : `${metrics.bounceRate}%`) : '0.0%', trend: metrics.bounceRateTrend }
  ];

  const cardWidth = (contentWidth - 9) / 4;
  const cardHeight = 19;

  kpiItems.forEach((item, idx) => {
    const col = idx % 4;
    const row = Math.floor(idx / 4);

    const x = margin + col * (cardWidth + 3);
    const y = currentY + row * (cardHeight + 3);

    doc.setFillColor(...bgLight);
    doc.setDrawColor(...cardBorder);
    doc.roundedRect(x, y, cardWidth, cardHeight, 1.5, 1.5, 'FD');

    // Accent line on top of each card
    doc.setFillColor(...brandPrimary);
    doc.rect(x + 2, y, cardWidth - 4, 0.8, 'F');

    // Label
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.5);
    doc.setTextColor(...textMuted);
    doc.text(item.label, x + 4, y + 6);

    // Value
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10.5);
    doc.setTextColor(...textDark);
    const displayVal = typeof item.val === 'number' ? item.val.toLocaleString() : String(item.val);
    doc.text(displayVal, x + 4, y + 14);

    // Trend Badge
    const badge = formatTrendBadge(item.trend);
    if (badge && badge.text) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(6.8);
      doc.setTextColor(...(badge.isNegative ? dangerRed : (badge.isPositive ? successGreen : textMuted)));
      doc.text(badge.text, x + cardWidth - 4, y + 14, { align: 'right' });
    }
  });

  currentY += (2 * cardHeight) + 12;

  // Tab 1 Table: Top Search Queries Overview
  const topSearchQueries = data.topSearchQueries || data.gscPerformance?.queries || [];
  if (topSearchQueries.length > 0) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.setTextColor(...textDark);
    doc.text('Top Search Queries Overview', margin, currentY);
    currentY += 4;

    const queryRows = topSearchQueries.slice(0, 7).map(q => {
      const qText = q.query || q.dimension || '(not set)';
      const clicks = q.clicks || 0;
      const impressions = q.impressions || 0;
      const ctr = formatCtr(q.ctr, clicks, impressions);
      const pos = q.position ? Number(q.position).toFixed(1) : '-';
      return [qText, clicks.toLocaleString(), impressions.toLocaleString(), ctr, pos];
    });

    autoTable(doc, {
      startY: currentY,
      head: [['SEARCH QUERY', 'CLICKS', 'IMPRESSIONS', 'CTR', 'AVG POSITION']],
      body: queryRows,
      theme: 'grid',
      headStyles: baseTableHeader,
      bodyStyles: baseTableBody,
      alternateRowStyles: { fillColor: [248, 250, 252] },
      columnStyles: {
        0: { cellWidth: 86 },
        1: { halign: 'right' },
        2: { halign: 'right' },
        3: { halign: 'right' },
        4: { halign: 'right' }
      },
      margin: { left: margin, right: margin }
    });

    currentY = (doc.lastAutoTable?.finalY || currentY + 35) + 10;
  }

  // Tab 1 Table: Top Landing Pages Overview
  const topLandingPages = data.topLandingPages || data.topSearchPages || data.gscPerformance?.pages || [];
  if (topLandingPages.length > 0) {
    if (currentY > pageHeight - 50) {
      doc.addPage();
      currentY = 32;
    }

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.setTextColor(...textDark);
    doc.text('Top Landing Pages Overview', margin, currentY);
    currentY += 4;

    const pageRows = topLandingPages.slice(0, 6).map(p => {
      const path = p.path || p.page || p.dimension || '/';
      const vol = p.sessions != null ? p.sessions : (p.clicks || 0);
      const bounce = p.bounceRate ? (String(p.bounceRate).includes('%') ? p.bounceRate : `${p.bounceRate}%`) : '-';
      const engage = p.engagementRate ? (String(p.engagementRate).includes('%') ? p.engagementRate : `${p.engagementRate}%`) : (p.impressions ? p.impressions.toLocaleString() : '-');
      return [path, Number(vol).toLocaleString(), bounce, engage];
    });

    autoTable(doc, {
      startY: currentY,
      head: [['PAGE PATH / URL', 'SESSIONS / CLICKS', 'BOUNCE RATE', 'ENGAGEMENT / IMPR']],
      body: pageRows,
      theme: 'grid',
      headStyles: { ...baseTableHeader, fillColor: brandAccent },
      bodyStyles: baseTableBody,
      alternateRowStyles: { fillColor: [248, 250, 252] },
      columnStyles: {
        0: { cellWidth: 96 },
        1: { halign: 'right' },
        2: { halign: 'right' },
        3: { halign: 'right' }
      },
      margin: { left: margin, right: margin }
    });

    currentY = (doc.lastAutoTable?.finalY || currentY + 30) + 12;
  }

  // -------------------------------------------------------------
  // PAGE 2: TAB 2 (SEARCH CONSOLE INSIGHTS - CONTENT & QUERIES)
  // -------------------------------------------------------------
  doc.addPage();
  currentY = 32;

  currentY = drawSectionBanner(doc, {
    y: currentY,
    title: 'TAB 2: SEARCH CONSOLE INSIGHTS (CONTENT & TRAFFIC TRENDS)',
    subtitle: 'Top content landing pages, trending search queries, geographic & traffic source distribution',
    tag: 'INSIGHTS TAB',
    pageWidth,
    margin,
    brandDark,
    brandPrimary,
    textDark,
    textMuted
  });

  const gscInsights = data.gscInsights || {};

  // Table: Content Performance & Trends
  const contentPages = gscInsights.pages?.top || data.gscPerformance?.pages || [];
  if (contentPages.length > 0) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.setTextColor(...textDark);
    doc.text('Your Content (Top Performing Pages & Growth Trends)', margin, currentY);
    currentY += 4;

    const contentRows = contentPages.slice(0, 8).map(p => {
      const dim = p.dimension || p.page || '(not set)';
      const clicks = p.clicks || 0;
      const trendBadge = formatTrendBadge(p.percent != null ? `${p.percent}%` : null);
      const trendText = trendBadge ? `${trendBadge.text} (${p.diff > 0 ? '+' : ''}${p.diff || 0})` : '—';
      return [dim, clicks.toLocaleString(), trendText];
    });

    autoTable(doc, {
      startY: currentY,
      head: [['PAGE URL', 'CLICKS', 'GROWTH TREND (DIFF)']],
      body: contentRows,
      theme: 'grid',
      headStyles: baseTableHeader,
      bodyStyles: baseTableBody,
      alternateRowStyles: { fillColor: [248, 250, 252] },
      columnStyles: {
        0: { cellWidth: 110 },
        1: { halign: 'right' },
        2: { halign: 'right' }
      },
      margin: { left: margin, right: margin }
    });

    currentY = (doc.lastAutoTable?.finalY || currentY + 40) + 9;
  }

  // Table: Queries Leading to Your Site
  const queryInsights = gscInsights.queries?.top || data.gscPerformance?.queries || [];
  if (queryInsights.length > 0) {
    if (currentY > pageHeight - 65) {
      doc.addPage();
      currentY = 32;
    }

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.setTextColor(...textDark);
    doc.text('Queries Leading to Your Site (Search Demand & Trends)', margin, currentY);
    currentY += 4;

    const qRows = queryInsights.slice(0, 8).map(q => {
      const dim = q.dimension || q.query || '(not set)';
      const clicks = q.clicks || 0;
      const trendBadge = formatTrendBadge(q.percent != null ? `${q.percent}%` : null);
      const trendText = trendBadge ? `${trendBadge.text} (${q.diff > 0 ? '+' : ''}${q.diff || 0})` : '—';
      return [dim, clicks.toLocaleString(), trendText];
    });

    autoTable(doc, {
      startY: currentY,
      head: [['SEARCH QUERY', 'CLICKS', 'GROWTH TREND (DIFF)']],
      body: qRows,
      theme: 'grid',
      headStyles: { ...baseTableHeader, fillColor: [99, 102, 241] },
      bodyStyles: baseTableBody,
      alternateRowStyles: { fillColor: [248, 250, 252] },
      columnStyles: {
        0: { cellWidth: 110 },
        1: { halign: 'right' },
        2: { halign: 'right' }
      },
      margin: { left: margin, right: margin }
    });

    currentY = (doc.lastAutoTable?.finalY || currentY + 40) + 9;
  }

  // Geographic Breakdown (Top Countries) & Additional Traffic Sources
  const countryList = gscInsights.countries || data.gscPerformance?.countries || [];
  const additionalSources = gscInsights.additionalSources || [];

  if (countryList.length > 0 || additionalSources.length > 0) {
    if (currentY > pageHeight - 55) {
      doc.addPage();
      currentY = 32;
    }

    const totalCountryClicks = countryList.reduce((sum, c) => sum + (c.clicks || 0), 0);

    const countryRows = countryList.slice(0, 6).map(c => {
      const name = c.country || c.dimension || '(not set)';
      const clicks = c.clicks || 0;
      const share = totalCountryClicks > 0 ? `${((clicks / totalCountryClicks) * 100).toFixed(1)}%` : '0.0%';
      return [name, clicks.toLocaleString(), share];
    });

    const sourceRows = additionalSources.map(s => [s.source, s.clicks.toLocaleString()]);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.setTextColor(...textDark);
    doc.text('Top Countries & Traffic Sources', margin, currentY);
    currentY += 4;

    autoTable(doc, {
      startY: currentY,
      head: [['COUNTRY', 'CLICKS', 'TRAFFIC SHARE %']],
      body: countryRows.length > 0 ? countryRows : [['No country data', '-', '-']],
      theme: 'grid',
      headStyles: { ...baseTableHeader, fillColor: [79, 70, 229] },
      bodyStyles: baseTableBody,
      alternateRowStyles: { fillColor: [248, 250, 252] },
      columnStyles: {
        0: { cellWidth: 90 },
        1: { halign: 'right' },
        2: { halign: 'right' }
      },
      margin: { left: margin, right: margin }
    });

    currentY = (doc.lastAutoTable?.finalY || currentY + 30) + 9;

    if (sourceRows.length > 0) {
      autoTable(doc, {
        startY: currentY,
        head: [['ADDITIONAL TRAFFIC SOURCE', 'CLICKS']],
        body: sourceRows,
        theme: 'grid',
        headStyles: { ...baseTableHeader, fillColor: [100, 116, 139] },
        bodyStyles: baseTableBody,
        columnStyles: {
          0: { cellWidth: 120 },
          1: { halign: 'right' }
        },
        margin: { left: margin, right: margin }
      });
      currentY = (doc.lastAutoTable?.finalY || currentY + 20) + 12;
    }
  }

  // -------------------------------------------------------------
  // PAGE 3: TAB 3 (SEARCH CONSOLE PERFORMANCE BREAKDOWN)
  // -------------------------------------------------------------
  doc.addPage();
  currentY = 32;

  currentY = drawSectionBanner(doc, {
    y: currentY,
    title: 'TAB 3: SEARCH CONSOLE PERFORMANCE BREAKDOWN',
    subtitle: 'Deep-dive metrics across Devices, Top Queries, Countries, Search Appearance & Daily Activity',
    tag: 'PERFORMANCE TAB',
    pageWidth,
    margin,
    brandDark,
    brandPrimary,
    textDark,
    textMuted
  });

  const gscPerformance = data.gscPerformance || {};

  // Performance Ribbon (Clicks, Impressions, CTR, Position)
  const perfRibbonY = currentY;
  const ribbonCardWidth = (contentWidth - 9) / 4;
  const ribbonCardHeight = 15;

  const ribbonItems = [
    { label: 'TOTAL CLICKS', val: (metrics.clicks ?? 0).toLocaleString(), color: brandPrimary },
    { label: 'TOTAL IMPRESSIONS', val: (metrics.impressions ?? 0).toLocaleString(), color: [94, 53, 177] },
    { label: 'AVERAGE CTR', val: formatCtr(metrics.ctr, metrics.clicks, metrics.impressions), color: [16, 185, 129] },
    { label: 'AVERAGE POSITION', val: String(metrics.averagePosition ?? '-'), color: [217, 119, 6] }
  ];

  ribbonItems.forEach((item, idx) => {
    const x = margin + idx * (ribbonCardWidth + 3);
    doc.setFillColor(...bgLight);
    doc.setDrawColor(...cardBorder);
    doc.roundedRect(x, perfRibbonY, ribbonCardWidth, ribbonCardHeight, 1.5, 1.5, 'FD');

    doc.setFillColor(...item.color);
    doc.rect(x + 2, perfRibbonY, ribbonCardWidth - 4, 0.8, 'F');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.5);
    doc.setTextColor(...textMuted);
    doc.text(item.label, x + 3.5, perfRibbonY + 5.5);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.setTextColor(...textDark);
    doc.text(item.val, x + 3.5, perfRibbonY + 11.5);
  });

  currentY += ribbonCardHeight + 10;

  // Performance Breakdown by Device
  const deviceList = gscPerformance.devices || data.topDevices || [];
  if (deviceList.length > 0) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.setTextColor(...textDark);
    doc.text('Performance by Device', margin, currentY);
    currentY += 4;

    const deviceRows = deviceList.map(d => {
      const devName = d.dimension || d.device || 'DESKTOP';
      const clicks = d.clicks != null ? d.clicks : (d.sessions || 0);
      const impressions = d.impressions || 0;
      const ctr = formatCtr(d.ctr, clicks, impressions);
      return [devName.toUpperCase(), Number(clicks).toLocaleString(), Number(impressions).toLocaleString(), ctr];
    });

    autoTable(doc, {
      startY: currentY,
      head: [['DEVICE CATEGORY', 'CLICKS', 'IMPRESSIONS', 'CTR']],
      body: deviceRows,
      theme: 'grid',
      headStyles: baseTableHeader,
      bodyStyles: baseTableBody,
      alternateRowStyles: { fillColor: [248, 250, 252] },
      columnStyles: {
        0: { cellWidth: 70 },
        1: { halign: 'right' },
        2: { halign: 'right' },
        3: { halign: 'right' }
      },
      margin: { left: margin, right: margin }
    });

    currentY = (doc.lastAutoTable?.finalY || currentY + 25) + 9;
  }

  // Performance Breakdown by Search Appearance
  const appearances = gscPerformance.searchAppearances || [];
  if (appearances.length > 0) {
    if (currentY > pageHeight - 55) {
      doc.addPage();
      currentY = 32;
    }

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.setTextColor(...textDark);
    doc.text('Performance by Search Appearance', margin, currentY);
    currentY += 4;

    const appRows = appearances.slice(0, 5).map(a => {
      const clicks = a.clicks || 0;
      const impressions = a.impressions || 0;
      const ctr = formatCtr(a.ctr, clicks, impressions);
      return [a.dimension || 'Web Rich Results', Number(clicks).toLocaleString(), Number(impressions).toLocaleString(), ctr];
    });

    autoTable(doc, {
      startY: currentY,
      head: [['SEARCH APPEARANCE TYPE', 'CLICKS', 'IMPRESSIONS', 'CTR']],
      body: appRows,
      theme: 'grid',
      headStyles: { ...baseTableHeader, fillColor: [99, 102, 241] },
      bodyStyles: baseTableBody,
      alternateRowStyles: { fillColor: [248, 250, 252] },
      columnStyles: {
        0: { cellWidth: 90 },
        1: { halign: 'right' },
        2: { halign: 'right' },
        3: { halign: 'right' }
      },
      margin: { left: margin, right: margin }
    });

    currentY = (doc.lastAutoTable?.finalY || currentY + 25) + 9;
  }

  // Performance Daily Activity (Days table)
  const searchTraffic = data.searchTraffic || [];
  if (searchTraffic.length > 0) {
    if (currentY > pageHeight - 65) {
      doc.addPage();
      currentY = 32;
    }

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.setTextColor(...textDark);
    doc.text('Daily Search Activity Log (Recent Days)', margin, currentY);
    currentY += 4;

    const daysRows = [...searchTraffic]
      .reverse()
      .slice(0, 10)
      .map(d => {
        const clicks = d.clicks || 0;
        const impressions = d.impressions || 0;
        const ctr = formatCtr(null, clicks, impressions);
        return [d.day, clicks.toLocaleString(), impressions.toLocaleString(), ctr];
      });

    autoTable(doc, {
      startY: currentY,
      head: [['DATE', 'CLICKS', 'IMPRESSIONS', 'DAILY CTR']],
      body: daysRows,
      theme: 'grid',
      headStyles: { ...baseTableHeader, fillColor: [51, 65, 85] },
      bodyStyles: baseTableBody,
      alternateRowStyles: { fillColor: [248, 250, 252] },
      columnStyles: {
        0: { cellWidth: 70 },
        1: { halign: 'right' },
        2: { halign: 'right' },
        3: { halign: 'right' }
      },
      margin: { left: margin, right: margin }
    });

    currentY = (doc.lastAutoTable?.finalY || currentY + 40) + 10;
  }

  // -------------------------------------------------------------
  // FINAL PASS: Running Headers & Footers across ALL pages
  // -------------------------------------------------------------
  const totalPages = doc.internal.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);

    // 1. Top Brand Header Bar
    doc.setFillColor(...brandDark);
    doc.rect(0, 0, pageWidth, 22, 'F');

    // Accent line below top bar
    doc.setFillColor(...brandPrimary);
    doc.rect(0, 22, pageWidth, 1.5, 'F');

    // Brand Name
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(255, 255, 255);
    doc.text(headerBrandName, margin, 12);

    const bWidth = doc.getTextWidth(headerBrandName);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(203, 213, 225);
    doc.text('ANALYTICAL PERFORMANCE REPORT', margin + bWidth + 5, 12);

    // Date Range on right
    doc.setFontSize(8);
    doc.setTextColor(148, 163, 184);
    doc.text(dateRangeStr, pageWidth - margin, 12, { align: 'right' });

    // 2. Bottom Footer
    doc.setDrawColor(...cardBorder);
    doc.setLineWidth(0.3);
    doc.line(margin, pageHeight - 11, pageWidth - margin, pageHeight - 11);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(...textMuted);
    doc.text(`Confidential — Prepared with ${companyName || 'Tunepath'} Analytics`, margin, pageHeight - 5.5);
    doc.text(`Page ${i} of ${totalPages}`, pageWidth - margin, pageHeight - 5.5, { align: 'right' });
  }

  return doc;
}

export function downloadAnalyticsPdf(options) {
  const doc = generateAnalyticsPdf(options);
  const projName = (options.projectInfo?.name || options.projectInfo?.domain || 'Analytics').replace(/[^a-zA-Z0-9_-]/g, '_');
  const filename = `${projName}_Performance_Report_${dayjs().format('YYYY-MM-DD')}.pdf`;
  doc.save(filename);
}

export function getAnalyticsPdfDataUrl(options) {
  const doc = generateAnalyticsPdf(options);
  return doc.output('datauristring');
}

export function getAnalyticsPdfBlob(options) {
  const doc = generateAnalyticsPdf(options);
  return doc.output('blob');
}
