const Expense = require("./expense.model");
const SalaryHistory = require("./salaryHistory.model");
const Invoice = require("../invoices/invoice.model");

// Mocking legacy invoiceService methods to work with new Invoice schema
const invoiceService = {
  extractHandling: (inv) => {
    const masterItems = inv?.proposalId?.masterItems || [];
    const campaignAmount = masterItems.reduce((acc, item) => acc + (item.isCampaign ? (item.campaignDetails?.campaignAmount || 0) : 0), 0);
    return Math.max(0, (inv?.grandTotal || 0) - campaignAmount);
  },
  extractCampaign: (inv) => {
    const masterItems = inv?.proposalId?.masterItems || [];
    return masterItems.reduce((acc, item) => acc + (item.isCampaign ? (item.campaignDetails?.campaignAmount || 0) : 0), 0);
  },
  getInvoiceGrandTotal: (inv) => inv?.grandTotal || 0,
  
  getVerifiedTransactionsForPL: async (companyId, filters) => {
    const Transaction = require("../transactions/transaction.model");
    const query = {
      $or: [
        { agencyId: companyId },
        { adminId: companyId },
        { brandId: companyId }
      ],
      status: 'Verified',
      invoiceId: { $ne: null }
    };
    if (filters && filters.startDate && filters.endDate) {
      query.paymentDate = { $gte: new Date(filters.startDate), $lte: new Date(filters.endDate) };
    }
    return await Transaction.find(query).populate({
      path: 'invoiceId',
      populate: { path: 'proposalId', populate: { path: 'masterItems' } }
    });
  },

  getDeDuplicatedInvoicesForPL: async (companyId, filters) => {
    const query = { 
      $or: [
        { agencyId: companyId },
        { adminId: companyId },
        { brandId: companyId }
      ],
      isDeleted: false
    };
    if (filters && filters.statuses) {
      const mappedStatuses = filters.statuses.map(s => s.charAt(0).toUpperCase() + s.toLowerCase().slice(1));
      query.invoiceStatus = { $in: mappedStatuses };
    }
    if (filters && filters.startDate && filters.endDate) {
      query.createdAt = { $gte: new Date(filters.startDate), $lte: new Date(filters.endDate) };
    }
    return await Invoice.find(query).populate({
      path: 'proposalId',
      populate: { path: 'masterItems' }
    });
  },

  calculatePaymentAmounts: async (invoiceIds) => {
    const Transaction = require("../transactions/transaction.model");
    const transactions = await Transaction.find({ invoiceId: { $in: invoiceIds } });
    const collected = {};
    const pending = {};
    transactions.forEach(tx => {
      const invId = tx.invoiceId.toString();
      if (tx.status === 'Verified') {
        collected[invId] = (collected[invId] || 0) + tx.amount;
      } else if (tx.status === 'Pending') {
        pending[invId] = (pending[invId] || 0) + tx.amount;
      }
    });
    return { collected, pending };
  }
};

const {
  buildQuery,
  executePaginatedQuery,
} = require("../../utils/pagination.helper");

const getAllExpenses = async (companyId, reqQuery = {}) => {
  const additionalFilters = { companyId };

  // Filter by category
  if (reqQuery.category) additionalFilters.category = reqQuery.category;

  // Filter by department
  if (reqQuery.department) additionalFilters.department = reqQuery.department;

  // Filter by referral
  if (reqQuery.isReferral !== undefined) {
    additionalFilters["referral.isReferral"] =
      reqQuery.isReferral === true || reqQuery.isReferral === "true";
  }

  // Filter by expense type (fixed/variable)
  if (reqQuery.expenseType) {
    additionalFilters.expenseType = reqQuery.expenseType;
  }
  // Legacy support: filter by 'type' query param
  if (reqQuery.type && !reqQuery.expenseType) {
    if (reqQuery.type === "fixed") {
      additionalFilters.$or = [
        { expenseType: "fixed" },
        {
          category: {
            $in: [
              "rent",
              "electricity",
              "eb",
              "internet",
              "water",
              "utilities",
            ],
          },
        },
        { type: { $in: ["rent", "electricity", "telephone", "other"] } },
      ];
    } else if (reqQuery.type === "variable") {
      additionalFilters.$or = [
        { expenseType: "variable" },
        {
          category: {
            $in: ["salaries", "sales_team_salaries", "sales_team_salary"],
          },
        },
        { staffId: { $exists: true, $ne: null } },
      ];
    }
  }

  // Filter by staffId (for variable expenses - employee salaries)
  if (reqQuery.staffId) {
    additionalFilters.staffId = reqQuery.staffId;
  }

  // Date range filter
  if (reqQuery.startDate && reqQuery.endDate) {
    additionalFilters.date = {
      $gte: new Date(reqQuery.startDate),
      $lte: new Date(reqQuery.endDate),
    };
  } else if (reqQuery.startDate) {
    additionalFilters.date = { $gte: new Date(reqQuery.startDate) };
  } else if (reqQuery.endDate) {
    additionalFilters.date = { $lte: new Date(reqQuery.endDate) };
  }

  // Build query with pagination, search, and sort
  const queryOptions = buildQuery(reqQuery, {
    searchFields: ["description", "category", "vendor"],
    defaultSortField: "date",
    defaultSortOrder: "desc",
    additionalFilters,
  });

  // Execute paginated query with populate
  return await executePaginatedQuery(Expense, queryOptions, [
    { path: "createdBy", select: "name email" },
    { path: "staffId", select: "name email" },
    { path: "referral.referralId", select: "name email" },
  ]);
};

// Dropdown query for expenses (if needed)
const getExpensesDropdown = async (companyId, reqQuery = {}) => {
  const query = { companyId };
  if (reqQuery.category) query.category = reqQuery.category;
  if (reqQuery.search) {
    query.description = { $regex: reqQuery.search, $options: "i" };
  }

  const limit = parseInt(reqQuery.limit) || 20;

  return await Expense.find(query)
    .sort({ date: -1 })
    .limit(limit)
    .select("description category amount date");
};

const createExpense = async (expenseData, companyId, userId) => {
  // Clean up null/undefined values for enum fields
  const cleanedData = { ...expenseData };
  if (
    cleanedData.department === null ||
    cleanedData.department === undefined ||
    cleanedData.department === ""
  ) {
    delete cleanedData.department;
  }
  if (
    cleanedData.paymentMethod === null ||
    cleanedData.paymentMethod === undefined ||
    cleanedData.paymentMethod === ""
  ) {
    delete cleanedData.paymentMethod;
  }

  // Validation: For variable expenses (salaries), prevent duplicate entries for same employee in same month
  if (cleanedData.expenseType === "variable" && cleanedData.staffId) {
    const expenseDate = new Date(cleanedData.date);
    const startOfMonth = new Date(
      expenseDate.getFullYear(),
      expenseDate.getMonth(),
      1,
    );
    const endOfMonth = new Date(
      expenseDate.getFullYear(),
      expenseDate.getMonth() + 1,
      0,
      23,
      59,
      59,
    );

    // Check if there's already an expense for this employee in this month
    const existingExpense = await Expense.findOne({
      companyId,
      expenseType: "variable",
      staffId: cleanedData.staffId,
      date: {
        $gte: startOfMonth,
        $lte: endOfMonth,
      },
    }).populate("staffId", "name email");

    if (existingExpense) {
      const employeeName = existingExpense.staffId?.name || "this employee";
      const monthName = expenseDate.toLocaleString("default", {
        month: "long",
        year: "numeric",
      });
      throw new Error(
        `Salary for ${employeeName} has already been added for ${monthName}. Each employee can only have one salary entry per month.`,
      );
    }

    // Check if this is the first salary entry for this employee (to create initial history)
    const previousExpense = await Expense.findOne({
      companyId,
      expenseType: "variable",
      staffId: cleanedData.staffId,
    }).sort({ date: -1 }); // Get most recent salary entry

    // Create expense first
    const newExpense = await Expense.create({
      ...cleanedData,
      companyId,
      createdBy: userId,
    });

    // Always create salary history entry for variable expenses
    // If this is the first entry, mark as 'initial'
    // If there's a previous entry, compare amounts to determine change type
    if (!previousExpense) {
      // First salary entry for this employee - create initial history
      await SalaryHistory.create({
        staffId: cleanedData.staffId,
        companyId,
        oldSalary: 0,
        newSalary: cleanedData.amount,
        effectiveDate: expenseDate,
        expenseId: newExpense._id,
        changeType: "initial",
        reason: cleanedData.reason || cleanedData.notes || null,
        notes: cleanedData.notes || null,
        createdBy: userId,
      });
    } else if (previousExpense.amount !== cleanedData.amount) {
      // Amount changed - create history entry
      const changeType =
        cleanedData.amount > previousExpense.amount ? "increment" : "decrement";
      await SalaryHistory.create({
        staffId: cleanedData.staffId,
        companyId,
        oldSalary: previousExpense.amount,
        newSalary: cleanedData.amount,
        effectiveDate: expenseDate,
        expenseId: newExpense._id,
        changeType,
        reason: cleanedData.reason || cleanedData.notes || null,
        notes: cleanedData.notes || null,
        createdBy: userId,
      });
    }
    // If amount is same as previous, we don't create history (no change)

    return newExpense;
  }

  return await Expense.create({
    ...cleanedData,
    companyId,
    createdBy: userId,
  });
};

