const PLEntry = require("./pl.model");
const Project = require("../projects/project.model");
const Invoice = require("../invoices/invoice.model");
const Task = require("../tasks/task.model");
const User = require("../auth/user.model");

// Role hourly cost mapping (can be moved to config or database)
const ROLE_HOURLY_COST = {
  admin: 0, // Admin time not typically billed
  digital_marketing_manager: 1500,
  digital_marketing_executive: 1000,
  designer: 1200,
  editor: 1000,
  developer: 2000,
  operations_head: 1800,
  sales_manager: 0,
  salesperson: 0,
};

/**
 * Calculate P&L for a project
 * @param {String} projectId - Project ID
 * @param {String} tenantCompanyId - Tenant company ID
 */
const calculateProjectPL = async (projectId, tenantCompanyId) => {
  const project = await Project.findById(projectId)
    .populate("invoiceId")
    .populate("masterItemId");

  if (!project) {
    throw new Error("Project not found");
  }

  const invoice = project.invoiceId;

  // Handle revenue gracefully if there is no invoice yet
  let revenue = {
    invoiceAmount: 0,
    taxes: 0,
    discounts: 0,
    netRevenue: 0,
  };

  if (invoice) {
    const taxAmount =
      typeof invoice.tax === "object" && invoice.tax !== null
        ? invoice.tax.total || 0
        : invoice.tax || 0;

    const hasCampaignItems = (invoice.items || []).some(
      (item) => item.category === "campaign",
    );
    const campaignAmount = Number(invoice.campaignAmount) || 0;
    const rawHandling =
      invoice.handlingAmount !== undefined && invoice.handlingAmount !== null
        ? invoice.handlingAmount
        : invoice.subtotal || 0;

    const netRevenue =
      !hasCampaignItems && campaignAmount > 0
        ? Math.max(0, rawHandling - campaignAmount)
        : rawHandling;

    revenue = {
      invoiceAmount: invoice.total,
      taxes: taxAmount,
      discounts: 0,
      netRevenue: netRevenue,
    };
  }

  // Cost side
  // 1. Staff cost (from tasks)
  const tasks = await Task.find({ projectId });
  let staffCost = 0;
  for (const task of tasks) {
    if (task.timeSpent && task.assignedTo) {
      const user = await User.findById(task.assignedTo).select("role");
      if (user) {
        const roleCost = ROLE_HOURLY_COST[user.role] || 0;
        staffCost += task.timeSpent * roleCost;
      }
    }
  }

  // 2. Correction cost (if internal mistakes)
  const correctionCost = 0; // Corrections module not available in new CRM

  // 3. Campaign actual spend (from campaigns linked to this project or client)
  const Campaign = require("../campaigns/campaign.model");
  const projectCampaigns = await Campaign.find({
    $or: [{ projectId }, { clientCompanyId: project.clientId }],
    companyId: tenantCompanyId,
  });

  const campaignSpend = projectCampaigns.reduce(
    (sum, camp) => sum + (camp.actualSpend || 0),
    0,
  );

  // 4. Platform cost (ads, tools - can be added later)
  const platformCost = 0;

  const totalCost = staffCost + correctionCost + platformCost; // Exclude campaignSpend which is a pass-through

  // Calculate profit
  const grossProfit = revenue.netRevenue - totalCost;
  const netProfit = revenue.invoiceAmount - totalCost;
  const marginPercent =
    revenue.netRevenue > 0 ? (grossProfit / revenue.netRevenue) * 100 : 0;

  // Create/Update P&L entry
  const period = {
    month: new Date().getMonth() + 1,
    year: new Date().getFullYear(),
  };

  const plEntry = await PLEntry.findOneAndUpdate(
    { projectId, tenantCompanyId },
    {
      tenantCompanyId,
      projectId,
      invoiceId: invoice._id,
      entryType: "revenue",
      revenue,
      cost: {
        staffCost,
        correctionCost,
        campaignSpend,
        platformCost,
        otherCost: 0,
        totalCost,
      },
      grossProfit,
      netProfit,
      marginPercent,
      period,
      calculatedAt: new Date(),
    },
    { upsert: true, returnDocument: 'after' },
  );

  return plEntry;
};

/**
 * Update P&L from payment
 * @param {Object} payment - Payment transaction
 * @param {String} tenantCompanyId - Tenant company ID
 */
