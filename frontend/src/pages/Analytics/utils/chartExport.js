import html2canvas from 'html2canvas';

/**
 * Exports an entire chart card element (including title, graph, legends, and axis) as a PNG using html2canvas.
 */
export async function exportChartAsPng(containerEl, filename) {
  if (!containerEl) return false;

  try {
    // Find the parent Card container if containerEl is just the chart body wrapper
    const targetElement = containerEl.closest('.ant-card') || containerEl;

    // Use html2canvas to capture the DOM element cleanly including Recharts SVG + CSS variables
    const canvas = await html2canvas(targetElement, {
      scale: 2, // 2x resolution for ultra-sharp PNG export
      useCORS: true,
      allowTaint: true,
      backgroundColor: '#ffffff',
      logging: false,
      onclone: (clonedDoc, element) => {
        // Hide export button inside the cloned element so it doesn't appear in the PNG
        const exportBtn = element.querySelector('.ant-dropdown-trigger');
        if (exportBtn) exportBtn.style.visibility = 'hidden';
      }
    });

    const pngUrl = canvas.toDataURL('image/png');
    const link = document.createElement('a');
    link.href = pngUrl;
    link.download = filename.endsWith('.png') ? filename : `${filename}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    return true;
  } catch (error) {
    console.error('Error exporting chart as PNG:', error);
    return false;
  }
}