const updateExpense = async (expenseId, expenseData, companyId) => {
  const expense = await Expense.findOne({ _id: expenseId, companyId });
  if (!expense) {
    throw new Error("Expense not found");
  }

  // Clean up null/undefined values for enum fields
  const cleanedData = { ...expenseData };
  if (
    cleanedData.department === null ||
    cleanedData.department === undefined ||
    cleanedData.department === ""
  ) {
    cleanedData.department = undefined; // Set to undefined to remove the field
  }
  if (
    cleanedData.paymentMethod === null ||
    cleanedData.paymentMethod === undefined ||
    cleanedData.paymentMethod === ""
  ) {
    cleanedData.paymentMethod = undefined; // Set to undefined to remove the field
  }

  // Validation: For variable expenses (salaries), prevent duplicate entries for same employee in same month
  // BUT: Allow updating the existing expense (exclude current expense from duplicate check)
  if (cleanedData.expenseType === "variable" && cleanedData.staffId) {
    const expenseDate = cleanedData.date
      ? new Date(cleanedData.date)
      : expense.date;
    const startOfMonth = new Date(
      expenseDate.getFullYear(),
      expenseDate.getMonth(),
      1,
    );
    const endOfMonth = new Date(
      expenseDate.getFullYear(),
      expenseDate.getMonth() + 1,
      0,
      23,
      59,
      59,
    );

    // Check if there's already another expense for this employee in this month (excluding current expense)
    const existingExpense = await Expense.findOne({
      companyId,
      expenseType: "variable",
      staffId: cleanedData.staffId,
      date: {
        $gte: startOfMonth,
        $lte: endOfMonth,
      },
      _id: { $ne: expenseId }, // Exclude current expense
    }).populate("staffId", "name email");

    if (existingExpense) {
      const employeeName = existingExpense.staffId?.name || "this employee";
      const monthName = expenseDate.toLocaleString("default", {
        month: "long",
        year: "numeric",
      });
      throw new Error(
        `Salary for ${employeeName} has already been added for ${monthName}. Each employee can only have one salary entry per month.`,
      );
    }

    // Track salary change history if amount changed
    const oldAmount = expense.amount || 0;
    const newAmount =
      cleanedData.amount !== undefined ? cleanedData.amount : oldAmount;

    // Only create history if amount actually changed
    if (oldAmount !== newAmount) {
      // Determine change type
      let changeType = "adjustment";
      if (oldAmount === 0) {
        changeType = "initial"; // First time setting salary
      } else if (newAmount > oldAmount) {
        changeType = "increment";
      } else if (newAmount < oldAmount) {
        changeType = "decrement";
      }

      // Get the user who is making the update (from request, or use expense creator)
      const updatedBy = cleanedData.updatedBy || expense.createdBy;

      // Create salary history entry
      await SalaryHistory.create({
        staffId: cleanedData.staffId || expense.staffId,
        companyId,
        oldSalary: oldAmount,
        newSalary: newAmount,
        effectiveDate: expenseDate,
        expenseId: expenseId,
        changeType,
        reason: cleanedData.reason || cleanedData.notes || null,
        notes: cleanedData.notes || null,
        createdBy: updatedBy,
      });
    }
  }

  Object.assign(expense, cleanedData);
  return await expense.save();
};

const deleteExpense = async (expenseId, companyId) => {
  const expense = await Expense.findOne({ _id: expenseId, companyId });
  if (!expense) {
    throw new Error("Expense not found");
  }
  return await Expense.deleteOne({ _id: expenseId, companyId });
};

const getExpenseStats = async (companyId, filters = {}) => {
  const query = { companyId };

  // Filter by department
  if (filters.department) query.department = filters.department;

  // Date range filter
  if (filters.startDate && filters.endDate) {
    query.date = {
      $gte: new Date(filters.startDate),
      $lte: new Date(filters.endDate),
    };
  } else if (filters.startDate) {
    query.date = { $gte: new Date(filters.startDate) };
  } else if (filters.endDate) {
    query.date = { $lte: new Date(filters.endDate) };
  }

  const allExpenses = await Expense.find(query).populate(
    "staffId",
    "name email role team",
  );

  // Calculate totals
  const totalExpenses = allExpenses.reduce(
    (sum, exp) => sum + (exp.amount || 0),
    0,
  );

  // Fixed expenses: expenses with expenseType='fixed' or legacy fixed categories
  const fixedExpenses = allExpenses.filter((exp) => {
    if (exp.expenseType === "fixed") return true;
    // Legacy support
    const isFixedCategory = [
      "rent",
      "electricity",
      "eb",
      "internet",
      "water",
      "utilities",
      "maintenance",
      "tea_coffee",
      "maid",
      "transport",
      "ceo_salary",
      "bde_salary",
      "oh_salary",
      "oh_incentive",
      "om_salary",
      "hr_account",
      "campaign_ads",
      "hosting",
      "domain_purchase",
      "domain_renewal",
      "mobile_recharge",
      "event",
      "purchase_gymbal",
      "purchase_camera",
      "other_trip",
      "other_miscellaneous",
    ].includes(exp.category);
    const isFixedType = ["rent", "electricity", "telephone", "other"].includes(
      exp.type,
    );
    return (isFixedCategory || isFixedType) && !exp.staffId;
  });
  const fixedTotal = fixedExpenses.reduce(
    (sum, exp) => sum + (exp.amount || 0),
    0,
  );

  // Variable expenses: expenses with expenseType='variable' or have staffId (employee salaries)
  const variableExpenses = allExpenses.filter((exp) => {
    if (exp.expenseType === "variable") return true;
    // Legacy support: expenses with staffId are variable (salaries)
    return exp.staffId !== null && exp.staffId !== undefined;
  });
  const variableTotal = variableExpenses.reduce(
    (sum, exp) => sum + (exp.amount || 0),
    0,
  );

  // Department-wise breakdown - ONLY for salary expenses (variable expenses)
  const departmentWise = {};
  variableExpenses.forEach((exp) => {
    // Get department from expense or from staff member's team/department
    let dept = exp.department;
    if (!dept && exp.staffId) {
      // Try to get department from staff's team or role
      dept = exp.staffId.team || exp.staffId.department || "other";
    }
    dept = dept || "other";

    if (!departmentWise[dept]) {
      departmentWise[dept] = { total: 0, count: 0, employees: [] };
    }
    departmentWise[dept].total += exp.amount || 0;
    departmentWise[dept].count += 1;

    // Track unique employees per department
    if (exp.staffId) {
      const staffId = exp.staffId._id?.toString() || exp.staffId.toString();
      if (!departmentWise[dept].employees.includes(staffId)) {
        departmentWise[dept].employees.push(staffId);
      }
    }
  });

  // Category-wise breakdown
  const categoryWise = {};
  allExpenses.forEach((exp) => {
    const cat = exp.category || "other";
    if (!categoryWise[cat]) {
      categoryWise[cat] = { total: 0, count: 0 };
    }
    categoryWise[cat].total += exp.amount || 0;
    categoryWise[cat].count += 1;
  });

  // Referral expenses
  const referralExpenses = allExpenses.filter(
    (exp) => exp.referral?.isReferral === true,
  );
  const referralTotal = referralExpenses.reduce(
    (sum, exp) => sum + (exp.referral?.referralAmount || exp.amount || 0),
    0,
  );

  return {
    totalExpenses,
    fixedTotal,
    variableTotal,
    fixedCount: fixedExpenses.length,
    variableCount: variableExpenses.length,
    departmentWise,
    categoryWise,
    referralTotal,
    referralCount: referralExpenses.length,
  };
};

const getTotalExpenses = async (companyId, startDate, endDate) => {
  const query = { companyId };
  if (startDate && endDate) {
    query.date = { $gte: new Date(startDate), $lte: new Date(endDate) };
  }

  const expenses = await Expense.find(query);
  return expenses.reduce((sum, exp) => sum + exp.amount, 0);
};

const getTotalRevenue = async (companyId, startDate, endDate) => {
  const query = { companyId, status: "paid", type: "final" };
  if (startDate && endDate) {
    query.paidDate = { $gte: new Date(startDate), $lte: new Date(endDate) };
  }

  const invoices = await Invoice.find(query);
  // Revenue is only from handlingAmount (campaignAmount is not revenue)
  return invoices.reduce((sum, inv) => sum + extractHandling(inv), 0);
};

/**
 * Get monthly summary report for expenses
 */
