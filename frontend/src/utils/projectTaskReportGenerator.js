import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import pptxgen from 'pptxgenjs';
import dayjs from 'dayjs';

export function generateProjectTaskPDF(project, stats) {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  const clientName = project?.clientId?.name || project?.name || 'Client';
  const reportDateStr = dayjs().format('MMMM D, YYYY');

  // Title Section
  doc.setTextColor(30, 41, 59);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.text(`${clientName} - Tasks Report`, 14, 20);

  doc.setFontSize(12);
  doc.setTextColor(100, 116, 139);
  doc.text(`Generated on: ${reportDateStr}`, 14, 28);

  // Stats Cards
  const total = stats?.total || 0;
  const completed = stats?.completed || 0;
  const remaining = stats?.remaining || 0;

  doc.setFontSize(10);
  
  // Card 1: Deliverables
  doc.setFillColor(241, 245, 249);
  doc.rect(14, 34, 55, 18, 'F');
  doc.setTextColor(100, 116, 139);
  doc.text('Deliverables', 18, 41);
  doc.setTextColor(30, 41, 59);
  doc.setFontSize(14);
  doc.text(`${total}`, 18, 48);

  // Card 2: Completed
  doc.setFontSize(10);
  doc.setFillColor(240, 253, 244);
  doc.rect(74, 34, 55, 18, 'F');
  doc.setTextColor(22, 163, 74);
  doc.text('Completed', 78, 41);
  doc.setTextColor(21, 128, 61);
  doc.setFontSize(14);
  doc.text(`${completed}`, 78, 48);

  // Card 3: Remaining
  doc.setFontSize(10);
  doc.setFillColor(254, 252, 232);
  doc.rect(134, 34, 55, 18, 'F');
  doc.setTextColor(202, 138, 4);
  doc.text('Remaining', 138, 41);
  doc.setTextColor(161, 98, 7);
  doc.setFontSize(14);
  doc.text(`${remaining}`, 138, 48);

  const tasks = project?.tasks || [];
  
  const tableRows = tasks.length > 0
    ? tasks.map(task => [
        task.title || 'N/A',
        (task.status || 'created').replace(/_/g, ' ').toUpperCase(),
        (task.priority || 'medium').toUpperCase(),
        task.assignedTo?.name || 'Unassigned',
        task.dueDate ? dayjs(task.dueDate).format('DD/MM/YYYY') : 'N/A'
      ])
    : [['No tasks found', '', '', '', '']];

  autoTable(doc, {
    startY: 60,
    head: [['Task Title', 'Status', 'Priority', 'Assigned To', 'Due Date']],
    body: tableRows,
    theme: 'grid',
    headStyles: {
      fillColor: [15, 23, 42],
      textColor: [255, 255, 255],
      fontSize: 10,
      fontStyle: 'bold',
      lineColor: [51, 65, 85],
      lineWidth: 0.3
    },
    bodyStyles: {
      textColor: [30, 41, 59],
      fontSize: 9,
      lineColor: [203, 213, 225],
      lineWidth: 0.2,
      cellPadding: 4
    },
    margin: { left: 14, right: 14 }
  });

  const pageCount = doc.internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(148, 163, 184);
    doc.text(`Project Tasks Report – ${clientName}`, 14, 287);
    doc.text(`Page ${i} of ${pageCount}`, 196, 287, { align: 'right' });
  }

  const filename = `Project_Tasks_Report_${clientName.replace(/\s+/g, '_')}_${dayjs().format('YYYY-MM-DD')}.pdf`;
  doc.save(filename);
  return filename;
}

export function generateProjectTaskPPT(project, stats) {
  const pptx = new pptxgen();
  const clientName = project?.clientId?.name || project?.name || 'Client';
  
  const slide = pptx.addSlide();
  slide.addText(`${clientName} - Tasks Report`, {
    x: 0.5, y: 0.5, w: '90%', h: 0.5,
    fontSize: 24, bold: true, color: '363636', align: 'center'
  });

  const total = stats?.total || 0;
  const completed = stats?.completed || 0;
  const remaining = stats?.remaining || 0;

  // Deliverables Card
  slide.addShape(pptx.ShapeType.rect, { x: 1, y: 1.2, w: 2.3, h: 0.8, fill: 'F1F5F9' });
  slide.addText('Deliverables', { x: 1.1, y: 1.3, w: 2.1, h: 0.3, fontSize: 12, color: '64748B' });
  slide.addText(`${total}`, { x: 1.1, y: 1.6, w: 2.1, h: 0.3, fontSize: 18, color: '1E293B', bold: true });

  // Completed Card
  slide.addShape(pptx.ShapeType.rect, { x: 3.8, y: 1.2, w: 2.3, h: 0.8, fill: 'F0FDF4' });
  slide.addText('Completed', { x: 3.9, y: 1.3, w: 2.1, h: 0.3, fontSize: 12, color: '16A34A' });
  slide.addText(`${completed}`, { x: 3.9, y: 1.6, w: 2.1, h: 0.3, fontSize: 18, color: '15803D', bold: true });

  // Remaining Card
  slide.addShape(pptx.ShapeType.rect, { x: 6.6, y: 1.2, w: 2.3, h: 0.8, fill: 'FEFCE8' });
  slide.addText('Remaining', { x: 6.7, y: 1.3, w: 2.1, h: 0.3, fontSize: 12, color: 'CA8A04' });
  slide.addText(`${remaining}`, { x: 6.7, y: 1.6, w: 2.1, h: 0.3, fontSize: 18, color: 'A16207', bold: true });

  const tasks = project?.tasks || [];
  
  const tableRows = [
    [
      { text: 'Task Title', options: { fill: '0F172A', color: 'FFFFFF', bold: true } },
      { text: 'Status', options: { fill: '0F172A', color: 'FFFFFF', bold: true } },
      { text: 'Priority', options: { fill: '0F172A', color: 'FFFFFF', bold: true } },
      { text: 'Assigned To', options: { fill: '0F172A', color: 'FFFFFF', bold: true } },
      { text: 'Due Date', options: { fill: '0F172A', color: 'FFFFFF', bold: true } }
    ]
  ];

  if (tasks.length > 0) {
    tasks.forEach(task => {
      tableRows.push([
        task.title || 'N/A',
        (task.status || 'created').replace(/_/g, ' ').toUpperCase(),
        (task.priority || 'medium').toUpperCase(),
        task.assignedTo?.name || 'Unassigned',
        task.dueDate ? dayjs(task.dueDate).format('DD/MM/YYYY') : 'N/A'
      ]);
    });
  } else {
    tableRows.push(['No tasks found', '', '', '', '']);
  }

  slide.addTable(tableRows, {
    x: 0.5, y: 2.5, w: 9, 
    colW: [2.5, 1.5, 1.5, 2, 1.5],
    border: { pt: 1, color: 'E2E8F0' },
    fontSize: 12,
    color: '1E293B',
    margin: 5
  });

  const filename = `Project_Tasks_Report_${clientName.replace(/\s+/g, '_')}_${dayjs().format('YYYY-MM-DD')}.pptx`;
  pptx.writeFile({ fileName: filename });
  return filename;
}
