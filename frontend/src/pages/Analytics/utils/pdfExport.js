import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import dayjs from 'dayjs';

/**
 * Utility to generate a modern, premium executive PDF report for Google Analytics & Search Console
 */
export function generateAnalyticsPdf({ data, projectInfo, companyName, dateRange, executiveSummary, selectedSections = {} }) {
  const doc = new jsPDF('p', 'mm', 'a4');
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 14;

  const headerBrandName = (companyName || 'TUNEPATH').toUpperCase();

  // Premium Palette
  const brandDark = [15, 23, 42];        // Deep Slate (#0f172a)
  const brandPrimary = [79, 70, 229];     // Indigo (#4f46e5)
  const brandGradientEnd = [147, 51, 234]; // Purple (#9333ea)
  const textDark = [30, 41, 59];         // Slate 800 (#1e293b)
  const textMuted = [100, 116, 139];     // Slate 500 (#64748b)
  const bgLight = [248, 250, 252];       // Slate 50 (#f8fafc)
  const cardBorder = [226, 232, 240];    // Slate 200 (#e2e8f0)
  const successGreen = [16, 185, 129];   // Emerald (#10b981)
  const dangerRed = [239, 68, 68];       // Red (#ef4444)

  let currentY = 0;

  // 1. Premium Header Bar & Brand Header
  doc.setFillColor(...brandDark);
  doc.rect(0, 0, pageWidth, 28, 'F');

  // Accent Line under header
  doc.setFillColor(...brandPrimary);
  doc.rect(0, 28, pageWidth, 2, 'F');

  // Dynamic Company Header Title
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(255, 255, 255);
  doc.text(headerBrandName, margin, 15);
  
  const brandWidth = doc.getTextWidth(headerBrandName);
  
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(203, 213, 225);
  doc.text('ANALYTICAL PERFORMANCE REPORT', margin + brandWidth + 6, 15);

  const dateRangeStr = dateRange
    ? `${dayjs(dateRange[0]).format('MMM D, YYYY')} — ${dayjs(dateRange[1]).format('MMM D, YYYY')}`
    : 'Last 30 Days';

  doc.setFontSize(9);
  doc.setTextColor(148, 163, 184);
  doc.text(dateRangeStr, pageWidth - margin, 15, { align: 'right' });

  currentY = 40;

  // 2. Project Meta Card
  const projectName = projectInfo?.name || projectInfo?.domain || 'Website Analytics';
  const projectDomain = projectInfo?.domain ? projectInfo.domain.replace(/^https?:\/\//, '').replace(/\/$/, '') : '';

  doc.setFillColor(...bgLight);
  doc.setDrawColor(...cardBorder);
  doc.roundedRect(margin, currentY, pageWidth - (margin * 2), 22, 3, 3, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(...textDark);
  doc.text(projectName, margin + 6, currentY + 9);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  doc.setTextColor(...textMuted);
  if (projectDomain) {
    doc.text(`Domain: ${projectDomain}`, margin + 6, currentY + 16);
  }

  doc.setFontSize(8.5);
  doc.text(`Generated: ${dayjs().format('MMM D, YYYY · h:mm A')}`, pageWidth - margin - 6, currentY + 13, { align: 'right' });

  currentY += 30;

  // 3. Executive Summary (if provided)
  if (executiveSummary && executiveSummary.trim()) {
    doc.setFillColor(238, 242, 255); // Soft indigo tint
    doc.setDrawColor(199, 210, 254);
    doc.roundedRect(margin, currentY, pageWidth - (margin * 2), 22, 2, 2, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(...brandPrimary);
    doc.text('EXECUTIVE INSIGHTS', margin + 6, currentY + 7);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(...textDark);
    const lines = doc.splitTextToSize(executiveSummary, pageWidth - (margin * 2) - 12);
    doc.text(lines.slice(0, 2), margin + 6, currentY + 14);

    currentY += 28;
  }

  // 4. Section 1: Key Metrics Grid
  if (selectedSections.kpis !== false) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(...textDark);
    doc.text('Key Performance Indicators', margin, currentY);

    currentY += 6;

    // Correct CTR logic (CTR from metrics string like '6.73%' or number)
    const rawCtr = data?.metrics?.ctr;
    const formattedCtr = rawCtr != null ? (String(rawCtr).includes('%') ? String(rawCtr) : `${Number(rawCtr).toFixed(1)}%`) : '0%';

    const metrics = [
      { label: 'SESSIONS', val: data?.metrics?.sessions ?? data?.metrics?.clicks ?? '0', trend: data?.metrics?.sessionsTrend || data?.metrics?.clicksTrend },
      { label: 'TOTAL USERS', val: data?.metrics?.users ?? '0', trend: data?.metrics?.usersTrend },
      { label: 'ORGANIC SESSIONS', val: data?.metrics?.organicSessions ?? '0', trend: data?.metrics?.organicSessionsTrend },
      { label: 'SEARCH CLICKS', val: data?.metrics?.clicks ?? '0', trend: data?.metrics?.clicksTrend },
      { label: 'IMPRESSIONS', val: data?.metrics?.impressions ?? '0', trend: data?.metrics?.impressionsTrend },
      { label: 'AVG CTR', val: formattedCtr, trend: data?.metrics?.ctrTrend },
      { label: 'AVG POSITION', val: data?.metrics?.averagePosition ?? '-', trend: data?.metrics?.averagePositionTrend },
      { label: 'BOUNCE RATE', val: data?.metrics?.bounceRate ? `${data.metrics.bounceRate}%` : '-', trend: data?.metrics?.bounceRateTrend }
    ];

    const cardWidth = (pageWidth - (margin * 2) - 12) / 4;
    const cardHeight = 22;

    metrics.slice(0, 8).forEach((m, idx) => {
      const col = idx % 4;
      const row = Math.floor(idx / 4);

      const x = margin + col * (cardWidth + 4);
      const y = currentY + row * (cardHeight + 4);

      // Card Background with smooth border
      doc.setFillColor(...bgLight);
      doc.setDrawColor(...cardBorder);
      doc.roundedRect(x, y, cardWidth, cardHeight, 2, 2, 'FD');

      // Top Accent Line on Card
      doc.setFillColor(...brandPrimary);
      doc.rect(x + 3, y, cardWidth - 6, 1, 'F');

      // Label
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7);
      doc.setTextColor(...textMuted);
      doc.text(m.label, x + 5, y + 7);

      // Main Value
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(12);
      doc.setTextColor(...textDark);
      const displayVal = typeof m.val === 'number' ? m.val.toLocaleString() : String(m.val);
      doc.text(displayVal, x + 5, y + 16);

      // Trend Badge
      if (m.trend) {
        const trendStr = String(m.trend).trim();
        const isNegative = trendStr.startsWith('-');
        const cleanTrend = trendStr.replace(/^[!\s]+/, '');

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(7.5);
        doc.setTextColor(...(isNegative ? dangerRed : successGreen));
        doc.text(`${isNegative ? '↓' : '↑'} ${cleanTrend}`, x + cardWidth - 5, y + 16, { align: 'right' });
      }
    });

    currentY += (2 * cardHeight) + 16;
  }

  // Helper for AutoTable Styling
  const tableHeaderStyle = {
    fillColor: brandPrimary,
    textColor: [255, 255, 255],
    fontSize: 8.5,
    fontStyle: 'bold',
    cellPadding: 3
  };

  const tableBodyStyle = {
    fontSize: 8,
    textColor: textDark,
    cellPadding: 2.5
  };

  // 5. Section 2: Top Performing Landing Pages Table
  if (selectedSections.pages !== false && data?.gscPerformance?.pages?.length > 0) {
    if (currentY > pageHeight - 55) {
      doc.addPage();
      currentY = margin + 10;
    }

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(...textDark);
    doc.text('Top Performing Landing Pages', margin, currentY);
    currentY += 5;

    const pageRows = data.gscPerformance.pages.slice(0, 10).map(p => {
      // Calculate realistic CTR if missing or 0
      const clicks = p.clicks || 0;
      const impressions = p.impressions || 0;
      const calcCtr = p.ctr && p.ctr > 0 ? (p.ctr * 100).toFixed(1) : (impressions > 0 ? ((clicks / impressions) * 100).toFixed(1) : '0.0');

      return [
        p.dimension,
        clicks.toLocaleString(),
        impressions.toLocaleString(),
        `${calcCtr}%`,
        p.position ? p.position.toFixed(1) : '-'
      ];
    });

    autoTable(doc, {
      startY: currentY,
      head: [['PAGE URL', 'CLICKS', 'IMPRESSIONS', 'CTR', 'AVG POSITION']],
      body: pageRows,
      theme: 'grid',
      headStyles: tableHeaderStyle,
      bodyStyles: tableBodyStyle,
      alternateRowStyles: { fillColor: [248, 250, 252] },
      columnStyles: {
        0: { cellWidth: 92 },
        1: { halign: 'right' },
        2: { halign: 'right' },
        3: { halign: 'right' },
        4: { halign: 'right' }
      },
      margin: { left: margin, right: margin }
    });

    currentY = (doc.lastAutoTable?.finalY || currentY + 40) + 12;
  }

  // 6. Section 3: Top Search Queries Table
  if (selectedSections.queries !== false && data?.gscPerformance?.queries?.length > 0) {
    if (currentY > pageHeight - 55) {
      doc.addPage();
      currentY = margin + 10;
    }

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(...textDark);
    doc.text('Top Organic Search Queries', margin, currentY);
    currentY += 5;

    const queryRows = data.gscPerformance.queries.slice(0, 10).map(q => {
      const clicks = q.clicks || 0;
      const impressions = q.impressions || 0;
      const calcCtr = q.ctr && q.ctr > 0 ? (q.ctr * 100).toFixed(1) : (impressions > 0 ? ((clicks / impressions) * 100).toFixed(1) : '0.0');

      return [
        q.dimension,
        clicks.toLocaleString(),
        impressions.toLocaleString(),
        `${calcCtr}%`,
        q.position ? q.position.toFixed(1) : '-'
      ];
    });

    autoTable(doc, {
      startY: currentY,
      head: [['SEARCH QUERY', 'CLICKS', 'IMPRESSIONS', 'CTR', 'AVG POSITION']],
      body: queryRows,
      theme: 'grid',
      headStyles: { ...tableHeaderStyle, fillColor: [99, 102, 241] }, // Indigo 500
      bodyStyles: tableBodyStyle,
      alternateRowStyles: { fillColor: [248, 250, 252] },
      columnStyles: {
        0: { cellWidth: 92 },
        1: { halign: 'right' },
        2: { halign: 'right' },
        3: { halign: 'right' },
        4: { halign: 'right' }
      },
      margin: { left: margin, right: margin }
    });

    currentY = (doc.lastAutoTable?.finalY || currentY + 40) + 12;
  }

  // 7. Footer Page Numbers & Watermark
  const totalPages = doc.internal.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);

    // Subtle divider line
    doc.setDrawColor(...cardBorder);
    doc.setLineWidth(0.3);
    doc.line(margin, pageHeight - 12, pageWidth - margin, pageHeight - 12);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(...textMuted);
    doc.text(`Confidential — Prepared with ${companyName || 'Tunepath'} Analytics`, margin, pageHeight - 6);
    doc.text(`Page ${i} of ${totalPages}`, pageWidth - margin, pageHeight - 6, { align: 'right' });
  }

  return doc;
}

export function downloadAnalyticsPdf(options) {
  const doc = generateAnalyticsPdf(options);
  const filename = `${options.projectInfo?.name || 'Analytics'}_Report_${dayjs().format('YYYY-MM-DD')}.pdf`;
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