const getMonthlySummary = async (companyId, month, year) => {
  const startDate = new Date(year, month - 1, 1);
  const endDate = new Date(year, month, 0, 23, 59, 59);

  const query = {
    companyId,
    date: { $gte: startDate, $lte: endDate },
  };

  const allExpenses = await Expense.find(query)
    .populate("staffId", "name email role team")
    .populate("createdBy", "name email")
    .sort({ date: -1 });

  // Fixed expenses
  const fixedExpenses = allExpenses.filter((exp) => {
    if (exp.expenseType === "fixed") return true;
    const isFixedCategory = [
      "rent",
      "electricity",
      "eb",
      "internet",
      "water",
      "utilities",
      "maintenance",
      "tea_coffee",
      "maid",
      "transport",
      "ceo_salary",
      "bde_salary",
      "oh_salary",
      "oh_incentive",
      "om_salary",
      "hr_account",
      "campaign_ads",
      "hosting",
      "domain_purchase",
      "domain_renewal",
      "mobile_recharge",
      "event",
      "purchase_gymbal",
      "purchase_camera",
      "other_trip",
      "other_miscellaneous",
    ].includes(exp.category);
    return isFixedCategory && !exp.staffId;
  });
  const fixedTotal = fixedExpenses.reduce(
    (sum, exp) => sum + (exp.amount || 0),
    0,
  );

  // Variable expenses (salaries)
  const variableExpenses = allExpenses.filter((exp) => {
    if (exp.expenseType === "variable") return true;
    return exp.staffId !== null && exp.staffId !== undefined;
  });
  const variableTotal = variableExpenses.reduce(
    (sum, exp) => sum + (exp.amount || 0),
    0,
  );

  // Category-wise breakdown for fixed expenses
  const fixedCategoryWise = {};
  fixedExpenses.forEach((exp) => {
    const cat = exp.category || "other";
    if (!fixedCategoryWise[cat]) {
      fixedCategoryWise[cat] = {
        category: cat,
        total: 0,
        count: 0,
        expenses: [],
      };
    }
    fixedCategoryWise[cat].total += exp.amount || 0;
    fixedCategoryWise[cat].count += 1;
    fixedCategoryWise[cat].expenses.push(exp);
  });

  // Employee-wise breakdown for variable expenses
  const variableEmployeeWise = {};
  variableExpenses.forEach((exp) => {
    if (exp.staffId) {
      const staffId = exp.staffId._id?.toString() || exp.staffId.toString();
      if (!variableEmployeeWise[staffId]) {
        variableEmployeeWise[staffId] = {
          staffId: exp.staffId._id || exp.staffId,
          staffName: exp.staffId.name,
          staffEmail: exp.staffId.email,
          staffRole: exp.staffId.role,
          staffTeam: exp.staffId.team,
          total: 0,
          count: 0,
          expenses: [],
        };
      }
      variableEmployeeWise[staffId].total += exp.amount || 0;
      variableEmployeeWise[staffId].count += 1;
      variableEmployeeWise[staffId].expenses.push(exp);
    }
  });

  return {
    period: { month, year, startDate, endDate },
    summary: {
      totalExpenses: fixedTotal + variableTotal,
      fixedTotal,
      variableTotal,
      fixedCount: fixedExpenses.length,
      variableCount: variableExpenses.length,
    },
    fixedCategoryWise: Object.values(fixedCategoryWise),
    variableEmployeeWise: Object.values(variableEmployeeWise),
    allExpenses,
    generatedAt: new Date(),
  };
};

/**
 * Map department/team to P&L team category
 * @param {String} department - Department/team name
 * @param {String} staffRole - Staff role (for variable expenses)
 * @param {String} staffTeam - Staff team (for variable expenses)
 * @returns {String} Team category: 'dm_designing', 'website_tech', 'seo', or 'other'
 */
const mapToPLTeam = (department, staffRole, staffTeam) => {
  const dept = (department || "").toLowerCase().trim();
  const role = (staffRole || "").toLowerCase().trim();
  const team = (staffTeam || "").toLowerCase().trim();

  // DM Team + Designing Team keywords
  const dmDesigningKeywords = [
    "digital-marketing",
    "digital marketing",
    "dm",
    "dm_team",
    "dm team",
    "designing",
    "design",
    "graphic_designing",
    "graphic designing",
    "graphicdesigning",
    "designer",
    "video_editor",
    "video editor",
    "videoeditor",
    "editor",
    "digital_marketing_coordinator",
    "digital marketing coordinator",
    "digital_marketing_manager",
    "digital marketing manager",
  ];

  // Website & Tech Team keywords
  const websiteTechKeywords = [
    "website",
    "web",
    "tech",
    "tech_team",
    "tech team",
    "website_coordinator",
    "website coordinator",
    "website_developer",
    "website developer",
    "websitedeveloper",
    "developer",
    "web-application-development",
    "web application development",
    "website-designing",
    "website designing",
    "web_application",
    "web application",
  ];

  // SEO Team keywords
  const seoKeywords = [
    "seo",
    "seo_team",
    "seo team",
    "search_engine_optimization",
    "search engine optimization",
  ];

  // Check department first (most specific)
  if (dept) {
    if (
      dmDesigningKeywords.some(
        (keyword) => dept.includes(keyword) || dept === keyword,
      )
    ) {
      return "dm_designing";
    }
    if (
      websiteTechKeywords.some(
        (keyword) => dept.includes(keyword) || dept === keyword,
      )
    ) {
      return "website_tech";
    }
    if (
      seoKeywords.some((keyword) => dept.includes(keyword) || dept === keyword)
    ) {
      return "seo";
    }
  }

  // Check role
  if (role) {
    if (
      dmDesigningKeywords.some(
        (keyword) => role.includes(keyword) || role === keyword,
      )
    ) {
      return "dm_designing";
    }
    if (
      websiteTechKeywords.some(
        (keyword) => role.includes(keyword) || role === keyword,
      )
    ) {
      return "website_tech";
    }
    if (
      seoKeywords.some((keyword) => role.includes(keyword) || role === keyword)
    ) {
      return "seo";
    }
  }

  // Check team
  if (team) {
    if (
      dmDesigningKeywords.some(
        (keyword) => team.includes(keyword) || team === keyword,
      )
    ) {
      return "dm_designing";
    }
    if (
      websiteTechKeywords.some(
        (keyword) => team.includes(keyword) || team === keyword,
      )
    ) {
      return "website_tech";
    }
    if (
      seoKeywords.some((keyword) => team.includes(keyword) || team === keyword)
    ) {
      return "seo";
    }
  }

  // Default: assign to DM+Designing if no match (as it gets 80% allocation)
  // This ensures all expenses are allocated
  return "dm_designing";
};

/**
 * Calculate Profit & Loss (P&L) based on business structure
 *
 * Revenue:
 * - Total Revenue = Total Handling Amount (TunePath Handling + AskEva Handling)
 * - Revenue is calculated using only the actual handling amount (excludes GST, Campaign, Domain Purchase)
 * - Total Handling Amount = Revenue from invoices (handlingAmount, excl GST)
 * - Total Campaign Amount = Campaign amount from invoices (campaignAmount, excl GST)
 * - Total Domain Purchase Amount = Paid amount from domain purchases (paidAmount, excl GST)
 * - Total GST = GST from invoices + GST from domain purchases (only included for Ask Eva)
 *
 * Expenses:
 * - Variable Expenses: 100% actual per team (employee salaries)
 * - Fixed Expenses: Allocated based on percentages
 *   - DM + Designing Team: 80%
 *   - Website & Tech Team: 10%
 *   - SEO Team: 10%
 * - Total Team Expense = Variable Expense + (Fixed Expense × Allocation %)
 * - Total Expenses = Sum of all team expenses + Campaign Spend
 *
 * Profit:
 * - Profit = Revenue - Total Expenses
 * - Profit Percentage = (Profit / Revenue) × 100
 *
 * @param {String} companyId - Tenant company ID
 * @param {Date} startDate - Start date for filtering (optional)
 * @param {Date} endDate - End date for filtering (optional)
 * @returns {Object} P&L calculation results
 */
