const PDFDocument = require("pdfkit");
const fs = require("fs");
const path = require("path");
const os = require("os");
const https = require("https");
const http = require("http");
const { URL } = require("url");

/**
 * Generate PDF Invoice
 * @param {Object} invoice - Invoice object with populated fields
 * @param {Object} tenantCompany - Tenant company details
 * @returns {Promise<Buffer>} - PDF buffer
 */
const generateInvoicePDF = async (invoice, tenantCompany) => {
  // Helper function to download image from URL
  const downloadImage = (url) => {
    return new Promise((resolve, reject) => {
      try {
        const parsedUrl = new URL(url);
        const protocol = parsedUrl.protocol === "https:" ? https : http;

        protocol
          .get(url, (response) => {
            if (response.statusCode !== 200) {
              reject(
                new Error(`Failed to download image: ${response.statusCode}`),
              );
              return;
            }

            const chunks = [];
            response.on("data", (chunk) => chunks.push(chunk));
            response.on("end", () => resolve(Buffer.concat(chunks)));
            response.on("error", reject);
          })
          .on("error", reject);
      } catch (error) {
        reject(error);
      }
    });
  };

  // Helper function to add company logo if available
  let logoAdded = false;
  let logoImageBuffer = null;

  if (tenantCompany?.logo) {
    try {
      logoImageBuffer = await downloadImage(tenantCompany.logo);
      logoAdded = true;
    } catch (error) {
      console.warn("Could not download logo for PDF:", error.message);
      logoAdded = false;
    }
  }

  return new Promise((resolve, reject) => {
    try {
      // Create a PDF document
      const doc = new PDFDocument({
        size: "A4",
        margin: 50,
        info: {
          Title: `Invoice ${invoice.invoiceNumber}`,
          Author: tenantCompany?.name || "Invoice System",
          Subject: `Invoice ${invoice.invoiceNumber}`,
        },
      });

      // Collect PDF data
      const chunks = [];
      doc.on("data", (chunk) => chunks.push(chunk));
      doc.on("end", () => resolve(Buffer.concat(chunks)));
      doc.on("error", reject);

      // Add logo if available
      if (logoAdded && logoImageBuffer) {
        try {
          const logoY = 50;
          const logoX = 50;
          const logoHeight = 60;
          const logoWidth = 150;

          doc.image(logoImageBuffer, logoX, logoY, {
            fit: [logoWidth, logoHeight],
            align: "left",
            valign: "top",
          });
        } catch (error) {
          console.warn("Could not add logo to PDF:", error.message);
          logoAdded = false;
        }
      }

      // Header Section - adjust position if logo was added
      const headerStartY = 50;
      const headerStartX = logoAdded ? 220 : 50;
      const logoBottomY = logoAdded ? 110 : 50;

      // Invoice Number and Status (Right aligned) - position at top
      doc.fontSize(14).font("Helvetica-Bold").fillColor("#1890ff");
      doc.text(invoice.invoiceNumber || 'INVOICE', 300, headerStartY, {
        align: "right",
        width: 250,
      });

      doc.fontSize(10).font("Helvetica").fillColor("#000000");
      const statusText = (invoice.paymentStatus || invoice.invoiceStatus || invoice.status || "PENDING").toUpperCase();
      doc.text(`Status: ${statusText}`, 300, headerStartY + 20, {
        align: "right",
        width: 250,
      });

      const typeText = (invoice.invoiceType || invoice.type || "Retainer").toUpperCase();
      doc.text(`Type: ${typeText}`, 300, headerStartY + 34, {
        align: "right",
        width: 250,
      });

      // Calculate max header Y position (right side header ends at headerStartY + 37 + line height)
      const maxHeaderY = headerStartY + 37 + 12; // 12 is approximate line height

      // Company details on left (or below logo)
      if (tenantCompany?.name) {
        doc
          .fontSize(16)
          .font("Helvetica-Bold")
          .text(tenantCompany.name, headerStartX, headerStartY, {
            align: "left",
          });
      }

      let currentTextY = headerStartY + 20;

      if (tenantCompany?.email) {
        doc
          .fontSize(10)
          .font("Helvetica")
          .fillColor("#666666")
          .text(tenantCompany.email, headerStartX, currentTextY, {
            align: "left",
          });
        currentTextY += 12;
      }

      if (tenantCompany?.phone) {
        doc
          .fontSize(10)
          .font("Helvetica")
          .text(tenantCompany.phone, headerStartX, currentTextY, {
            align: "left",
          });
        currentTextY += 12;
      }

      if (tenantCompany?.address) {
        doc
          .fontSize(10)
          .font("Helvetica")
          .text(tenantCompany.address, headerStartX, currentTextY, {
            align: "left",
            width: 280,
          });
        currentTextY += 24;
      }

      // Move to next section - use the maximum Y position from both left and right columns
      const nextSectionY = Math.max(currentTextY, maxHeaderY) + 20;
      doc.y = nextSectionY;

      // Divider
      doc
        .moveTo(50, doc.y)
        .lineTo(550, doc.y)
        .strokeColor("#e8e8e8")
        .lineWidth(1)
        .stroke();
      doc.moveDown(1);

      // Bill To Section
      doc
        .fontSize(14)
        .font("Helvetica-Bold")
        .fillColor("#666666")
        .text("BILL TO", { align: "left" });
      doc.moveDown(0.5);

      // Handle both clientId (new) and companyId (legacy) for client company
      const clientCompany = invoice.clientId || invoice.companyId;
      let clientCompanyName = "N/A";
      let clientCompanyEmail = null;
      let clientCompanyPhone = null;
      let clientCompanyAddress = null;

      if (clientCompany) {
        if (typeof clientCompany === "object") {
          clientCompanyName = clientCompany.name || "N/A";
          clientCompanyEmail = clientCompany.email;
          clientCompanyPhone = clientCompany.phone;

          // Handle structured address object
          if (clientCompany.address) {
            if (typeof clientCompany.address === "object") {
              const addr = clientCompany.address;
              const addressParts = [];
              if (addr.addressLine1) addressParts.push(addr.addressLine1);
              if (addr.area) addressParts.push(addr.area);
              if (addr.city) addressParts.push(addr.city);
              if (addr.district) addressParts.push(addr.district);
              if (addr.state) {
                const statePart = addr.pincode
                  ? `${addr.state} - ${addr.pincode}`
                  : addr.state;
                addressParts.push(statePart);
              } else if (addr.pincode) {
                addressParts.push(addr.pincode);
              }
              if (addr.country) addressParts.push(addr.country);
              clientCompanyAddress = addressParts.join(", ");
            } else {
              clientCompanyAddress = clientCompany.address;
            }
          }
        } else {
          clientCompanyName = clientCompany.toString();
        }
      }

      doc
        .fontSize(15)
        .font("Helvetica-Bold")
        .fillColor("#000000")
        .text(clientCompanyName, { align: "left" });

      if (clientCompanyEmail) {
        doc
          .fontSize(10)
          .font("Helvetica")
          .fillColor("#666666")
          .text(clientCompanyEmail, { align: "left" });
      }

      if (clientCompanyPhone) {
        doc
          .fontSize(10)
          .font("Helvetica")
          .text(clientCompanyPhone, { align: "left" });
      }

      if (clientCompanyAddress) {
        doc
          .fontSize(10)
          .font("Helvetica")
          .text(clientCompanyAddress, { align: "left", width: 280 });
      }

      // Invoice Details (Right aligned)
      const invoiceDetailsY = doc.y - 60; // Position for right column
      doc.fontSize(10).font("Helvetica").fillColor("#666666");
      doc.text("Invoice Date:", 350, invoiceDetailsY, {
        align: "right",
        width: 200,
      });
      doc.font("Helvetica-Bold").fillColor("#000000");
      const invoiceDate = new Date(invoice.createdAt).toLocaleDateString(
        "en-GB",
        { day: "2-digit", month: "short", year: "numeric" },
      );
      doc.text(invoiceDate, { align: "right" });

      if (invoice.dueDate) {
        doc.moveDown(0.3);
        doc.font("Helvetica").fillColor("#666666");
        doc.text("Due Date:", { align: "right" });
        doc.font("Helvetica-Bold").fillColor("#000000");
        const dueDate = new Date(invoice.dueDate).toLocaleDateString("en-GB", {
          day: "2-digit",
          month: "short",
          year: "numeric",
        });
        doc.text(dueDate, { align: "right" });
      }

      // Determine billing type
      const hasSubscription = invoice.items?.some(
        (item) => item.billingType === "subscription",
      );
      const billingType = hasSubscription ? "Subscription" : "One-Time";
      doc.moveDown(0.3);
      doc.font("Helvetica").fillColor("#666666");
      doc.text("Billing Type:", { align: "right" });
      doc.font("Helvetica-Bold").fillColor("#000000");
      doc.text(billingType, { align: "right" });

      doc.moveDown(1.5);

      // Divider
      doc
        .moveTo(50, doc.y)
        .lineTo(550, doc.y)
        .strokeColor("#e8e8e8")
        .lineWidth(1)
        .stroke();
      doc.moveDown(1);

      // Items Table Header
      const tableTop = doc.y;
      doc.fontSize(13).font("Helvetica-Bold").fillColor("#000000");

      // Table headers
      doc.text("Item / Service", 50, tableTop);
      doc.text("Description", 220, tableTop);
      doc.text("Qty", 350, tableTop, { width: 40, align: "center" });
      doc.text("Rate", 390, tableTop, { width: 80, align: "right" });
      doc.text("Amount", 470, tableTop, { width: 80, align: "right" });

      // Table header underline
      doc
        .moveTo(50, tableTop + 15)
        .lineTo(550, tableTop + 15)
        .strokeColor("#e8e8e8")
        .lineWidth(2)
        .stroke();

      let currentY = tableTop + 25;

      // Items rows
      const totalDeliverables = {};
      if (invoice.items && invoice.items.length > 0) {
        invoice.items.forEach((item, index) => {
          // Handle both populated and non-populated serviceId
          let baseServiceName = "N/A";
          if (item.serviceId) {
            if (typeof item.serviceId === "object" && item.serviceId.name) {
              baseServiceName = item.serviceId.name;
            } else if (typeof item.serviceId === "string") {
              baseServiceName = item.serviceId;
            }
          }

          const serviceName = item.packageName
            ? `${baseServiceName} - ${item.packageName}`
            : baseServiceName;

          // Aggregate deliverables for summary
          if (
            typeof item.serviceId === "object" &&
            item.serviceId.deliverables
          ) {
            item.serviceId.deliverables.forEach((d) => {
              const type = d.type.replace("_", " ");
              totalDeliverables[type] =
                (totalDeliverables[type] || 0) +
                d.quantity * (item.quantity || 1);
            });
          }

          const description = item.description || "-";
          const quantity = item.quantity || 1;
          const rate = item.rate || 0;
          const amount = item.amount || 0;

          // Check if we need a new page
          if (currentY > 700) {
            doc.addPage();
            currentY = 50;
          }

          doc.fontSize(10).font("Helvetica-Bold").fillColor("#000000");
          doc.text(serviceName, 50, currentY, { width: 160 });

          doc.font("Helvetica").fillColor("#666666");
          doc.fontSize(9);
          // Show description only if different from service name
          const displayDesc =
            description !== baseServiceName && description !== serviceName
              ? description
              : "-";
          doc.text(displayDesc, 220, currentY, { width: 120 });

          doc.font("Helvetica").fillColor("#000000");
          doc.fontSize(10);
          doc.text(String(quantity), 350, currentY, {
            width: 40,
            align: "center",
          });
          doc.text(`Rs. ${rate.toLocaleString("en-IN")}`, 390, currentY, {
            width: 80,
            align: "right",
          });
          doc.font("Helvetica-Bold");
          doc.text(`Rs. ${amount.toLocaleString("en-IN")}`, 470, currentY, {
            width: 80,
            align: "right",
          });

          currentY += 20;

          // Show item deliverables
          if (typeof item.serviceId === "object") {
            if (item.serviceId.description) {
              doc.fontSize(8).font("Helvetica").fillColor("#888888");
              doc.text(item.serviceId.description, 50, currentY, {
                width: 300,
              });
              currentY +=
                doc.heightOfString(item.serviceId.description, { width: 300 }) +
                5;
            }

            if (item.serviceId.deliverables?.length > 0) {
              doc.fontSize(8).font("Helvetica-Bold").fillColor("#777777");
              const delivText = item.serviceId.deliverables
                .map((d) => `${d.quantity} ${d.type.replace("_", " ")}`)
                .join(", ");
              doc.text(`Deliverables: ${delivText}`, 50, currentY, {
                width: 300,
              });
              currentY += 12;
            }
          }

          // Billing type tag
          if (item.billingType === "subscription") {
            doc.fontSize(8).font("Helvetica").fillColor("#1890ff");
            doc.text("Subscription", 50, currentY, { width: 100 });

            // Add renewal date if available
            if (item.subscriptionEndDate) {
              const renewalDate = new Date(
                item.subscriptionEndDate,
              ).toLocaleDateString("en-GB", {
                day: "2-digit",
                month: "short",
                year: "numeric",
              });
              doc.text(`Renewal: ${renewalDate}`, 110, currentY, {
                width: 150,
              });
            }
            currentY += 12;
          }

          currentY += 5;

          // Row separator
          doc
            .moveTo(50, currentY)
            .lineTo(550, currentY)
            .strokeColor("#f0f0f0")
            .lineWidth(0.5)
            .stroke();

          currentY += 15;
        });
      } else {
        // No items message
        doc.fontSize(11).font("Helvetica").fillColor("#666666");
        doc.text("No items", 50, currentY, { width: 500, align: "center" });
      }

      doc.moveDown(1);

      // Divider
      doc
        .moveTo(50, doc.y)
        .lineTo(550, doc.y)
        .strokeColor("#e8e8e8")
        .lineWidth(1)
        .stroke();
      doc.moveDown(1);

      // Totals Section
      const totalsX = 350;
      const totalsY = doc.y;

      const subtotalVal = invoice.subtotal || invoice.amount || invoice.grandTotal || 0;
      const totalVal = invoice.grandTotal || invoice.total || invoice.amount || 0;
      const pendingVal = invoice.pendingAmount !== undefined ? invoice.pendingAmount : (invoice.paymentStatus === 'Paid' ? 0 : totalVal);

      doc.fontSize(11).font("Helvetica").fillColor("#666666");
      doc.text("Subtotal:", totalsX, totalsY, { width: 100, align: "right" });
      doc.font("Helvetica-Bold").fillColor("#000000");
      doc.text(
        `Rs. ${subtotalVal.toLocaleString("en-IN")}`,
        totalsX + 100,
        totalsY,
        { width: 100, align: "right" },
      );

      if (invoice.tax > 0) {
        doc.moveDown(0.5);
        doc.font("Helvetica").fillColor("#666666");
        doc.text("Tax (GST):", totalsX, doc.y, { width: 100, align: "right" });
        doc.font("Helvetica-Bold").fillColor("#000000");
        doc.text(
          `Rs. ${(invoice.tax || 0).toLocaleString("en-IN")}`,
          totalsX + 100,
          doc.y,
          { width: 100, align: "right" },
        );
      }

      doc.moveDown(0.5);
      // Divider for total
      doc
        .moveTo(totalsX, doc.y)
        .lineTo(totalsX + 200, doc.y)
        .strokeColor("#e8e8e8")
        .lineWidth(1)
        .stroke();
      doc.moveDown(0.5);

      const totalY = doc.y;
      doc.fontSize(14).font("Helvetica-Bold").fillColor("#1890ff");
      doc.text("Total Amount:", totalsX, totalY, { width: 100, align: "right" });
      doc.text(
        `Rs. ${totalVal.toLocaleString("en-IN")}`,
        totalsX + 100,
        totalY,
        { width: 100, align: "right" },
      );

      if (pendingVal > 0) {
        doc.moveDown(0.5);
        const pendingY = doc.y;
        doc.fontSize(11).font("Helvetica-Bold").fillColor("#cf1322");
        doc.text("Pending Amount:", totalsX, pendingY, {
          width: 100,
          align: "right",
        });
        doc.text(
          `Rs. ${pendingVal.toLocaleString("en-IN")}`,
          totalsX + 100,
          pendingY,
          { width: 100, align: "right" },
        );
      }

      doc.moveDown(2);

      // Deliverables Summary Section
      if (Object.keys(totalDeliverables).length > 0) {
        doc.moveDown(1);
        const summaryY = doc.y;
        doc
          .rect(50, summaryY, 280, 80)
          .fillColor("#f9f9f9")
          .strokeColor("#eeeeee")
          .fillAndStroke();
        doc.fillColor("#000000").font("Helvetica-Bold").fontSize(10);
        doc.text("PACKAGE DELIVERABLES INCLUDED", 60, summaryY + 10);

        let delivX = 60;
        let delivY = summaryY + 30;
        Object.entries(totalDeliverables).forEach(([type, qty], idx) => {
          if (idx > 0 && idx % 3 === 0) {
            delivX = 60;
            delivY += 25;
          }
          doc.font("Helvetica-Bold").fontSize(12).fillColor("#1890ff");
          doc.text(String(qty), delivX, delivY);
          doc
            .font("Helvetica")
            .fontSize(8)
            .fillColor("#666666")
            .text(
              type.toUpperCase() + (qty > 1 ? "S" : ""),
              delivX,
              delivY + 12,
            );
          delivX += 90;
        });
        doc.moveDown(2);
      }

      // Notes Section
      if (invoice.notes) {
        doc.fontSize(11).font("Helvetica-Bold").fillColor("#000000");
        doc.text("Notes:", 50, doc.y);
        doc.moveDown(0.3);
        doc.fontSize(10).font("Helvetica").fillColor("#666666");
        doc.text(invoice.notes, 50, doc.y, { width: 500, align: "left" });
        doc.moveDown(1);
      }

      // Footer
      doc
        .moveTo(50, doc.y)
        .lineTo(550, doc.y)
        .strokeColor("#e8e8e8")
        .lineWidth(1)
        .stroke();
      doc.moveDown(1);

      doc
        .fontSize(11)
        .font("Helvetica")
        .fillColor("#666666")
        .text("Thank you for your business!", { align: "center" });

      if (tenantCompany?.email) {
        doc.moveDown(0.5);
        doc
          .fontSize(9)
          .font("Helvetica")
          .text(
            `For any queries, please contact us at ${tenantCompany.email}`,
            { align: "center" },
          );
      }

      // Subscription notice
      if (hasSubscription && invoice.items) {
        const subscriptionItems = invoice.items.filter(
          (item) =>
            item.billingType === "subscription" && item.subscriptionEndDate,
        );
        if (subscriptionItems.length > 0) {
          const dates = subscriptionItems.map(
            (item) => new Date(item.subscriptionEndDate),
          );
          const latestDate = new Date(Math.max(...dates));
          doc.moveDown(1);
          doc.fontSize(9).font("Helvetica").fillColor("#1890ff");
          doc.text(
            `Subscription Invoice - Renewal date: ${latestDate.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}`,
            { align: "center" },
          );
        }
      }

      // Finalize PDF
      doc.end();
    } catch (error) {
      reject(error);
    }
  });
};