const updatePLFromPayment = async (payment, tenantCompanyId) => {
  const invoice = await Invoice.findById(payment.invoiceId);

  if (!invoice) {
    return; // Invoice not found, skip
  }

  // Find or create P&L entry for this invoice
  // Use closingInvoiceDate if set (to credit revenue to the intended month),
  // otherwise fall back to paymentDate.
  const periodDate = payment.closingInvoiceDate || payment.paymentDate;
  const period = {
    month: periodDate.getMonth() + 1,
    year: periodDate.getFullYear(),
  };

  // Get project for this invoice (if exists)
  const project = await Project.findOne({
    invoiceId: invoice._id,
    tenantCompanyId,
  });

  if (project) {
    // Recalculate project P&L
    await calculateProjectPL(project._id, tenantCompanyId);
  } else {
    // Create revenue-only entry if no project
    await PLEntry.findOneAndUpdate(
      { invoiceId: invoice._id, tenantCompanyId },
      {
        tenantCompanyId,
        invoiceId: invoice._id,
        entryType: "revenue",
        revenue: {
          invoiceAmount: payment.amount,
          taxes: 0,
          discounts: 0,
          netRevenue: payment.amount,
        },
        cost: {
          staffCost: 0,
          correctionCost: 0,
          platformCost: 0,
          otherCost: 0,
          totalCost: 0,
        },
        grossProfit: payment.amount,
        netProfit: payment.amount,
        marginPercent: 100,
        period,
        calculatedAt: new Date(),
      },
      { upsert: true, returnDocument: 'after' },
    );
  }
};

/**
 * Get P&L summary for a period
 * @param {String} tenantCompanyId - Tenant company ID
 * @param {Number} month - Month (1-12)
 * @param {Number} year - Year
 */
const getPLSummary = async (tenantCompanyId, month, year) => {
  const plEntries = await PLEntry.find({
    tenantCompanyId,
    "period.month": month,
    "period.year": year,
  })
    .populate("projectId", "name")
    .populate("invoiceId", "invoiceNumber");

  const summary = {
    totalRevenue: 0,
    totalTaxes: 0,
    totalDiscounts: 0,
    netRevenue: 0,
    totalStaffCost: 0,
    totalCorrectionCost: 0,
    totalPlatformCost: 0,
    totalOtherCost: 0,
    totalCost: 0,
    grossProfit: 0,
    netProfit: 0,
    marginPercent: 0,
    projectCount: 0,
    entries: plEntries,
  };

  plEntries.forEach((entry) => {
    if (entry.revenue) {
      summary.totalRevenue += entry.revenue.invoiceAmount || 0;
      summary.totalTaxes += entry.revenue.taxes || 0;
      summary.totalDiscounts += entry.revenue.discounts || 0;
      summary.netRevenue += entry.revenue.netRevenue || 0;
    }

    if (entry.cost) {
      summary.totalStaffCost += entry.cost.staffCost || 0;
      summary.totalCorrectionCost += entry.cost.correctionCost || 0;
      summary.totalPlatformCost += entry.cost.platformCost || 0;
      summary.totalOtherCost += entry.cost.otherCost || 0;
      summary.totalCost += entry.cost.totalCost || 0;
    }

    summary.grossProfit += entry.grossProfit || 0;
    summary.netProfit += entry.netProfit || 0;

    if (entry.projectId) {
      summary.projectCount++;
    }
  });

  // Calculate overall margin
  summary.marginPercent =
    summary.netRevenue > 0
      ? (summary.grossProfit / summary.netRevenue) * 100
      : 0;

  return summary;
};

/**
 * Get P&L for a project
 * @param {String} projectId - Project ID
 * @param {String} tenantCompanyId - Tenant company ID
 */
const getProjectPL = async (projectId, tenantCompanyId) => {
  const plEntry = await PLEntry.findOne({
    projectId,
    tenantCompanyId,
  })
    .populate("projectId", "name status")
    .populate("invoiceId", "invoiceNumber total");

  if (!plEntry) {
    // Calculate if not exists
    return await calculateProjectPL(projectId, tenantCompanyId);
  }

  return plEntry;
};

module.exports = {
  calculateProjectPL,
  updatePLFromPayment,
  getPLSummary,
  getProjectPL,
};