const getProfitLoss = async (companyId, startDate, endDate) => {
  const Invoice = require("../invoices/invoice.model");
  const { Campaign } = require("../campaigns/campaign.model");
  const User = require("../auth/user.model");
  const Company = require("../auth/user.model");

  // Get tenant company to determine if it's Ask Eva or Tunepath (for backward compatibility)
  console.log(`[P&L Calculation] Starting for company: ${companyId}`);
  console.log(`[P&L Calculation] Date range: ${startDate} to ${endDate}`);

  const tenantCompany = await Company.findById(companyId).select("name");
  const isAskEva =
    tenantCompany &&
    tenantCompany.name &&
    tenantCompany.name.toLowerCase().includes("ask eva");

  // Get Proposal model for fallback fetching
  const Proposal = require("../proposals/proposal.model");

  // Helper to extract handling amount (strictly excluding campaigns and GST)
  const extractHandling = (inv) => invoiceService.extractHandling(inv);

  // Grand total per invoice = handling + campaign + tax
  const getInvoiceGrandTotal = (inv) =>
    invoiceService.getInvoiceGrandTotal(inv);

  // Helper function to check if invoice has GST
  // Priority: 1. Check proposal gstIncluded, 2. Check invoice items/tax
  const hasGST = async (invoice) => {
    let invoiceId = invoice._id ? invoice._id.toString() : "unknown";

    // First priority: Check if invoice was created from a proposal with GST included
    // This is the most reliable indicator - if proposal has gstIncluded=true, invoice has GST
    if (invoice.proposalId) {
      let proposal = null;
      let proposalId = null;

      // Determine proposalId value and get proposal
      if (
        typeof invoice.proposalId === "object" &&
        invoice.proposalId !== null
      ) {
        // Check if it's populated (has commercials) or just ObjectId
        if (invoice.proposalId.commercials !== undefined) {
          // Already populated - use it directly
          proposal = invoice.proposalId;
        } else {
          // It's an ObjectId - get the ID
          proposalId = invoice.proposalId._id
            ? invoice.proposalId._id.toString()
            : invoice.proposalId.toString();
        }
      } else if (invoice.proposalId) {
        // proposalId is a string
        proposalId = invoice.proposalId.toString();
      }

      // Fetch proposal if we have an ID and don't have the proposal object
      if (proposalId && !proposal) {
        try {
          proposal = await Proposal.findById(proposalId)
            .select(
              "commercials.gstIncluded commercials.gstPercentage commercials.gstAmount",
            )
            .lean();
        } catch (error) {
          console.warn(
            `[P&L GST Check] Failed to fetch proposal ${proposalId} for invoice ${invoiceId}:`,
            error.message,
          );
        }
      }

      // Check if proposal has GST included - THIS IS THE PRIMARY CHECK
      if (proposal && proposal.commercials) {
        const commercials = proposal.commercials;
        // Check gstIncluded flag - this is the definitive indicator
        if (commercials.gstIncluded === true) {
          console.log(
            `[P&L GST Check] Invoice ${invoiceId}: ✓ GST detected from proposal - gstIncluded=true`,
          );
          return true;
        }
        // Also check if gstAmount > 0 or gstPercentage > 0 as fallback
        if (
          (commercials.gstAmount && commercials.gstAmount > 0) ||
          (commercials.gstPercentage && commercials.gstPercentage > 0)
        ) {
          console.log(
            `[P&L GST Check] Invoice ${invoiceId}: ✓ GST detected from proposal - gstAmount=${commercials.gstAmount}, gstPercentage=${commercials.gstPercentage}`,
          );
          return true;
        }
      }
    }

    // Second priority: Check invoice tax amounts (even if no proposal)
    // Check tax.total (object format) - this is the actual tax amount
    if (
      invoice.tax &&
      typeof invoice.tax === "object" &&
      invoice.tax !== null
    ) {
      if (invoice.tax.total && invoice.tax.total > 0) {
        console.log(
          `[P&L GST Check] Invoice ${invoiceId}: ✓ GST detected from invoice.tax.total=${invoice.tax.total}`,
        );
        return true;
      }
      // Also check individual tax components
      const taxComponents = {
        cgst: invoice.tax.cgst || 0,
        sgst: invoice.tax.sgst || 0,
        igst: invoice.tax.igst || 0,
        utgst: invoice.tax.utgst || 0,
      };
      if (
        taxComponents.cgst > 0 ||
        taxComponents.sgst > 0 ||
        taxComponents.igst > 0 ||
        taxComponents.utgst > 0
      ) {
        console.log(
          `[P&L GST Check] Invoice ${invoiceId}: ✓ GST detected from invoice tax components (CGST/SGST/IGST/UTGST)`,
        );
        return true;
      }
    }
    // Check tax (number format - legacy) - this is the actual tax amount
    if (typeof invoice.tax === "number" && invoice.tax > 0) {
      console.log(
        `[P&L GST Check] Invoice ${invoiceId}: ✓ GST detected from invoice.tax=${invoice.tax}`,
      );
      return true;
    }

    // Third priority: Check items for GST percentage OR tax amounts
    // Note: item.gst is a percentage (e.g., 18 for 18%), if > 0, invoice has GST
    if (
      invoice.items &&
      Array.isArray(invoice.items) &&
      invoice.items.length > 0
    ) {
      const itemsWithGST = invoice.items.filter((item) => {
        // Check GST percentage first (most reliable indicator)
        if (item.gst && item.gst > 0) {
          return true;
        }
        // Check tax amounts as fallback
        return (
          (item.taxAmount && item.taxAmount > 0) ||
          (item.cgst && item.cgst > 0) ||
          (item.sgst && item.sgst > 0) ||
          (item.igst && item.igst > 0) ||
          (item.utgst && item.utgst > 0)
        );
      });
      if (itemsWithGST.length > 0) {
        console.log(
          `[P&L GST Check] Invoice ${invoiceId}: ✓ GST detected from ${itemsWithGST.length} invoice items with GST`,
        );
        return true;
      }
    }

    // Final check: If total > subtotal, there might be GST
    const invoiceTotal = invoice.total || 0;
    const invoiceSubtotal = invoice.subtotal || 0;
    if (invoiceTotal > invoiceSubtotal && invoiceSubtotal > 0) {
      // There's a difference, likely GST
      const difference = invoiceTotal - invoiceSubtotal;
      console.log(
        `[P&L GST Check] Invoice ${invoiceId}: ✓ GST detected from total(${invoiceTotal}) > subtotal(${invoiceSubtotal}), difference=${difference}`,
      );
      return true;
    }

    console.log(
      `[P&L GST Check] Invoice ${invoiceId}: ✗ No GST detected - categorizing as Tunepath Revenue`,
    );
    return false;
  };

  // ========== REVENUE (CASH BASIS) ==========
  // IMPORTANT: Revenue is recognized ONLY when payment is received (Cash-Basis Accounting)
  // Instead of looking at paid invoices, we look at verified payment transactions in the period.
  const verifiedTransactions =
    await invoiceService.getVerifiedTransactionsForPL(companyId, {
      startDate,
      endDate,
    });

  console.log(
    `[P&L Calculation] Found ${verifiedTransactions.length} verified payment transactions in this period.`,
  );

  // To deduplicate proforma/final, we need a map of unique invoices involved in these payments
  const uniqueInvoicesMap = new Map();
  verifiedTransactions.forEach((tx) => {
    if (tx.invoiceId) {
      uniqueInvoicesMap.set(tx.invoiceId._id.toString(), tx.invoiceId);
    }
  });

  // ========== ANALYZE INVOICES FOR GST ==========
  // We need to know which invoices have GST to categorize revenue as AskEva vs Tunepath
  const gstInvoiceIdSet = new Set();
  for (const [invId, inv] of uniqueInvoicesMap.entries()) {
    if (await hasGST(inv)) {
      gstInvoiceIdSet.add(invId);
    }
  }

  // Get ALL invoices (including unpaid) for pending/collected amount calculation
  // De-duplicate Proforma/Final pairs for ALL invoices
  const allInvoices = await invoiceService.getDeDuplicatedInvoicesForPL(
    companyId,
    {
      startDate,
      endDate,
      statuses: ["draft", "sent", "paid", "overdue", "hold"],
    },
  );

  // Pending side should follow invoice created month (allInvoices is already
  // filtered by createdAt via getDeDuplicatedInvoicesForPL).
  const gstInvoiceIdSetForPending = new Set();
  for (const inv of allInvoices) {
    if (await hasGST(inv)) {
      gstInvoiceIdSetForPending.add(inv._id.toString());
    }
  }

  // ========== COMPUTE REVENUE FROM TRANSACTIONS ==========
  let includeGstRevenue = 0;
  let tunepathRevenue = 0;
  let totalHandlingAmount = 0;
  let totalCampaignAmount = 0;
  let totalInvoiceGST = 0;

  verifiedTransactions.forEach((tx) => {
    const invoice = tx.invoiceId;
    if (!invoice) return;

    const invoiceId = invoice._id.toString();
    const grandTotal = getInvoiceGrandTotal(invoice);
    const paymentAmount = tx.amount || 0;

    // paymentFraction: How much of the total invoice this specific transaction covers
    const paymentFraction = grandTotal > 0 ? paymentAmount / grandTotal : 0;

    // Extract handling and campaign amounts from invoice
    let handling = extractHandling(invoice);

    let campaign = invoiceService.extractCampaign(invoice);

    // Proportional allocation of the payment
    const transactedHandling = handling * paymentFraction;
    const transactedCampaign = campaign * paymentFraction;

    totalHandlingAmount += transactedHandling;
    totalCampaignAmount += transactedCampaign;

    // Proportional GST
    let invoiceGst = 0;
    if (invoice.tax) {
      if (typeof invoice.tax === "object" && invoice.tax !== null) {
        invoiceGst = Number(invoice.tax.total) || 0;
      } else if (typeof invoice.tax === "number") {
        invoiceGst = invoice.tax || 0;
      }
    }
    totalInvoiceGST += (Number(invoiceGst) || 0) * paymentFraction;

    // Categorize transaction revenue as AskEva or TunePath
    if (gstInvoiceIdSet.has(invoiceId)) {
      includeGstRevenue += transactedHandling;
    } else {
      tunepathRevenue += transactedHandling;
    }
  });

  // Total Domain Purchase Amount - Revenue from paid domain purchases only
  const DomainPurchase = require("../domain-purchases/domainPurchase.model");

  // Get domain purchases that have been paid (for revenue calculation)
  const paidDomainPurchaseQuery = {
    tenantCompanyId: companyId,
    paidAmount: { $gt: 0 }, // Only count domain purchases with payment
  };
  if (startDate && endDate) {
    paidDomainPurchaseQuery.paymentDate = {
      $gte: new Date(startDate),
      $lte: new Date(endDate),
    };
  }
  const paidDomainPurchases = await DomainPurchase.find(paidDomainPurchaseQuery)
    .populate("companyId", "name")
    .lean();

  // Get all domain purchases (including unpaid) for pending/collected amount calculation
  const allDomainPurchasesQuery = { tenantCompanyId: companyId };
  if (startDate && endDate) {
    allDomainPurchasesQuery.paymentDate = {
      $gte: new Date(startDate),
      $lte: new Date(endDate),
    };
  }
  const allDomainPurchases = await DomainPurchase.find(allDomainPurchasesQuery);

  // Separate PAID domain purchases by GST presence for revenue:
  // - GST domain purchases (has gst > 0) → AskEva revenue (exclude GST as it's shown separately)
  // - Non-GST domain purchases (no gst) → TunePath revenue (exclude GST)
  // Only count paidAmount for revenue (balance is pending, not revenue yet)
  const gstDomainPurchases = paidDomainPurchases.filter(
    (dp) => (dp.gst || 0) > 0,
  );
  const nonGstDomainPurchases = paidDomainPurchases.filter(
    (dp) => !(dp.gst && dp.gst > 0),
  );

  // AskEva Domain Purchase Revenue: Base amount only (exclude GST as it's tracked in totalGST)
  const askEvaDomainPurchaseAmount = gstDomainPurchases.reduce((sum, dp) => {
    const paidAmount = dp.paidAmount || 0; // Only count base paid amount for revenue
    return sum + paidAmount;
  }, 0);

  // TunePath Domain Purchase Revenue: Non-GST (only paidAmount, balance is pending)
  const tunepathDomainPurchaseAmount = nonGstDomainPurchases.reduce(
    (sum, dp) => {
      const paidAmount = dp.paidAmount || 0; // Only count paid amount for revenue
      return sum + paidAmount; // Revenue = paidAmount only (balance is pending, not revenue)
    },
    0,
  );

  // Domain purchase revenue is already transaction-based (paidAmount only)
  const domainPurchases = allDomainPurchases;
  const totalDomainPurchasePaidAmount = domainPurchases.reduce(
    (sum, dp) => sum + (dp.paidAmount || 0),
    0,
  );
  const totalDomainPurchaseBalanceAmount = domainPurchases.reduce(
    (sum, dp) => sum + (dp.balance || 0),
    0,
  );

  // Total Invoice GST is already initialized and computed via transactions above.

  // Calculate Total GST from PAID domain purchases (for display purposes)
  // Only count GST from domain purchases that have been paid
  const totalDomainPurchaseGST = paidDomainPurchases.reduce(
    (sum, dp) => sum + (dp.gst || 0),
    0,
  );

  // tunepathRevenueFinal, includeGstRevenueFinal, totalRevenue are computed after collectedMap
  let tunepathRevenueFinal = 0;
  let includeGstRevenueFinal = 0;
  let totalRevenue = 0;

  // ========== PENDING AMOUNT CALCULATION ==========

  // Invoice amount/pending are based on invoice created month.
  const invoicesForPending = allInvoices;

  // Collected amount is based on paymentDate selected month.
  const verifiedCollectedTransactions =
    await invoiceService.getVerifiedTransactionsForPL(companyId, {
      startDate,
      endDate,
      periodField: "paymentDate",
    });

  // Calculate pending amount and total collected amount for all invoices
  // Separate into AskEva and Tunepath categories
  let includeGstPending = 0;
  let includeGstCollected = 0;
  let tunepathPending = 0;
  let tunepathCollected = 0;
  const includeGstPendingRows = [];
  const tunepathPendingRows = [];

  const invoiceIds = invoicesForPending.map((inv) => inv._id);
  const paymentData = await invoiceService.calculatePaymentAmounts(invoiceIds, {
    includePending: true,
  });
  const collectedMap = paymentData.collected || {};
  const pendingPaymentMap = paymentData.pending || {};

  let totalPendingAmount = 0;
  let totalHoldPendingAmount = 0;
  let totalCollectedAmount = 0;
  let totalInvoiceGrandTotal = 0; // Sum of all invoice grand totals (handling + campaign + tax)
  invoicesForPending.forEach((invoice) => {
    const invoiceId = invoice._id.toString();
    const collectedAmount = collectedMap[invoiceId] || 0; // Only verified payments
    const pendingPaymentAmount = pendingPaymentMap[invoiceId] || 0; // Pending payment transactions

    // Grand total = handling + campaign + tax (full amount client owes)
    const invoiceGrandTotal = getInvoiceGrandTotal(invoice);
    totalInvoiceGrandTotal += invoiceGrandTotal;
    const invoicePending = Math.max(0, invoiceGrandTotal - collectedAmount);

    const isHold = invoice.status === "hold";
    if (isHold) {
      totalHoldPendingAmount += invoicePending + pendingPaymentAmount;
    } else {
      // Total pending = Unpaid invoice amount + Pending payment transactions
      totalPendingAmount += invoicePending + pendingPaymentAmount;
    }

    // Categorize by company type
    const isGst = gstInvoiceIdSetForPending.has(invoiceId);
    if (isGst) {
      if (!isHold) {
        includeGstPending += invoicePending + pendingPaymentAmount;
      }
    } else {
      if (!isHold) {
        tunepathPending += invoicePending + pendingPaymentAmount;
      }
    }

    const linePending = invoicePending + pendingPaymentAmount;
    if (!isHold && linePending > 0.005) {
      const clientName =
        (typeof invoice.clientId === "object" && invoice.clientId?.name) || "—";
      const reference =
        (invoice.invoiceNumber && String(invoice.invoiceNumber).trim()) ||
        `Invoice ${String(invoice._id).slice(-6)}`;
      const row = {
        id: invoiceId,
        kind: "invoice",
        reference,
        clientName,
        pendingAmount: parseFloat(linePending.toFixed(2)),
        status: invoice.status || "—",
        invoiceDate: invoice.invoiceDate
          ? new Date(invoice.invoiceDate).toISOString()
          : invoice.createdAt
            ? new Date(invoice.createdAt).toISOString()
            : null,
      };
      if (isGst) includeGstPendingRows.push(row);
      else tunepathPendingRows.push(row);
    }
  });

  // Split collected amounts by paymentDate-period transactions.
  const collectedInvoiceMap = new Map();
  verifiedCollectedTransactions.forEach((tx) => {
    if (tx.invoiceId && tx.invoiceId._id) {
      collectedInvoiceMap.set(tx.invoiceId._id.toString(), tx.invoiceId);
    }
  });

  const gstInvoiceIdSetForCollected = new Set();
  for (const [invId, inv] of collectedInvoiceMap.entries()) {
    if (await hasGST(inv)) {
      gstInvoiceIdSetForCollected.add(invId);
    }
  }

  verifiedCollectedTransactions.forEach((tx) => {
    const amount = tx.amount || 0;
    const invId = tx.invoiceId?._id ? tx.invoiceId._id.toString() : null;
    totalCollectedAmount += amount;

    if (invId && gstInvoiceIdSetForCollected.has(invId)) {
      includeGstCollected += amount;
    } else {
      tunepathCollected += amount;
    }
  });

  // Note: Handling, Campaign, and Revenue are already computed from transactions above.

  // Finalise revenues (invoice part is now transaction-based; domain purchases were always cash-based)
  // As per requirement: Revenue is calculated using only the actual handling amount
  tunepathRevenueFinal = tunepathRevenue;
  includeGstRevenueFinal = includeGstRevenue;
  // ========== MARKETPLACE PURCHASES CALCULATION ==========
  const MarketplacePurchase = require('../marketplace/marketplace.model');
  const marketplacePurchases = await MarketplacePurchase.find({
    companyId,
    status: 'completed',
    createdAt: { $gte: new Date(startDate), $lte: new Date(endDate) }
  });
  
  const totalMarketplaceRevenue = marketplacePurchases.reduce((sum, mp) => sum + (mp.amount / 100), 0);
  tunepathRevenueFinal += totalMarketplaceRevenue;
  
  totalRevenue = tunepathRevenueFinal + includeGstRevenueFinal;
  totalCollectedAmount += totalMarketplaceRevenue;

  // Finalise total GST (Transaction-based)
  const totalGST = totalInvoiceGST + totalDomainPurchaseGST;

  // Split domain purchase amounts by company type
  const askEvaDomainPurchasePaid = gstDomainPurchases.reduce(
    (sum, dp) => sum + (dp.paidAmount || 0),
    0,
  );
  const tunepathDomainPurchasePaid = nonGstDomainPurchases.reduce(
    (sum, dp) => sum + (dp.paidAmount || 0),
    0,
  );
  const askEvaDomainPurchaseBalance = gstDomainPurchases.reduce(
    (sum, dp) => sum + (dp.balance || 0),
    0,
  );
  const tunepathDomainPurchaseBalance = nonGstDomainPurchases.reduce(
    (sum, dp) => sum + (dp.balance || 0),
    0,
  );

  // Add domain purchase amounts to respective counters
  includeGstCollected += askEvaDomainPurchasePaid;
  tunepathCollected += tunepathDomainPurchasePaid;
  includeGstPending += askEvaDomainPurchaseBalance;
  tunepathPending += tunepathDomainPurchaseBalance;

  gstDomainPurchases.forEach((dp) => {
    const bal = parseFloat((dp.balance || 0).toFixed(2));
    if (bal <= 0) return;
    const clientName =
      (typeof dp.companyId === "object" && dp.companyId?.name) || "—";
    includeGstPendingRows.push({
      id: `domain-${dp._id}`,
      kind: "domain",
      reference: dp.domainName ? String(dp.domainName) : "Domain",
      clientName,
      pendingAmount: bal,
      status: "domain balance",
      invoiceDate: dp.paymentDate
        ? new Date(dp.paymentDate).toISOString()
        : null,
    });
  });
  nonGstDomainPurchases.forEach((dp) => {
    const bal = parseFloat((dp.balance || 0).toFixed(2));
    if (bal <= 0) return;
    const clientName =
      (typeof dp.companyId === "object" && dp.companyId?.name) || "—";
    tunepathPendingRows.push({
      id: `domain-${dp._id}`,
      kind: "domain",
      reference: dp.domainName ? String(dp.domainName) : "Domain",
      clientName,
      pendingAmount: bal,
      status: "domain balance",
      invoiceDate: dp.paymentDate
        ? new Date(dp.paymentDate).toISOString()
        : null,
    });
  });

  includeGstPendingRows.sort((a, b) => b.pendingAmount - a.pendingAmount);
  tunepathPendingRows.sort((a, b) => b.pendingAmount - a.pendingAmount);

  // Add domain purchase balance to pending amount
  totalPendingAmount += totalDomainPurchaseBalanceAmount;

  // Add domain purchase paid amount to collected amount
  totalCollectedAmount += totalDomainPurchasePaidAmount;

  // ========== EXPENSES ==========

  // Get all expenses
  const expenseQuery = { companyId };
  if (startDate && endDate) {
    expenseQuery.date = { $gte: new Date(startDate), $lte: new Date(endDate) };
  }

  const allExpenses = await Expense.find(expenseQuery)
    .populate("staffId", "name email role team")
    .lean();

  // Separate fixed and variable expenses
  const fixedExpenses = allExpenses.filter((exp) => {
    if (exp.expenseType === "fixed") return true;
    // Legacy: check if it's a fixed category without staffId
    const isFixedCategory = [
      "rent",
      "electricity",
      "eb",
      "internet",
      "water",
      "utilities",
      "maintenance",
      "tea_coffee",
      "maid",
      "transport",
      "ceo_salary",
      "bde_salary",
      "oh_salary",
      "oh_incentive",
      "om_salary",
      "hr_account",
      "campaign_ads",
      "hosting",
      "domain_purchase",
      "domain_renewal",
      "mobile_recharge",
      "event",
      "purchase_gymbal",
      "purchase_camera",
      "other_trip",
      "other_miscellaneous",
    ].includes(exp.category);
    return isFixedCategory && !exp.staffId;
  });

  const variableExpenses = allExpenses.filter((exp) => {
    if (exp.expenseType === "variable") return true;
    return exp.staffId !== null && exp.staffId !== undefined;
  });

  // Calculate total fixed expense pool
  const totalFixedExpensePool = fixedExpenses.reduce(
    (sum, exp) => sum + (exp.amount || 0),
    0,
  );

  // ========== TEAM-WISE EXPENSE ALLOCATION ==========

  // Initialize dynamic team expenses
  const teamExpenses = {};

  // Fetch company's actual registered agency departments to map ObjectIds & preload all real departments
  const Department = require("../departments/department.model");
  const allDepartments = await Department.find({
    $or: [{ agencyId: companyId }, { companyId: companyId }]
  }).lean();

  const deptMap = {};
  allDepartments.forEach(d => {
    const name = d.name.trim();
    deptMap[d._id.toString()] = name;
    // Pre-initialize real agency department in teamExpenses
    if (!teamExpenses[name]) {
      teamExpenses[name] = {
        variableExpense: 0,
        fixedExpenseAllocated: 0,
        totalExpense: 0,
      };
    }
  });

  // Calculate variable expenses per team
  // Handle both expenses with staffId (populated) and without
  variableExpenses.forEach((exp) => {
    let department = exp.department || exp.staffId?.departmentName || exp.staffId?.team || "General";
    // Normalize string
    let team = department.trim();

    // If the department string is an ObjectId, map it to the readable name
    if (deptMap[team]) {
      team = deptMap[team].trim();
    }

    if (!teamExpenses[team]) {
      teamExpenses[team] = {
        variableExpense: 0,
        fixedExpenseAllocated: 0,
        totalExpense: 0,
      };
    }
    
    teamExpenses[team].variableExpense += exp.amount || 0;
  });

  // Ensure we have at least one team if there are no variable expenses but there are fixed expenses
  if (Object.keys(teamExpenses).length === 0 && totalFixedExpensePool > 0) {
    teamExpenses["General"] = { variableExpense: 0, fixedExpenseAllocated: 0, totalExpense: 0 };
  }

  // Allocate fixed expenses to teams proportionally based on variable expenses
  const totalVariableExpensePool = Object.values(teamExpenses).reduce(
    (sum, t) => sum + t.variableExpense,
    0
  );

  Object.keys(teamExpenses).forEach((team) => {
    let allocationRatio = 0;
    if (totalVariableExpensePool > 0) {
      allocationRatio = teamExpenses[team].variableExpense / totalVariableExpensePool;
    } else {
      allocationRatio = 1 / Object.keys(teamExpenses).length;
    }
    
    teamExpenses[team].fixedExpenseAllocated = totalFixedExpensePool * allocationRatio;
    teamExpenses[team].totalExpense = teamExpenses[team].variableExpense + teamExpenses[team].fixedExpenseAllocated;
  });

  // Calculate total operational expenses (team expenses only)
  const totalOperationalExpenses = Object.values(teamExpenses).reduce(
    (sum, team) => sum + team.totalExpense,
    0
  );

  // Campaign actual spend (cost) - separate from team expenses
  let campaignSpend = 0;
  const campaignSpendQuery = { companyId };
  if (startDate && endDate) {
    campaignSpendQuery.$or = [
      { startDate: { $lte: new Date(endDate), $gte: new Date(startDate) } },
      { endDate: { $lte: new Date(endDate), $gte: new Date(startDate) } },
      {
        startDate: { $lte: new Date(startDate) },
        endDate: { $gte: new Date(endDate) },
      },
    ];
  }
  const campaigns = await Campaign.find(campaignSpendQuery);
  campaignSpend = campaigns.reduce(
    (sum, camp) => sum + (camp.actualSpend || 0),
    0,
  );

  // Total operational expenses (team expenses only) - EXCLUDING campaigns
  const totalExpenses = totalOperationalExpenses;

  // ========== PROFIT CALCULATION ==========

  // Profit = Revenue - Total Expenses
  const profit = totalRevenue - totalExpenses;

  // Profit Percentage = (Profit / Revenue) × 100
  // Handle zero revenue safely
  const profitPercentage = totalRevenue > 0 ? (profit / totalRevenue) * 100 : 0;

  // ========== TEAM-WISE REVENUE ALLOCATION ==========

  // Helper function to dynamically map service name to an existing team/department
  const mapServiceToTeam = (serviceName) => {
    if (!serviceName) return "General";

    const name = (serviceName || "").toLowerCase().trim();
    
    // First try to find an exact or partial match in the existing dynamic teams
    for (const t of Object.keys(teamExpenses)) {
      if (name.includes(t.toLowerCase()) || t.toLowerCase().includes(name)) {
        return t;
      }
    }

    // Keyword mapping for common services
    if (name.includes("digital marketing") || name.includes("social media") || name.includes("design")) {
      const marketingTeam = Object.keys(teamExpenses).find(t => t.toLowerCase().includes("marketing") || t.toLowerCase().includes("design"));
      if (marketingTeam) return marketingTeam;
    }
    if (name.includes("website") || name.includes("development") || name.includes("tech") || name.includes("chatbot")) {
      const devTeam = Object.keys(teamExpenses).find(t => t.toLowerCase().includes("web") || t.toLowerCase().includes("tech") || t.toLowerCase().includes("dev"));
      if (devTeam) return devTeam;
    }
    if (name.includes("seo") || name.includes("aeo") || name.includes("geo")) {
      const seoTeam = Object.keys(teamExpenses).find(t => t.toLowerCase().includes("seo"));
      if (seoTeam) return seoTeam;
    }

    return "General";
  };

  // Initialize team revenue
  const teamRevenue = {};
  
  // Ensure all teams in teamExpenses are in teamRevenue
  Object.keys(teamExpenses).forEach(t => {
    teamRevenue[t] = 0;
  });

  // Allocate revenue to teams — TRANSACTION BASIS ONLY
  allInvoices.forEach((invoice) => {
    const invoiceId = invoice._id ? invoice._id.toString() : null;
    if (!invoiceId) return;

    const grandTotal = getInvoiceGrandTotal(invoice);
    const verifiedAmount = (collectedMap && collectedMap[invoiceId]) || 0;
    const paidFraction =
      grandTotal > 0 ? Math.min(verifiedAmount / grandTotal, 1) : 0;

    if (paidFraction === 0) return; // Nothing transacted — skip entirely

    // 1. If invoice has items, allocate based on service name
    if (
      invoice.items &&
      Array.isArray(invoice.items) &&
      invoice.items.length > 0
    ) {
      invoice.items.forEach((item) => {
        if (item.category !== "handling") return;

        let serviceName = null;
        if (item.serviceId && typeof item.serviceId === "object") {
          serviceName = item.serviceId.name;
        }

        const team = mapServiceToTeam(serviceName);
        const handlingAmount = (item.taxableValue || 0) * paidFraction;

        if (teamRevenue[team] !== undefined) {
          teamRevenue[team] += handlingAmount;
        } else {
          teamRevenue[team] = handlingAmount;
          if (!teamExpenses[team]) {
            teamExpenses[team] = { variableExpense: 0, fixedExpenseAllocated: 0, totalExpense: 0 };
          }
        }
      });
    }
    // 2. Fallback for manual invoices (no items)
    else if (invoice.handlingAmount > 0) {
      const fallbackTeam = Object.keys(teamRevenue).length > 0 ? Object.keys(teamRevenue)[0] : "General";
      if (teamRevenue[fallbackTeam] === undefined) {
         teamRevenue[fallbackTeam] = 0;
      }
      if (!teamExpenses[fallbackTeam]) {
         teamExpenses[fallbackTeam] = { variableExpense: 0, fixedExpenseAllocated: 0, totalExpense: 0 };
      }
      teamRevenue[fallbackTeam] += invoice.handlingAmount * paidFraction;
    }
  });

  // ========== TEAM-WISE PROFIT BREAKDOWN ==========

  // Calculate team-wise profit
  const teamBreakdown = Object.keys(teamExpenses).map((teamKey) => {
    const team = teamExpenses[teamKey];
    const teamIncome = teamRevenue[teamKey] || 0; 

    // Team profit = Team Income (handling revenue) - Team Expense
    const teamProfit = teamIncome - team.totalExpense;

    // Team profit percentage = (Team Profit / Team Income) * 100
    const teamProfitPercentage =
      teamIncome > 0
        ? (teamProfit / teamIncome) * 100
        : teamProfit < 0
          ? -100
          : 0;

    const expenseContributionPercent =
      totalOperationalExpenses > 0
        ? (team.totalExpense / totalOperationalExpenses) * 100
        : 0;

    return {
      team: teamKey,
      teamLabel: teamKey,
      revenue: parseFloat((teamIncome || 0).toFixed(2)),
      variableExpense: parseFloat((team.variableExpense || 0).toFixed(2)),
      fixedExpenseAllocated: parseFloat(
        (team.fixedExpenseAllocated || 0).toFixed(2),
      ),
      totalExpense: parseFloat((team.totalExpense || 0).toFixed(2)),
      expenseContributionPercent: parseFloat(
        expenseContributionPercent.toFixed(2),
      ),
      profit: parseFloat(teamProfit.toFixed(2)),
      profitPercentage: parseFloat(teamProfitPercentage.toFixed(2)),
    };
  });

  return {
    // Revenue (from PAID invoices and domain purchases only - cash basis accounting)
    // Revenue is recognized only when payment is received
    totalRevenue: parseFloat(totalRevenue.toFixed(2)), // Company-specific revenue (for profit calculation) - only from paid invoices
    tunepathRevenue: parseFloat(tunepathRevenueFinal.toFixed(2)), // Tunepath revenue (non-GST paid invoice total)
    includeGstRevenue: parseFloat(includeGstRevenueFinal.toFixed(2)), // Include GST revenue (GST-included paid invoice total)
    totalHandlingAmount: parseFloat(totalHandlingAmount.toFixed(2)),
    totalCampaignAmount: parseFloat(totalCampaignAmount.toFixed(2)),
    totalDomainPurchaseAmount: parseFloat(
      (tunepathDomainPurchaseAmount + askEvaDomainPurchaseAmount).toFixed(2),
    ),
    totalGST: parseFloat(totalGST.toFixed(2)),
    totalDomainPurchaseGST: parseFloat(totalDomainPurchaseGST.toFixed(2)),
    isAskEva: isAskEva, // Flag to indicate if this is Ask Eva company

    // Pending Amount & Collected Amount (based on invoice grand total = handling + campaign + tax)
    totalInvoiceGrandTotal: parseFloat(totalInvoiceGrandTotal.toFixed(2)), // Total billed (sum of all invoice grand totals)
    totalPendingAmount: parseFloat(totalPendingAmount.toFixed(2)),
    totalCollectedAmount: parseFloat(totalCollectedAmount.toFixed(2)),

    // Company-specific pending/collected amounts
    totalHoldPendingAmount: parseFloat(totalHoldPendingAmount.toFixed(2)),
    includeGstPending: parseFloat(includeGstPending.toFixed(2)),
    includeGstCollected: parseFloat(includeGstCollected.toFixed(2)),
    tunepathPending: parseFloat(tunepathPending.toFixed(2)),
    tunepathCollected: parseFloat(tunepathCollected.toFixed(2)),
    includeGstPendingDetails: includeGstPendingRows,
    tunepathPendingDetails: tunepathPendingRows,

    // Expenses
    totalExpenses: parseFloat(totalExpenses.toFixed(2)),
    operationalExpenses: parseFloat(totalOperationalExpenses.toFixed(2)),
    campaignSpend: parseFloat(campaignSpend.toFixed(2)),
    totalFixedExpensePool: parseFloat(totalFixedExpensePool.toFixed(2)),

    // Profit
    profit: parseFloat(profit.toFixed(2)),
    profitPercentage: parseFloat(profitPercentage.toFixed(2)),

    // Team-wise breakdown (includes revenue, profit and profitPercentage per team)
    teamBreakdown: teamBreakdown || [],

    // Detailed itemized expenses for reporting
    fixedExpenses: fixedExpenses || [],
    variableExpenses: variableExpenses || [],

    // Legacy fields for backward compatibility (deprecated - use totalRevenue instead)
    totalIncome: parseFloat(totalRevenue.toFixed(2)),
    invoiceRevenue: parseFloat(totalHandlingAmount.toFixed(2)),
    invoiceCampaignAmount: parseFloat(totalCampaignAmount.toFixed(2)),
    campaignRevenue: 0, // No longer used, but kept for backward compatibility
    netProfit: parseFloat(profit.toFixed(2)),
    profitMargin: parseFloat(profitPercentage.toFixed(2)),
  };
};