/**
 * Generate PDF Sales Report
 * @param {Object} report - Sales report data
 * @param {Object} tenantCompany - Tenant company details
 * @returns {Promise<Buffer>} - PDF buffer
 */
const generateSalesReportPDF = async (report, tenantCompany) => {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: "A4",
        margin: 50,
        info: {
          Title: `Sales Report ${report.period.month}/${report.period.year}`,
          Author: tenantCompany?.name || "Sales System",
          Subject: `Monthly Sales Report`,
        },
      });

      const chunks = [];
      doc.on("data", (chunk) => chunks.push(chunk));
      doc.on("end", () => resolve(Buffer.concat(chunks)));
      doc.on("error", reject);

      // Header
      doc.fontSize(24).font("Helvetica-Bold").fillColor("#1890ff");
      doc.text("Monthly Sales Report", 50, 50, { align: "left" });

      doc.fontSize(12).font("Helvetica").fillColor("#000000");
      const monthNames = [
        "January",
        "February",
        "March",
        "April",
        "May",
        "June",
        "July",
        "August",
        "September",
        "October",
        "November",
        "December",
      ];
      doc.text(
        `${monthNames[report.period.month - 1]} ${report.period.year}`,
        50,
        80,
      );
      doc.text(
        `Generated: ${new Date(report.generatedAt).toLocaleDateString()}`,
        50,
        95,
      );

      // Company Info
      if (tenantCompany?.name) {
        doc.fontSize(10).fillColor("#666666");
        doc.text(`Company: ${tenantCompany.name}`, 50, 115);
      }

      let yPos = 150;

      // Overall Summary
      doc.fontSize(16).font("Helvetica-Bold").fillColor("#000000");
      doc.text("Overall Summary", 50, yPos);
      yPos += 25;

      doc.fontSize(10).font("Helvetica");
      const summary = report.summary || {};
      doc.text(
        `Total Target: Rs. ${(summary.totalTarget || 0).toLocaleString("en-IN")}`,
        50,
        yPos,
      );
      yPos += 15;
      doc.text(
        `Total Achieved: Rs. ${(summary.totalAchieved || 0).toLocaleString("en-IN")}`,
        50,
        yPos,
      );
      yPos += 15;
      doc.text(
        `Total Income: Rs. ${(summary.totalIncome || 0).toLocaleString("en-IN")}`,
        50,
        yPos,
      );
      yPos += 15;
      doc.text(
        `Pending Amount: Rs. ${(summary.totalPending || 0).toLocaleString("en-IN")}`,
        50,
        yPos,
      );
      yPos += 15;
      doc.text(
        `Total Profit: Rs. ${(summary.totalProfit || 0).toLocaleString("en-IN")}`,
        50,
        yPos,
      );
      yPos += 15;
      doc.text(
        `Average Profit %: ${(summary.averageProfitPercentage || 0).toFixed(2)}%`,
        50,
        yPos,
      );
      yPos += 30;

      // Team-wise Performance
      if (report.teamWise && report.teamWise.length > 0) {
        doc.fontSize(16).font("Helvetica-Bold");
        doc.text("Team-wise Performance", 50, yPos);
        yPos += 25;

        report.teamWise.forEach((team, index) => {
          if (yPos > 700) {
            doc.addPage();
            yPos = 50;
          }

          doc.fontSize(12).font("Helvetica-Bold");
          doc.text(`${team.team}`, 50, yPos);
          yPos += 15;

          doc.fontSize(10).font("Helvetica");
          doc.text(
            `Target: Rs. ${(team.totalTarget || 0).toLocaleString("en-IN")} | Achieved: Rs. ${(team.totalAchieved || 0).toLocaleString("en-IN")}`,
            50,
            yPos,
          );
          yPos += 12;
          doc.text(
            `Income: Rs. ${(team.totalIncome || 0).toLocaleString("en-IN")} | Profit: Rs. ${(team.totalProfit || 0).toLocaleString("en-IN")} (${(team.profitPercentage || 0).toFixed(2)}%)`,
            50,
            yPos,
          );
          yPos += 12;
          doc.text(
            `Achievement: ${(team.achievementPercentage || 0).toFixed(2)}%`,
            50,
            yPos,
          );
          yPos += 20;
        });
      }

      // Individual Performance
      if (report.individual && report.individual.length > 0) {
        if (yPos > 650) {
          doc.addPage();
          yPos = 50;
        }

        doc.fontSize(16).font("Helvetica-Bold");
        doc.text("Individual Performance", 50, yPos);
        yPos += 25;

        report.individual.slice(0, 10).forEach((target) => {
          if (yPos > 700) {
            doc.addPage();
            yPos = 50;
          }

          const userName = target.userId?.name || "N/A";
          doc.fontSize(10).font("Helvetica");
          doc.text(
            `${userName}: Target Rs. ${(target.targetAmount || 0).toLocaleString("en-IN")} | Achieved Rs. ${(target.achievedAmount || 0).toLocaleString("en-IN")} | Profit ${(target.profitPercentage || 0).toFixed(2)}%`,
            50,
            yPos,
          );
          yPos += 15;
        });
      }

      doc.end();
    } catch (error) {
      reject(error);
    }
  });
};

