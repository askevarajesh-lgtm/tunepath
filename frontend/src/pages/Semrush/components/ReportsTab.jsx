import React, { useRef, useState } from 'react';
import { Card, Typography, Button, Row, Col, message } from 'antd';
import { FilePdfOutlined, FileExcelOutlined, DownloadOutlined, ReloadOutlined } from '@ant-design/icons';
import { useOutletContext } from 'react-router-dom';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import PDFReportTemplate from './PDFReportTemplate';
import { exportToCSV } from '../../../utils/exportUtils';

const { Title, Text } = Typography;

const checkMap = {
  2: "sitemap.xml file has format errors",
  6: "multiple canonical URLs",
  8: "pages don't have meta descriptions",
  13: "duplicate title tags",
  15: "duplicate meta descriptions",
  39: "pages returned 4XX status code",
  101: "broken internal images",
  103: "unminified JavaScript and CSS files",
  106: "pages have low text-HTML ratio",
  110: "HTTP URLs in sitemap.xml for HTTPS site",
  112: "images don't have alt attributes",
  125: "pages don't have an h1 heading",
  132: "pages don't have enough text within the title tags",
  135: "links have no anchor text",
  137: "links have non-descriptive anchor text",
  205: "pages have only one incoming internal link",
  213: "URLs with a permanent redirect",
  216: "subdomains don't support HSTS",
  217: "issue with blocked external resource in robots.txt"
};
const getIssueName = (id) => checkMap[id] || `Site Audit Issue #${id}`;