/**
 * Duplicate fixed expenses from previous month to current month
 * @param {String} companyId - Tenant company ID
 * @param {Number} sourceMonth - Source month (1-12)
 * @param {Number} sourceYear - Source year
 * @param {Number} targetMonth - Target month (1-12)
 * @param {Number} targetYear - Target year
 * @param {String} userId - User ID who is duplicating
 * @returns {Object} Result with count of duplicated expenses
 */
const duplicateFixedExpensesFromMonth = async (
  companyId,
  sourceMonth,
  sourceYear,
  targetMonth,
  targetYear,
  userId,
) => {
  // Calculate date ranges
  const sourceStartDate = new Date(sourceYear, sourceMonth - 1, 1);
  const sourceEndDate = new Date(sourceYear, sourceMonth, 0, 23, 59, 59);
  const targetStartDate = new Date(targetYear, targetMonth - 1, 1);
  const targetEndDate = new Date(targetYear, targetMonth, 0, 23, 59, 59);

  // Get all fixed expenses from source month
  const sourceExpenses = await Expense.find({
    companyId,
    expenseType: "fixed",
    date: {
      $gte: sourceStartDate,
      $lte: sourceEndDate,
    },
  });

  if (sourceExpenses.length === 0) {
    return {
      success: false,
      message: `No fixed expenses found for ${sourceMonth}/${sourceYear}`,
      count: 0,
    };
  }

  // Check if target month already has expenses
  const existingTargetExpenses = await Expense.find({
    companyId,
    expenseType: "fixed",
    date: {
      $gte: targetStartDate,
      $lte: targetEndDate,
    },
  });

  if (existingTargetExpenses.length > 0) {
    return {
      success: false,
      message: `Target month ${targetMonth}/${targetYear} already has ${existingTargetExpenses.length} fixed expense(s). Please delete them first or choose a different month.`,
      count: 0,
    };
  }

  // Duplicate expenses with new dates
  const duplicatedExpenses = [];
  for (const sourceExpense of sourceExpenses) {
    // Calculate the day of month (keep same day if possible, otherwise use last day of target month)
    const sourceDay = sourceExpense.date.getDate();
    const lastDayOfTargetMonth = new Date(targetYear, targetMonth, 0).getDate();
    const targetDay = Math.min(sourceDay, lastDayOfTargetMonth);

    const targetDate = new Date(targetYear, targetMonth - 1, targetDay);

    // Create new expense with same data but new date
    const newExpense = await Expense.create({
      companyId: sourceExpense.companyId,
      expenseType: sourceExpense.expenseType,
      category: sourceExpense.category,
      department: sourceExpense.department,
      type: sourceExpense.type,
      amount: sourceExpense.amount,
      description: sourceExpense.description,
      date: targetDate,
      vendor: sourceExpense.vendor,
      paymentMethod: sourceExpense.paymentMethod,
      notes: sourceExpense.notes,
      remarks: sourceExpense.remarks,
      referral: sourceExpense.referral,
      receipt: sourceExpense.receipt,
      createdBy: userId,
    });

    duplicatedExpenses.push(newExpense);
  }

  return {
    success: true,
    message: `Successfully duplicated ${duplicatedExpenses.length} fixed expense(s) from ${sourceMonth}/${sourceYear} to ${targetMonth}/${targetYear}`,
    count: duplicatedExpenses.length,
    expenses: duplicatedExpenses,
  };
};