/**
 * Generate PDF for Profit & Loss Analytics
 * @param {Object} plData - Profit & Loss data
 * @param {Object} tenantCompany - Tenant company details
 * @param {Object} period - Period information (startDate, endDate, month, year)
 * @returns {Promise<Buffer>} - PDF buffer
 */
const generateProfitLossPDF = async (plData, tenantCompany, period = {}) => {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: "A4",
        margin: 50,
        info: {
          Title: "Profit & Loss Analytics Report",
          Author: tenantCompany?.name || "P&L System",
          Subject: "P&L Analytics Report",
        },
      });

      const chunks = [];
      doc.on("data", (chunk) => chunks.push(chunk));
      doc.on("end", () => resolve(Buffer.concat(chunks)));
      doc.on("error", reject);

      // Header
      doc.fontSize(24).font("Helvetica-Bold").fillColor("#1890ff");
      doc.text("Profit & Loss Analytics", 50, 50, { align: "left" });

      doc.fontSize(12).font("Helvetica").fillColor("#000000");

      // Period information
      let periodText = "";
      if (period.month && period.year) {
        const monthNames = [
          "January",
          "February",
          "March",
          "April",
          "May",
          "June",
          "July",
          "August",
          "September",
          "October",
          "November",
          "December",
        ];
        periodText = `${monthNames[period.month - 1]} ${period.year}`;
      } else if (period.startDate && period.endDate) {
        const start = new Date(period.startDate);
        const end = new Date(period.endDate);
        periodText = `${start.toLocaleDateString()} - ${end.toLocaleDateString()}`;
      } else {
        periodText = "All Time";
      }

      doc.text(`Period: ${periodText}`, 50, 80);
      doc.text(`Generated: ${new Date().toLocaleDateString()}`, 50, 95);

      // Company Info
      if (tenantCompany?.name) {
        doc.fontSize(10).fillColor("#666666");
        doc.text(`Company: ${tenantCompany.name}`, 50, 115);
      }

      let yPos = 150;

      // Helper function to handle page breaks
      const checkPageBreak = (neededHeight = 100) => {
        if (yPos + neededHeight > 780) {
          doc.addPage();
          yPos = 50;
          return true;
        }
        return false;
      };

      // Helper function to draw table header
      const drawTableHeader = (headers, columnWidths, startX, y) => {
        doc.fontSize(10).font("Helvetica-Bold").fillColor("#000000");
        let currentX = startX;
        headers.forEach((header, i) => {
          doc.text(header, currentX, y, { width: columnWidths[i] });
          currentX += columnWidths[i];
        });
        doc.moveTo(startX, y + 15).lineTo(startX + currentX - startX, y + 15).strokeColor("#cccccc").lineWidth(1).stroke();
        return y + 20;
      };

      // Key Metrics Section
      doc.fontSize(16).font("Helvetica-Bold").fillColor("#000000");
      doc.text("1. Overall Financial Summary", 50, yPos);
      yPos += 20;
      doc.moveTo(50, yPos).lineTo(550, yPos).strokeColor("#1890ff").lineWidth(2).stroke();
      yPos += 15;

      doc.fontSize(10).font("Helvetica");

      const tunepathRevenue = plData.tunepathRevenue || 0;
      const askEvaRevenue = plData.includeGstRevenue || 0;
      const totalRevenue = plData.totalRevenue || 0;
      const isAskEva = plData.isAskEva || false;

      // Summary Table Layout
      const summaryLeftX = 50;
      const summaryRightX = 320;
      let leftY = yPos;
      let rightY = yPos;

      // Left Column: Revenue & Collections
      doc.font("Helvetica-Bold").fillColor("#1890ff").fontSize(12).text("Revenue & Collections", summaryLeftX, leftY);
      leftY += 18;
      
      doc.fontSize(10);
      doc.font("Helvetica-Bold").fillColor("#333333").text("Core Revenue:", summaryLeftX, leftY); leftY += 15;
      doc.font("Helvetica").fillColor("#666666");
      if (tunepathRevenue > 0) {
        doc.text(`• ${tenantCompany?.name || 'Company'} (Non-GST): Rs. ${tunepathRevenue.toLocaleString("en-IN", { minimumFractionDigits: 2 })}`, summaryLeftX + 10, leftY); leftY += 15;
      }
      if (askEvaRevenue > 0) {
        doc.text(`• Ask Eva (GST): Rs. ${askEvaRevenue.toLocaleString("en-IN", { minimumFractionDigits: 2 })}`, summaryLeftX + 10, leftY); leftY += 15;
      }
      
      leftY += 5;
      // Total Revenue is exactly what is used for Profit calculation
      doc.font("Helvetica-Bold").fillColor("#1890ff").text(`Total Revenue: Rs. ${totalRevenue.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, summaryLeftX, leftY);
      leftY += 20;

      // Pass-through / Informational Collections
      doc.font("Helvetica-Bold").fillColor("#333333").text("Other Collections (Not in Revenue):", summaryLeftX, leftY); leftY += 15;
      doc.font("Helvetica").fillColor("#666666");
      doc.text(`• Ad Campaigns: Rs. ${(plData.totalCampaignAmount || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}`, summaryLeftX + 10, leftY); leftY += 15;
      doc.text(`• Domain Purchases: Rs. ${(plData.totalDomainPurchaseAmount || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}`, summaryLeftX + 10, leftY); leftY += 15;
      doc.text(`• GST Collected: Rs. ${(plData.totalGST || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}`, summaryLeftX + 10, leftY); leftY += 20;

      // Right Column: Expenses, Profit & Cash Flow
      doc.font("Helvetica-Bold").fillColor("#1890ff").fontSize(12).text("Profitability & Cash Flow", summaryRightX, rightY);
      rightY += 18;

      doc.fontSize(10);
      doc.font("Helvetica-Bold").fillColor("#333333").text("P&L Calculation:", summaryRightX, rightY); rightY += 15;
      
      // Breakdown calculation clearly
      doc.font("Helvetica").fillColor("#666666").text(`  Total Revenue:`, summaryRightX, rightY);
      doc.text(`Rs. ${totalRevenue.toLocaleString("en-IN", { minimumFractionDigits: 2 })}`, summaryRightX + 120, rightY, { align: 'right', width: 80 }); rightY += 15;
      
      doc.fillColor("#cf1322").text(`- Total Expenses:`, summaryRightX, rightY);
      doc.text(`Rs. ${(plData.totalExpenses || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}`, summaryRightX + 120, rightY, { align: 'right', width: 80 }); rightY += 15;
      
      doc.moveTo(summaryRightX, rightY).lineTo(summaryRightX + 200, rightY).strokeColor("#cccccc").lineWidth(1).stroke();
      rightY += 10;
      
      const profit = plData.profit !== undefined ? plData.profit : totalRevenue - (plData.totalExpenses || 0);
      const profitColor = profit >= 0 ? "#3f8600" : "#cf1322";
      
      doc.font("Helvetica-Bold").fillColor(profitColor).text(`Net Profit/Loss:`, summaryRightX, rightY);
      doc.text(`Rs. ${profit.toLocaleString("en-IN", { minimumFractionDigits: 2 })}`, summaryRightX + 120, rightY, { align: 'right', width: 80 }); rightY += 15;

      const profitPercentage = plData.profitPercentage !== undefined ? plData.profitPercentage : (totalRevenue > 0 ? (profit / totalRevenue) * 100 : (profit < 0 ? -100 : 0));
      
      // Profit Margin Box
      doc.rect(summaryRightX, rightY + 5, 200, 25).fillColor(profit >= 0 ? "#f6ffed" : "#fff1f0").fill();
      doc.font("Helvetica-Bold").fillColor(profitColor).text(`Profit Margin: ${profitPercentage.toFixed(2)}%`, summaryRightX, rightY + 13, { width: 200, align: 'center' });
      rightY += 45;

      // Cash Flow / Payment Collection
      doc.font("Helvetica-Bold").fillColor("#333333").text("Cash Flow Summary:", summaryRightX, rightY); rightY += 15;
      doc.font("Helvetica").fillColor("#3f8600").text(`• Amount Collected: Rs. ${(plData.totalCollectedAmount || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}`, summaryRightX + 10, rightY); rightY += 15;
      doc.fillColor("#cf1322").text(`• Amount Pending: Rs. ${(plData.totalPendingAmount || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}`, summaryRightX + 10, rightY); rightY += 15;

      yPos = Math.max(leftY, rightY) + 10;

      // Explanation Box
      checkPageBreak(50);
      doc.rect(50, yPos, 500, 35).fillColor("#f0f5ff").fill();
      doc.fillColor("#1890ff").fontSize(9).font("Helvetica-Oblique").text("Note: 'Other Collections' such as Campaign ad-spend or Domains are pass-through expenses paid by clients and are excluded from Core Revenue to accurately reflect operating profit.", 60, yPos + 10, { width: 480 });
      yPos += 55;

      // 2. Team-wise Breakdown
      checkPageBreak(150);
      doc.fontSize(16).font("Helvetica-Bold").fillColor("#000000");
      doc.text("2. Department / Team-wise Breakdown", 50, yPos);
      yPos += 20;
      doc.moveTo(50, yPos).lineTo(550, yPos).strokeColor("#1890ff").lineWidth(2).stroke();
      yPos += 15;

      if (plData.teamBreakdown && plData.teamBreakdown.length > 0) {
        const headers = ["Department", "Variable Exp.", "Fixed Exp.", "Total Exp.", "Team Revenue", "Team Profit", "Margin"];
        const colWidths = [120, 70, 70, 70, 75, 75, 45];
        yPos = drawTableHeader(headers, colWidths, 50, yPos);

        doc.fontSize(9).font("Helvetica");
        plData.teamBreakdown.forEach((team) => {
          if (checkPageBreak(40)) {
            yPos = drawTableHeader(headers, colWidths, 50, yPos);
            doc.fontSize(9).font("Helvetica");
          }

          const teamProfit = team.profit || 0;
          const pColor = teamProfit >= 0 ? "#3f8600" : "#cf1322";

          let cx = 50;
          doc.fillColor("#000000").text(team.teamLabel || "N/A", cx, yPos, { width: colWidths[0] }); cx += colWidths[0];
          doc.text((team.variableExpense || 0).toLocaleString("en-IN"), cx, yPos, { width: colWidths[1]-5 }); cx += colWidths[1];
          doc.text((team.fixedExpenseAllocated || 0).toLocaleString("en-IN"), cx, yPos, { width: colWidths[2]-5 }); cx += colWidths[2];
          doc.text((team.totalExpense || 0).toLocaleString("en-IN"), cx, yPos, { width: colWidths[3]-5 }); cx += colWidths[3];
          doc.text((team.revenue || 0).toLocaleString("en-IN"), cx, yPos, { width: colWidths[4]-5 }); cx += colWidths[4];
          doc.fillColor(pColor).text(teamProfit.toLocaleString("en-IN"), cx, yPos, { width: colWidths[5]-5 }); cx += colWidths[5];
          doc.text(`${(team.profitPercentage || 0).toFixed(2)}%`, cx, yPos, { width: colWidths[6]-5 });
          
          yPos += 20;
        });
        yPos += 20;
      }

      // 3. Itemized Fixed Expenses
      checkPageBreak(150);
      doc.fontSize(16).font("Helvetica-Bold").fillColor("#000000");
      doc.text("3. Itemized Fixed Expenses", 50, yPos);
      yPos += 20;
      doc.moveTo(50, yPos).lineTo(550, yPos).strokeColor("#1890ff").lineWidth(2).stroke();
      yPos += 15;

      if (plData.fixedExpenses && plData.fixedExpenses.length > 0) {
        const headers = ["Date", "Category", "Description", "Amount (Rs.)"];
        const colWidths = [80, 120, 200, 100];
        yPos = drawTableHeader(headers, colWidths, 50, yPos);

        doc.fontSize(9).font("Helvetica");
        let sumFixed = 0;
        plData.fixedExpenses.forEach((exp) => {
          if (checkPageBreak(40)) {
            yPos = drawTableHeader(headers, colWidths, 50, yPos);
            doc.fontSize(9).font("Helvetica");
          }
          let cx = 50;
          doc.fillColor("#000000").text(exp.date ? new Date(exp.date).toLocaleDateString("en-GB") : "N/A", cx, yPos, { width: colWidths[0] }); cx += colWidths[0];
          doc.text((exp.category || "General").replace(/_/g, ' ').toUpperCase(), cx, yPos, { width: colWidths[1] }); cx += colWidths[1];
          doc.text(exp.notes || exp.description || "-", cx, yPos, { width: colWidths[2]-5 }); cx += colWidths[2];
          doc.text((exp.amount || 0).toLocaleString("en-IN", {minimumFractionDigits: 2}), cx, yPos, { width: colWidths[3], align: "right" });
          sumFixed += (exp.amount || 0);
          yPos += 20;
        });
        
        doc.moveTo(50, yPos).lineTo(550, yPos).strokeColor("#e8e8e8").lineWidth(1).stroke();
        yPos += 10;
        doc.font("Helvetica-Bold").text("Total Fixed Expenses:", 250, yPos, { width: 120, align: "right" });
        doc.text(sumFixed.toLocaleString("en-IN", {minimumFractionDigits: 2}), 380, yPos, { width: 170, align: "right" });
        yPos += 30;
      } else {
        doc.fontSize(10).font("Helvetica-Oblique").fillColor("#666666").text("No fixed expenses found for this period.", 50, yPos);
        yPos += 30;
      }

      // 4. Itemized Variable Expenses
      checkPageBreak(150);
      doc.fontSize(16).font("Helvetica-Bold").fillColor("#000000");
      doc.text("4. Itemized Variable Expenses", 50, yPos);
      yPos += 20;
      doc.moveTo(50, yPos).lineTo(550, yPos).strokeColor("#1890ff").lineWidth(2).stroke();
      yPos += 15;

      if (plData.variableExpenses && plData.variableExpenses.length > 0) {
        const headers = ["Date", "Staff / Beneficiary", "Description", "Amount (Rs.)"];
        const colWidths = [80, 150, 170, 100];
        yPos = drawTableHeader(headers, colWidths, 50, yPos);

        doc.fontSize(9).font("Helvetica");
        let sumVariable = 0;
        plData.variableExpenses.forEach((exp) => {
          if (checkPageBreak(40)) {
            yPos = drawTableHeader(headers, colWidths, 50, yPos);
            doc.fontSize(9).font("Helvetica");
          }
          let cx = 50;
          doc.fillColor("#000000").text(exp.date ? new Date(exp.date).toLocaleDateString("en-GB") : "N/A", cx, yPos, { width: colWidths[0] }); cx += colWidths[0];
          doc.text(exp.staffId ? exp.staffId.name : "Others/N/A", cx, yPos, { width: colWidths[1] }); cx += colWidths[1];
          doc.text(exp.notes || exp.description || "-", cx, yPos, { width: colWidths[2]-5 }); cx += colWidths[2];
          doc.text((exp.amount || 0).toLocaleString("en-IN", {minimumFractionDigits: 2}), cx, yPos, { width: colWidths[3], align: "right" });
          sumVariable += (exp.amount || 0);
          yPos += 20;
        });

        doc.moveTo(50, yPos).lineTo(550, yPos).strokeColor("#e8e8e8").lineWidth(1).stroke();
        yPos += 10;
        doc.font("Helvetica-Bold").text("Total Variable Expenses:", 250, yPos, { width: 120, align: "right" });
        doc.text(sumVariable.toLocaleString("en-IN", {minimumFractionDigits: 2}), 380, yPos, { width: 170, align: "right" });
        yPos += 30;
      } else {
        doc.fontSize(10).font("Helvetica-Oblique").fillColor("#666666").text("No variable expenses found for this period.", 50, yPos);
        yPos += 30;
      }

      // End of Report Message
      checkPageBreak(50);
      doc.moveTo(50, yPos).lineTo(550, yPos).strokeColor("#cccccc").lineWidth(1).stroke();
      yPos += 15;
      doc.fontSize(10).font("Helvetica-Oblique").fillColor("#888888").text("--- End of Report ---", 50, yPos, { align: "center" });

      doc.end();
    } catch (error) {
      reject(error);
    }
  });
};

module.exports = {
  generateInvoicePDF,
  generateSalesReportPDF,
  generateProfitLossPDF,
};