const ReportsTab = () => {
  const { project, projectData, triggerRefresh } = useOutletContext();
  const [generating, setGenerating] = useState(false);
  const pdfRef = useRef(null);
  
  const isRefreshing = projectData?.activeJob && ['QUEUED', 'RUNNING'].includes(projectData.activeJob.status);

  const handleExportPDF = () => {
    try {
      setGenerating(true);
      message.loading({ content: 'Generating Comprehensive SEO Report...', key: 'pdfGen' });

      const pdf = new jsPDF({
        orientation: 'p',
        unit: 'mm',
        format: 'a4',
      });

      const data = projectData?.overview || {};
      const backlinks = projectData?.backlinksOverview || {};
      const health = projectData?.siteHealth || {};
      const keywords = projectData?.organicKeywords || [];
      const trackingRankings = projectData?.positionTracking?.data?.rankings || [];
      const competitors = projectData?.overview?.competitors || [];
      const rawBacklinks = backlinks.rawBacklinks || [];
      const auditData = health.rawData || {};

      const formatNumber = (num) => {
        if (!num && num !== 0) return '0';
        if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
        if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
        return Number(num).toLocaleString();
      };

      const primaryColor = [22, 119, 255]; // Blue
      const successColor = [56, 203, 137]; // Green
      const warningColor = [250, 140, 22]; // Orange
      const errorColor = [255, 77, 79]; // Red
      const headerColor = [240, 245, 255];
      const textColor = [31, 41, 55];
      const secondaryColor = [107, 114, 128];

      // --- PAGE 1: COVER PAGE ---
      pdf.setFillColor(...primaryColor);
      pdf.rect(0, 0, 210, 297, 'F');
      
      pdf.setTextColor(255, 255, 255);
      pdf.setFontSize(48);
      pdf.setFont('helvetica', 'bold');
      pdf.text('SEO Performance', 20, 100);
      pdf.text('Report', 20, 120);

      pdf.setFontSize(16);
      pdf.setFont('helvetica', 'normal');
      pdf.text(`Comprehensive Analysis for:`, 20, 150);
      
      pdf.setFontSize(24);
      pdf.setFont('helvetica', 'bold');
      pdf.text(`${project?.domain || 'Unknown Domain'}`, 20, 160);

      pdf.setFontSize(14);
      pdf.setFont('helvetica', 'normal');
      pdf.text(`Generated on: ${new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}`, 20, 270);
      
      pdf.text(`Agency Growth OS`, 160, 270);

      // --- PAGE 2: EXECUTIVE SUMMARY ---
      pdf.addPage();
      
      // Page Header helper
      const addPageHeader = (title) => {
        pdf.setFillColor(250, 250, 250);
        pdf.rect(0, 0, 210, 30, 'F');
        pdf.setTextColor(...primaryColor);
        pdf.setFontSize(24);
        pdf.setFont('helvetica', 'bold');
        pdf.text(title, 14, 20);
        pdf.setDrawColor(...primaryColor);
        pdf.setLineWidth(1);
        pdf.line(14, 25, 196, 25);
      };

      addPageHeader('Executive Summary');
      let nextY = 40;

      pdf.setTextColor(...textColor);
      pdf.setFontSize(12);
      pdf.setFont('helvetica', 'normal');
      pdf.text('This section provides a high-level overview of the most critical SEO KPIs.', 14, nextY);
      nextY += 15;

      autoTable(pdf, {
        startY: nextY,
        head: [['Authority Score', 'Organic Traffic', 'Organic Keywords', 'Paid Keywords']],
        body: [[
            String(backlinks.score || data['Rank'] || '0'),
            formatNumber(data['Organic Traffic']),
            formatNumber(data['Organic Keywords']),
            formatNumber(data['Adwords Traffic'])
        ]],
        theme: 'grid',
        headStyles: { fillColor: primaryColor, textColor: 255, halign: 'center', fontSize: 12 },
        bodyStyles: { halign: 'center', fontSize: 16, fontStyle: 'bold', textColor: textColor },
        margin: { left: 14, right: 14 }
      });

      nextY = pdf.lastAutoTable.finalY + 20;

      // Site Health Summary
      pdf.setFontSize(16);
      pdf.setFont('helvetica', 'bold');
      pdf.text('Site Health Summary', 14, nextY);
      nextY += 10;
      
      const errorsData = Array.isArray(auditData.errors) ? auditData.errors : [];
      const warningsData = Array.isArray(auditData.warnings) ? auditData.warnings : [];
      const errorsCount = errorsData.reduce((acc, curr) => acc + curr.count, 0);
      const warningsCount = warningsData.reduce((acc, curr) => acc + curr.count, 0);

      autoTable(pdf, {
        startY: nextY,
        head: [['Health Score', 'Passed Checks', 'Errors', 'Warnings']],
        body: [[
            `${health.overallScore ?? 'N/A'}%`,
            formatNumber(auditData.healthy || 0),
            formatNumber(errorsCount),
            formatNumber(warningsCount)
        ]],
        theme: 'grid',
        headStyles: { fillColor: headerColor, textColor: textColor, halign: 'center' },
        bodyStyles: { halign: 'center', fontSize: 14, fontStyle: 'bold', textColor: textColor },
      });
      
      nextY = pdf.lastAutoTable.finalY + 20;

      // Backlink Summary
      pdf.setFontSize(16);
      pdf.setFont('helvetica', 'bold');
      pdf.text('Backlink Profile', 14, nextY);
      nextY += 10;
      
      autoTable(pdf, {
        startY: nextY,
        head: [['Total Backlinks', 'Referring Domains', 'Follow Links', 'No-Follow']],
        body: [[
            formatNumber(backlinks.total || backlinks.backlinks),
            formatNumber(backlinks.backlinksDetails?.referringDomains || backlinks.referringDomains || 0),
            formatNumber(backlinks.backlinksDetails?.follow || backlinks.follow || 0),
            formatNumber(backlinks.backlinksDetails?.nofollow || backlinks.nofollow || 0)
        ]],
        theme: 'grid',
        headStyles: { fillColor: headerColor, textColor: textColor, halign: 'center' },
        bodyStyles: { halign: 'center', fontSize: 14, fontStyle: 'bold', textColor: textColor },
      });

      // --- PAGE 3: ORGANIC KEYWORDS ---
      pdf.addPage();
      addPageHeader('Organic Search Performance');
      nextY = 40;

      pdf.setTextColor(...textColor);
      pdf.setFontSize(12);
      pdf.setFont('helvetica', 'normal');
      pdf.text('Top organic keywords driving traffic to the domain based on SEO Intelligence data.', 14, nextY);
      nextY += 10;

      const topKeywords = keywords.slice(0, 25);
      if (topKeywords.length > 0) {
        const keywordsRows = topKeywords.map(k => [
          k.keyword || '',
          k.position || '-',
          formatNumber(k.searchVolume),
          k.keywordDifficulty || '-',
          k.cpc || '-'
        ]);

        autoTable(pdf, {
          startY: nextY,
          head: [['Keyword', 'Position', 'Search Volume', 'KD %', 'CPC ($)']],
          body: keywordsRows,
          theme: 'striped',
          headStyles: { fillColor: primaryColor, textColor: 255 },
          styles: { fontSize: 10, textColor: textColor },
          alternateRowStyles: { fillColor: [249, 250, 251] }
        });
      } else {
        pdf.text('No organic keyword data available.', 14, nextY + 10);
      }

      // --- PAGE 4: POSITION TRACKING ---
      if (trackingRankings.length > 0) {
        pdf.addPage();
        addPageHeader('Position Tracking');
        nextY = 40;
        
        pdf.setTextColor(...textColor);
        pdf.setFontSize(12);
        pdf.setFont('helvetica', 'normal');
        pdf.text('Current rankings and visibility for tracked target keywords.', 14, nextY);
        nextY += 10;

        const trackingRows = trackingRankings.slice(0, 25).map(k => {
          let diff = '-';
          if (k.position !== null && k.previousPosition !== null && k.position !== '> 100' && k.previousPosition !== '> 100') {
            const pos = Number(k.position);
            const prevPos = Number(k.previousPosition);
            if (prevPos > 0 && prevPos !== pos) {
              const d = prevPos - pos;
              diff = d > 0 ? `+${d}` : `${d}`;
            }
          }
          
          return [
            k.keyword || '',
            k.previousPosition || '-',
            k.position || '-',
            diff,
            k.visibility ? `${Number(k.visibility).toFixed(2)}%` : '0.00%',
            k.traffic ? formatNumber(k.traffic) : '0',
            formatNumber(k.searchVolume)
          ];
        });

        autoTable(pdf, {
          startY: nextY,
          head: [['Keyword', 'Prev. Pos', 'Curr. Pos', 'Diff', 'Visibility', 'Est. Traffic', 'Volume']],
          body: trackingRows,
          theme: 'striped',
          headStyles: { fillColor: [114, 46, 209] }, // Purple
          styles: { fontSize: 9, textColor: textColor },
          alternateRowStyles: { fillColor: [249, 250, 251] },
          columnStyles: { 0: { cellWidth: 50 } } // Give keyword more space
        });
      }

      // --- PAGE 5: TOP BACKLINKS & COMPETITORS ---
      pdf.addPage();
      addPageHeader('Top Backlinks & Competitors');
      nextY = 40;

      if (rawBacklinks.length > 0) {
        pdf.setFontSize(16);
        pdf.setFont('helvetica', 'bold');
        pdf.text('Top Referring Backlinks', 14, nextY);
        nextY += 10;
        
        const topBacklinks = rawBacklinks.slice(0, 15);
        const tableRows = topBacklinks.map(r => [
          r.page_as || r.pageAs || '-',
          r.source_url || '-',
          r.anchor || '-',
          r.isFollow === false ? 'No' : 'Yes'
        ]);

        autoTable(pdf, {
          startY: nextY,
          head: [['Page AS', 'Source URL', 'Anchor', 'Follow']],
          body: tableRows,
          theme: 'grid',
          headStyles: { fillColor: successColor, textColor: 255 },
          styles: { fontSize: 9, cellPadding: 2, overflow: 'linebreak' },
          columnStyles: { 1: { cellWidth: 70 }, 2: { cellWidth: 40 } }
        });
        nextY = pdf.lastAutoTable.finalY + 20;
      }

      if (competitors.length > 0) {
        pdf.setFontSize(16);
        pdf.setFont('helvetica', 'bold');
        pdf.setTextColor(...textColor);
        pdf.text('Main Competitors', 14, nextY);
        nextY += 10;
        
        const compRows = competitors.slice(0, 10).map(c => [
          c.domain || '',
          formatNumber(c.competitorRelevance || 0),
          formatNumber(c.commonKeywords || 0),
          formatNumber(c.organicKeywords || 0)
        ]);

        autoTable(pdf, {
          startY: nextY,
          head: [['Competitor Domain', 'Relevance Score', 'Common Keywords', 'Total Keywords']],
          body: compRows,
          theme: 'striped',
          headStyles: { fillColor: warningColor, textColor: 255 },
          styles: { fontSize: 10 }
        });
      }

      // --- PAGE 6: TECHNICAL SEO ISSUES ---
      if (errorsCount > 0 || warningsCount > 0) {
        pdf.addPage();
        addPageHeader('Technical SEO Issues');
        nextY = 40;

        const addIssueTable = (title, issueData, bgColor) => {
          const issues = issueData.map(d => ({ name: getIssueName(d.id), count: d.count })).filter(d => d.count > 0).sort((a, b) => b.count - a.count).slice(0, 15);
          
          if (issues.length > 0) {
            pdf.setFontSize(14);
            pdf.setFont('helvetica', 'bold');
            pdf.setTextColor(...textColor);
            pdf.text(title, 14, nextY);
            nextY += 5;
            
            autoTable(pdf, {
              startY: nextY,
              head: [['Issue Description', 'Pages Affected']],
              body: issues.map(i => [i.name, formatNumber(i.count)]),
              theme: 'grid',
              headStyles: { fillColor: bgColor, textColor: 255 },
              styles: { fontSize: 10 }
            });
            nextY = pdf.lastAutoTable.finalY + 15;
          }
        };

        if (errorsCount > 0) addIssueTable('Top Errors', errorsData, errorColor);
        if (warningsCount > 0) addIssueTable('Top Warnings', warningsData, warningColor);
      }

      // --- ADD PAGE NUMBERS ---
      const pageCount = pdf.internal.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        pdf.setPage(i);
        pdf.setFontSize(10);
        pdf.setTextColor(150, 150, 150);
        pdf.text(`Page ${i} of ${pageCount}`, 196, 290, { align: 'right' });
      }

      pdf.save(`${project?.domain?.replace(/\./g, '_') || 'project'}_SEO_Comprehensive_Report.pdf`);
      
      message.success({ content: 'Report generated successfully!', key: 'pdfGen', duration: 3 });
    } catch (error) {
      console.error('PDF Generation failed:', error);
      message.error({ content: 'Failed to generate report.', key: 'pdfGen', duration: 3 });
    } finally {
      setGenerating(false);
    }
  };

  const handleExportCSV = (id) => {
    let data = [];
    let filename = '';

    if (id === 'organic') {
       data = projectData?.organicKeywordsData || [];
       filename = `${project.domain.replace(/\./g, '_')}_Organic_Research.csv`;
    }

    if (data.length === 0) {
        message.warning({ content: 'No data available for this report.' });
        return;
    }

    // Convert to CSV
    const convertToCSV = (arr) => {
      const keys = Object.keys(arr[0]);
      const csvData = arr.map(row => 
         keys.map(k => {
           let cell = row[k] === null || row[k] === undefined ? '' : row[k];
           cell = String(cell).replace(/"/g, '""');
           return `"${cell}"`;
         }).join(',')
      );
      return [keys.join(','), ...csvData].join('\n');
    };

    try {
        const csvContent = convertToCSV(data);
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = filename;
        link.click();
        message.success({ content: 'Report generated successfully!', duration: 3 });
    } catch (e) {
        console.error('CSV Generation failed:', e);
        message.error({ content: 'Failed to generate report.' });
    }
  };

  const handleExportBacklinkPDF = () => {
    try {
      setGenerating(true);
      message.loading({ content: 'Generating Backlink Report...', key: 'pdfGen' });

      const pdf = new jsPDF({
        orientation: 'l', // Landscape for the table
        unit: 'mm',
        format: 'a4',
      });

      const backlinks = projectData?.backlinksOverview || {};
      const rawBacklinks = backlinks.rawBacklinks || [];

      const formatNumber = (num) => {
        if (!num && num !== 0) return '0';
        return Number(num).toLocaleString();
      };

      // Header
      pdf.setFontSize(24);
      pdf.setTextColor(17, 24, 39);
      pdf.text('Backlink Audit Report', 14, 22);

      pdf.setFontSize(10);
      pdf.setTextColor(107, 114, 128);
      pdf.text(`Prepared for ${project?.domain || 'Unknown Domain'}`, 14, 30);
      pdf.text(`Generated On ${new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}`, 220, 30);

      pdf.setDrawColor(240, 240, 240);
      pdf.line(14, 35, 283, 35);

      // Summary Stats
      autoTable(pdf, {
        startY: 40,
        head: [['Total Backlinks', 'Authority Score', 'Referring Domains', 'Follow', 'Nofollow']],
        body: [[
            formatNumber(backlinks.total || backlinks.backlinks),
            String(backlinks.score || '0'),
            formatNumber(backlinks.referringDomains || 0),
            formatNumber(backlinks.follow || 0),
            formatNumber(backlinks.nofollow || 0)
        ]],
        theme: 'grid',
        headStyles: { fillColor: [248, 250, 252], textColor: [107, 114, 128], halign: 'center' },
        bodyStyles: { halign: 'center', fontSize: 14, fontStyle: 'bold', textColor: [15, 23, 42] },
        alternateRowStyles: { fillColor: [255, 255, 255] }
      });

      let nextY = pdf.lastAutoTable.finalY + 15;

      // Table of Backlinks
      pdf.setFontSize(16);
      pdf.setTextColor(55, 65, 81);
      pdf.text('Top Backlinks', 14, nextY);

      const tableColumn = ["Page AS", "Source URL", "Target URL", "Anchor", "Follow", "First Seen"];
      const tableRows = [];
      
      const topBacklinks = rawBacklinks.slice(0, 100); // Prevent massive PDF sizes
      
      topBacklinks.forEach(r => {
        const rowData = [
          r.page_as || r.pageAs || '-',
          r.source_url || '-',
          r.target_url || '-',
          r.anchor || '-',
          r.isFollow === false ? 'No' : 'Yes',
          r.first_seen ? new Date(r.first_seen * 1000).toLocaleDateString() : '-'
        ];
        tableRows.push(rowData);
      });

      if (tableRows.length > 0) {
        autoTable(pdf, {
          startY: nextY + 5,
          head: [tableColumn],
          body: tableRows,
          theme: 'grid',
          headStyles: { fillColor: [82, 196, 26] }, // Green color from theme
          styles: { fontSize: 8, cellPadding: 2, overflow: 'linebreak' },
          columnStyles: {
            1: { cellWidth: 70 },
            2: { cellWidth: 70 },
            3: { cellWidth: 40 }
          }
        });
      } else {
        pdf.setFontSize(10);
        pdf.text('No backlink data available.', 14, nextY + 10);
      }

      pdf.save(`${project?.domain?.replace(/\./g, '_') || 'project'}_Backlink_Audit.pdf`);
      
      message.success({ content: 'Report generated successfully!', key: 'pdfGen', duration: 3 });
    } catch (error) {
      console.error('PDF Generation failed:', error);
      message.error({ content: 'Failed to generate report.', key: 'pdfGen', duration: 3 });
    } finally {
      setGenerating(false);
    }
  };

  const handleExportHealthPDF = () => {
    try {
      setGenerating(true);
      message.loading({ content: 'Generating Site Health Report...', key: 'pdfGen' });

      const pdf = new jsPDF({
        orientation: 'p',
        unit: 'mm',
        format: 'a4',
      });

      const health = projectData?.siteHealth || {};
      const auditData = health.rawData || {};
      
      const formatNumber = (num) => {
        if (!num && num !== 0) return '0';
        return Number(num).toLocaleString();
      };

      const errorsData = Array.isArray(auditData.errors) ? auditData.errors : [];
      const warningsData = Array.isArray(auditData.warnings) ? auditData.warnings : [];
      const noticesData = Array.isArray(auditData.notices) ? auditData.notices : [];

      const errorsCount = errorsData.reduce((acc, curr) => acc + curr.count, 0);
      const warningsCount = warningsData.reduce((acc, curr) => acc + curr.count, 0);
      const noticesCount = noticesData.reduce((acc, curr) => acc + curr.count, 0);

      // Header
      pdf.setFontSize(24);
      pdf.setTextColor(17, 24, 39);
      pdf.text('Site Health Report', 14, 22);

      pdf.setFontSize(10);
      pdf.setTextColor(107, 114, 128);
      pdf.text(`Prepared for ${project?.domain || 'Unknown Domain'}`, 14, 30);
      pdf.text(`Generated On ${new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}`, 140, 30);

      pdf.setDrawColor(240, 240, 240);
      pdf.line(14, 35, 196, 35);

      // Executive Summary
      autoTable(pdf, {
        startY: 40,
        head: [['Health Score', 'Passed Checks', 'Errors', 'Warnings']],
        body: [[
            `${health.overallScore ?? 'N/A'}`,
            formatNumber(auditData.healthy || 0),
            formatNumber(errorsCount),
            formatNumber(warningsCount)
        ]],
        theme: 'grid',
        headStyles: { fillColor: [248, 250, 252], textColor: [107, 114, 128], halign: 'center' },
        bodyStyles: { halign: 'center', fontSize: 16, fontStyle: 'bold', textColor: [15, 23, 42] }
      });

      let nextY = pdf.lastAutoTable.finalY + 15;

      const addIssueTable = (title, data, color) => {
        const issues = data.map(d => ({ name: getIssueName(d.id), count: d.count })).filter(d => d.count > 0).sort((a, b) => b.count - a.count);
        
        if (issues.length > 0) {
          pdf.setFontSize(16);
          pdf.setTextColor(55, 65, 81);
          pdf.text(title, 14, nextY);
          
          autoTable(pdf, {
            startY: nextY + 5,
            head: [['Issue Description', 'Pages Affected']],
            body: issues.map(i => [i.name, formatNumber(i.count)]),
            theme: 'grid',
            headStyles: { fillColor: color },
            styles: { fontSize: 10 }
          });
          nextY = pdf.lastAutoTable.finalY + 15;
        }
      };

      // Tables for Errors, Warnings, Notices
      addIssueTable('Top Errors', errorsData, [239, 68, 68]); // Red
      addIssueTable('Top Warnings', warningsData, [245, 158, 11]); // Orange
      addIssueTable('Top Notices', noticesData, [59, 130, 246]); // Blue

      if (errorsCount === 0 && warningsCount === 0) {
        pdf.setFontSize(12);
        pdf.setTextColor(16, 185, 129); // Green
        pdf.text('Great job! No major errors or warnings found.', 14, nextY);
      }

      pdf.save(`${project?.domain?.replace(/\./g, '_') || 'project'}_Site_Health.pdf`);
      
      message.success({ content: 'Report generated successfully!', key: 'pdfGen', duration: 3 });
    } catch (error) {
      console.error('PDF Generation failed:', error);
      message.error({ content: 'Failed to generate report.', key: 'pdfGen', duration: 3 });
    } finally {
      setGenerating(false);
    }
  };

  const handleExportKeywordOverviewCSV = () => {
    const rows = projectData?.positionTracking?.data?.keywordRankingOverview || [];
    if (rows.length === 0) {
      message.warning('No keyword ranking overview data available to download.');
      return;
    }

    const cols = [
      { title: 'Month', dataIndex: 'month' },
      { title: 'Keywords Ranking Top 10', dataIndex: 'top10' },
      { title: 'Keywords Ranking Top 20', dataIndex: 'top20' },
      { title: 'Keywords Ranking Top 30 Above', dataIndex: 'top30Above' }
    ];

    exportToCSV(rows, cols, `Keyword_Ranking_Overview_${project?.domain || 'domain'}.csv`);
    message.success('Downloaded Keyword Ranking Overview format (CSV)');
  };

  const handleExportKeywordDetailsCSV = () => {
    const trackingRankings = projectData?.positionTracking?.data?.rankings || [];
    const detailRows = (projectData?.positionTracking?.data?.keywordRankingDetails && projectData.positionTracking.data.keywordRankingDetails.length > 0)
      ? projectData.positionTracking.data.keywordRankingDetails
      : (trackingRankings && trackingRankings.length > 0 ? trackingRankings.map(r => ({
          keyword: r.keyword || r.Keyword || '',
          volume: r.searchVolume || r.volume || 0,
          category: r.category || (r.tags && r.tags[0]) || 'General',
          monthRanks: [{ month: 'Sep 2026', rank: r.position || '-' }]
        })) : []);

    if (detailRows.length === 0) {
      message.warning('No tracked keywords available to download.');
      return;
    }

    const exportRows = detailRows.map(kd => {
      const row = {
        Keyword: kd.keyword,
        Category: kd.category,
        Volume: kd.volume
      };
      if (kd.monthRanks && Array.isArray(kd.monthRanks)) {
        kd.monthRanks.forEach(mr => {
          row[mr.month] = mr.rank;
        });
      }
      return row;
    });

    const cols = [
      { title: 'Keyword', dataIndex: 'Keyword' },
      { title: 'Keyword Category', dataIndex: 'Category' },
      { title: 'Volume', dataIndex: 'Volume' },
      ...(detailRows[0]?.monthRanks || []).map(mr => ({ title: mr.month, dataIndex: mr.month }))
    ];

    exportToCSV(exportRows, cols, `Keyword_Ranking_Details_${project?.domain || 'domain'}.csv`);
    message.success('Downloaded Keyword Ranking Details format (CSV)');
  };

  const reports = [
    { id: 'keyword-details', title: 'Keyword Ranking Details', type: 'keyword_details_csv', desc: 'Granular organic keyword rankings with Search Volume, Categories (Geriatric Care, Elder Care, etc.), and Month-wise Ranks.', icon: <FileExcelOutlined style={{ color: '#52c41a' }} /> },
    { id: 'keyword-ranking', title: 'Keyword Ranking Overview', type: 'keyword_csv', desc: 'Month-on-Month organic keyword-ranking performance comparison (Top 10, Top 20, Top 30 Above).', icon: <FileExcelOutlined style={{ color: '#1890ff' }} /> },
    { id: 'full-seo', title: 'Full SEO Report', type: 'pdf', desc: 'Comprehensive domain overview, organic keywords, and backlinks.', icon: <FilePdfOutlined style={{ color: '#f5222d' }} /> },
    { id: 'health', title: 'Site Health Report', type: 'pdf_health', desc: 'Technical SEO issues, errors, warnings, and crawlability.', icon: <FilePdfOutlined style={{ color: '#f5222d' }} /> },
  ];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 24, alignItems: 'center' }}>
        <div>
          <Title level={3} style={{ margin: 0 }}>Reports</Title>
          <Text type="secondary">Generate and export professional reports for {project?.domain}.</Text>
        </div>
        <Button 
          type="primary" 
          icon={<ReloadOutlined spin={isRefreshing} />} 
          onClick={triggerRefresh} 
          loading={isRefreshing}
          style={{ borderRadius: 8, fontWeight: 600, background: 'var(--text-primary)', color: 'var(--bg-primary)' }}
        >
          {isRefreshing ? 'Refreshing...' : 'Refresh Report Data'}
        </Button>
      </div>

      <Row gutter={[24, 24]}>
        {reports.map((report, idx) => (
          <Col span={12} key={idx}>
            <Card hoverable style={{ height: '100%' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16 }}>
                <div style={{ fontSize: 32 }}>{report.icon}</div>
                <div style={{ flex: 1 }}>
                  <Title level={5} style={{ margin: 0, marginBottom: 4 }}>{report.title}</Title>
                  <Text type="secondary">{report.desc}</Text>
                  <div style={{ marginTop: 16 }}>
                    <Button 
                        type="primary" 
                        icon={<DownloadOutlined />} 
                        onClick={() => {
                          if (report.type === 'keyword_details_csv') handleExportKeywordDetailsCSV();
                          else if (report.type === 'keyword_csv') handleExportKeywordOverviewCSV();
                          else if (report.type === 'csv') handleExportCSV(report.id);
                          else if (report.type === 'pdf_backlink') handleExportBacklinkPDF();
                          else if (report.type === 'pdf_health') handleExportHealthPDF();
                          else handleExportPDF();
                        }} 
                        loading={generating}
                    >
                        Generate Report
                    </Button>
                  </div>
                </div>
              </div>
            </Card>
          </Col>
        ))}
      </Row>

      {/* Hidden container for PDF generation template */}
      <div style={{ position: 'absolute', top: -9999, left: -9999, opacity: 0, zIndex: -1, overflow: 'hidden' }}>
        <PDFReportTemplate ref={pdfRef} project={project} projectData={projectData} />
      </div>
    </div>
  );
};

export default ReportsTab;