/**
 * Get salary history for a specific employee
 * @param {String} staffId - Employee ID
 * @param {String} companyId - Tenant company ID
 * @param {Object} filters - Optional filters (startDate, endDate)
 * @returns {Array} Salary history entries sorted by effective date (newest first)
 */
const getSalaryHistoryByEmployee = async (staffId, companyId, filters = {}) => {
  const query = {
    staffId,
    companyId,
  };

  if (filters.startDate || filters.endDate) {
    query.effectiveDate = {};
    if (filters.startDate) {
      query.effectiveDate.$gte = new Date(filters.startDate);
    }
    if (filters.endDate) {
      query.effectiveDate.$lte = new Date(filters.endDate);
    }
  }

  let history = await SalaryHistory.find(query)
    .populate("staffId", "name email role team")
    .populate("createdBy", "name email")
    .populate("expenseId", "amount date category")
    .sort({ effectiveDate: -1, createdAt: -1 }); // Newest first

  // If no history exists, try to generate it from existing expenses
  if (history.length === 0) {
    // Get all salary expenses for this employee, sorted by date
    const expenses = await Expense.find({
      companyId,
      expenseType: "variable",
      staffId,
    })
      .populate("staffId", "name email role team")
      .populate("createdBy", "name email")
      .sort({ date: 1 }); // Oldest first

    if (expenses.length > 0) {
      // Generate history from expenses
      const generatedHistory = [];
      let previousAmount = 0;

      for (const expense of expenses) {
        const changeType =
          previousAmount === 0
            ? "initial"
            : expense.amount > previousAmount
              ? "increment"
              : expense.amount < previousAmount
                ? "decrement"
                : "adjustment";

        if (previousAmount !== expense.amount || previousAmount === 0) {
          generatedHistory.push({
            _id: `generated_${expense._id}`,
            staffId: expense.staffId,
            companyId,
            oldSalary: previousAmount,
            newSalary: expense.amount,
            effectiveDate: expense.date,
            expenseId: expense._id,
            changeType,
            reason: expense.notes || expense.remarks || null,
            notes: expense.notes || expense.remarks || null,
            createdBy: expense.createdBy,
            createdAt: expense.createdAt,
            updatedAt: expense.updatedAt,
          });
          previousAmount = expense.amount;
        }
      }

      // Reverse to show newest first
      history = generatedHistory.reverse();
    }
  }

  return history;
};

/**
 * Get all salary history for a company (admin view)
 * @param {String} companyId - Tenant company ID
 * @param {Object} filters - Optional filters (staffId, startDate, endDate)
 * @returns {Array} All salary history entries
 */
const getAllSalaryHistory = async (companyId, filters = {}) => {
  const query = { companyId };

  if (filters.staffId) {
    query.staffId = filters.staffId;
  }

  if (filters.startDate || filters.endDate) {
    query.effectiveDate = {};
    if (filters.startDate) {
      query.effectiveDate.$gte = new Date(filters.startDate);
    }
    if (filters.endDate) {
      query.effectiveDate.$lte = new Date(filters.endDate);
    }
  }

  const history = await SalaryHistory.find(query)
    .populate("staffId", "name email role team")
    .populate("createdBy", "name email")
    .populate("expenseId", "amount date category")
    .sort({ effectiveDate: -1, createdAt: -1 }); // Newest first

  return history;
};

/**
 * Duplicate variable expenses from previous month to current month
 * @param {String} companyId - Tenant company ID
 * @param {Number} sourceMonth - Source month (1-12)
 * @param {Number} sourceYear - Source year
 * @param {Number} targetMonth - Target month (1-12)
 * @param {Number} targetYear - Target year
 * @param {String} userId - User ID who is duplicating
 * @returns {Object} Result with count of duplicated expenses
 */
const duplicateVariableExpensesFromMonth = async (
  companyId,
  sourceMonth,
  sourceYear,
  targetMonth,
  targetYear,
  userId,
) => {
  // Calculate date ranges
  const sourceStartDate = new Date(sourceYear, sourceMonth - 1, 1);
  const sourceEndDate = new Date(sourceYear, sourceMonth, 0, 23, 59, 59);
  const targetStartDate = new Date(targetYear, targetMonth - 1, 1);
  const targetEndDate = new Date(targetYear, targetMonth, 0, 23, 59, 59);

  // Get all variable expenses from source month
  const sourceExpenses = await Expense.find({
    companyId,
    expenseType: "variable",
    date: {
      $gte: sourceStartDate,
      $lte: sourceEndDate,
    },
  }).populate("staffId", "name email");

  if (sourceExpenses.length === 0) {
    return {
      success: false,
      message: `No variable expenses found for ${sourceMonth}/${sourceYear}`,
      count: 0,
    };
  }

  // Check for conflicts and group expenses by staffId
  const duplicatedExpenses = [];
  const failedExpenses = [];

  for (const sourceExpense of sourceExpenses) {
    // Check if target month already has expense for this staffId
    const targetStaffId = sourceExpense.staffId?._id || sourceExpense.staffId;

    const existingTargetExpense = await Expense.findOne({
      companyId,
      expenseType: "variable",
      staffId: targetStaffId,
      date: {
        $gte: targetStartDate,
        $lte: targetEndDate,
      },
    });

    if (existingTargetExpense) {
      const staffName = sourceExpense.staffId?.name || "Unknown";
      failedExpenses.push({
        staffName,
        reason: `${staffName} already has an entry in ${targetMonth}/${targetYear}`,
      });
      continue;
    }

    // Calculate the day of month (keep same day if possible, otherwise use last day of target month)
    const sourceDay = sourceExpense.date.getDate();
    const lastDayOfTargetMonth = new Date(targetYear, targetMonth, 0).getDate();
    const targetDay = Math.min(sourceDay, lastDayOfTargetMonth);

    const targetDate = new Date(targetYear, targetMonth - 1, targetDay);

    // Create new expense with same data but new date
    const newExpense = await Expense.create({
      companyId: sourceExpense.companyId,
      expenseType: sourceExpense.expenseType,
      category: sourceExpense.category,
      staffId: sourceExpense.staffId,
      department: sourceExpense.department,
      type: sourceExpense.type,
      amount: sourceExpense.amount,
      description: sourceExpense.description,
      date: targetDate,
      vendor: sourceExpense.vendor,
      paymentMethod: sourceExpense.paymentMethod,
      notes: sourceExpense.notes,
      remarks: sourceExpense.remarks,
      referral: sourceExpense.referral,
      receipt: sourceExpense.receipt,
      toolName: sourceExpense.toolName,
      websiteUrl: sourceExpense.websiteUrl,
      startDate: sourceExpense.startDate,
      expiryDate: sourceExpense.expiryDate,
      createdBy: userId,
    });

    // Create salary history entry if staffId exists
    if (sourceExpense.staffId) {
      // Find the most recent expense before this new one to check if amount changed
      const previousExpense = await Expense.findOne({
        companyId,
        expenseType: "variable",
        staffId: sourceExpense.staffId,
        _id: { $ne: newExpense._id },
      }).sort({ date: -1 });

      if (previousExpense && previousExpense.amount !== newExpense.amount) {
        const changeType =
          newExpense.amount > previousExpense.amount ? "increment" : "decrement";
        await SalaryHistory.create({
          companyId,
          staffId: sourceExpense.staffId,
          expenseId: newExpense._id,
          oldSalary: previousExpense.amount,
          newSalary: newExpense.amount,
          changeType,
          effectiveDate: targetDate,
          reason: `Duplicated from ${sourceMonth}/${sourceYear}`,
          createdBy: userId,
        });
      } else if (!previousExpense) {
        await SalaryHistory.create({
          companyId,
          staffId: sourceExpense.staffId,
          expenseId: newExpense._id,
          oldSalary: 0,
          newSalary: newExpense.amount,
          changeType: "initial",
          effectiveDate: targetDate,
          reason: `Duplicated from ${sourceMonth}/${sourceYear}`,
          createdBy: userId,
        });
      }
    }

    duplicatedExpenses.push(newExpense);
  }

  let message = `Successfully duplicated ${duplicatedExpenses.length} variable expense(s) from ${sourceMonth}/${sourceYear} to ${targetMonth}/${targetYear}`;

  if (failedExpenses.length > 0) {
    message += `\n\n${failedExpenses.length} expense(s) could not be duplicated:\n`;
    failedExpenses.forEach(({ staffName, reason }) => {
      message += `- ${reason}\n`;
    });
  }

  return {
    success: duplicatedExpenses.length > 0,
    message,
    count: duplicatedExpenses.length,
    failedCount: failedExpenses.length,
    expenses: duplicatedExpenses,
  };
};

module.exports = {
  getAllExpenses,
  getExpensesDropdown,
  createExpense,
  updateExpense,
  deleteExpense,
  getExpenseStats,
  getMonthlySummary,
  getTotalExpenses,
  getTotalRevenue,
  getProfitLoss,
  duplicateFixedExpensesFromMonth,
  duplicateVariableExpensesFromMonth,
  getSalaryHistoryByEmployee,
  getAllSalaryHistory,
};
