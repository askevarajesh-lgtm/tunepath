const User = require('../auth/user.model');
const { validatePhoneNumber } = require('../../utils/phoneValidation');

const { isSupportedProductIntegration } = require('../../utils/supportedIntegrations');

const normalizeIntegrations = (value) => {
  if (!Array.isArray(value)) return [];
  return [...new Set(
    value
      .filter((v) => typeof v === 'string')
      .map((v) => v.trim())
      .filter((v) => Boolean(v) && isSupportedProductIntegration(v))
  )];
};

const validateIntegrationsArray = async (integrations, req) => {
  if (integrations === undefined) return [];
  const normalized = normalizeIntegrations(integrations);
  if (normalized.length === 0) return [];

  const role = req.user?.role;
  if (["super_admin", "supreme_super_admin", "commander_admin"].includes(role)) {
    return normalized; // Platform admins can assign any validly formatted integration type
  }

  const { getEffectivePackageIntegrations, resolveCompanyUser } = require('../packages/packageAccess.service');
  const allowedIntegrations = await getEffectivePackageIntegrations(req.user);
  const companyUser = await resolveCompanyUser(req.user);
  
  let finalAllowed = [...allowedIntegrations];
  
  if (companyUser && ['agency_super_admin', 'commander_admin', 'supreme_super_admin'].includes(companyUser.role)) {
    const disabled = companyUser.disabledPackageIntegrations || [];
    finalAllowed = finalAllowed.filter(i => !disabled.includes(i));
    
    const additional = companyUser.additionalIntegrations || [];
    finalAllowed = [...new Set([...finalAllowed, ...additional])];
  }

  const allowedTypes = new Set(finalAllowed);

  for (const type of normalized) {
    if (!allowedTypes.has(type)) {
      throw new Error(`Integration type "${type}" is invalid or not available in your scope.`);
    }
  }
  return normalized;
};

exports.getAgencies = async (req, res, next) => {
  try {
    let filter = {};
    if (req.user && req.user.role === 'commander_admin') {
      filter.role = { $in: ['agency_super_admin'] };
      filter.createdBy = req.user._id;
    } else {
      // Supreme Super Admin / Superadmin sees all top-level agencies
      filter.role = { $in: ['commander_admin', 'agency_super_admin'] };
    }
    const agencies = await User.find(filter).sort({ createdAt: -1 });

    const Package = require('../packages/package.model');
    const SubscriptionPlan = require('../subscriptions/subscription.model');
    const planIds = [...new Set(agencies.map(a => a.plan).filter(Boolean))];
    const [packages, subs] = await Promise.all([
      Package.find({ _id: { $in: planIds } }).lean(),
      SubscriptionPlan.find({ _id: { $in: planIds } }).lean()
    ]);
    const planMap = {};
    packages.forEach(p => planMap[p._id.toString()] = p);
    subs.forEach(s => planMap[s._id.toString()] = s);

    const data = await Promise.all(agencies.map(async (agency) => {
      const usersCount = await User.countDocuments({
        agencyId: agency._id,
        brandId: null, // Ensure we do not count brand users
        _id: { $ne: agency._id }, // Exclude the agency admin itself
        role: { $in: ['agency_manager', 'user'] }
      });
      const clientsCount = await User.countDocuments({
        agencyId: agency._id,
        role: { $in: ['brand_super_admin', 'brand_manager', 'agency_client'] },
        isDirect: false
      });
      
      const obj = agency.toObject();
      if (obj.plan) {
        obj.plan = planMap[obj.plan.toString()] || obj.plan;
      }
      
      let agencyMrr = obj.mrr || 0;
      if (!agencyMrr && obj.plan && obj.plan.price) {
          agencyMrr = parseFloat(String(obj.plan.price).replace(/[^\d.]/g, '')) || 0;
      }
      obj.mrr = agencyMrr;

      return {
        ...obj,
        usersCount,
        clientsCount
      };
    }));

    res.status(200).json({ success: true, count: data.length, data });
  } catch (error) {
    next(error);
  }
};

exports.getAgency = async (req, res, next) => {
  try {
    const targetRoles = ['agency_super_admin', 'commander_admin'];
    const agency = await User.findOne({ _id: req.params.id, role: { $in: targetRoles } });
    if (!agency) {
      return res.status(404).json({ success: false, message: 'Agency not found' });
    }
    res.status(200).json({ success: true, data: agency });
  } catch (error) {
    next(error);
  }
};

exports.createAgency = async (req, res, next) => {
  try {
    const { name, email, password, phone, countryCode, package: packageId, plan, status, logo, logoDark } = req.body;
    const targetRole = req.user && req.user.role === 'commander_admin' ? 'agency_super_admin' : 'commander_admin';

    // Validate Phone Number
    if (phone) {
      const validation = validatePhoneNumber(phone, countryCode);
      if (!validation.isValid) {
        return res.status(400).json({ success: false, message: validation.message });
      }
    }

    // Check if user with this email already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ success: false, message: 'User with this email already exists' });
    }

    // Fetch the selected package to get features, integrations, and user limits
    let packageFeatures = [];
    let packageIntegrations = [];
    let packageUsers = 5;
    const planOrId = plan || packageId;
    if (planOrId) {
      const Package = require('../packages/package.model');
      let pkg = await Package.findOne({ _id: planOrId, type: 'agency' });
      if (!pkg) {
        const SubscriptionPlan = require('../subscriptions/subscription.model');
        pkg = await SubscriptionPlan.findOne({ _id: planOrId });
      }
      if (!pkg) {
        return res.status(400).json({ success: false, message: 'Selected package not found' });
      }
      packageFeatures = pkg.features || [];
      packageIntegrations = pkg.integrations || [];
      packageUsers = pkg.users || 5;
      
      const now = new Date();
      req.body.subscriptionStartDate = now;
      
      const interval = pkg.billingInterval || pkg.interval || 'Monthly';
      req.body.billingInterval = (interval === '/month' ? 'Monthly' : (interval === '/year' ? 'Yearly' : interval));
      
      if (req.body.billingInterval === 'Monthly') {
        req.body.subscriptionEndDate = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
      } else if (req.body.billingInterval === 'Yearly') {
        req.body.subscriptionEndDate = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000);
      } else {
        req.body.subscriptionEndDate = null; // One Time
      }
    }

    // Enforce security: integrations must strictly be a subset of packageIntegrations, or default to packageIntegrations
    let finalIntegrations = packageIntegrations;
    if (req.body.integrations && Array.isArray(req.body.integrations)) {
      const invalid = req.body.integrations.filter(i => !packageIntegrations.includes(i));
      if (invalid.length > 0) {
        return res.status(400).json({
          success: false,
          message: `Privilege escalation prevented. Selected integrations not enabled in agency package: ${invalid.join(', ')}`
        });
      }
      finalIntegrations = req.body.integrations;
    }

    let finalAdditional = [];
    if (req.body.additionalIntegrations) {
      try {
        const validated = await validateIntegrationsArray(req.body.additionalIntegrations, req);
        // filter out package integrations from additionalIntegrations
        finalAdditional = validated.filter(i => !packageIntegrations.includes(i));
      } catch (err) {
        return res.status(400).json({ success: false, message: err.message });
      }
    }

    let finalDisabled = [];
    if (req.body.disabledPackageIntegrations) {
      try {
        const validated = await validateIntegrationsArray(req.body.disabledPackageIntegrations, req);
        // exclusions can only apply to package integrations
        finalDisabled = validated.filter(i => packageIntegrations.includes(i));
      } catch (err) {
        return res.status(400).json({ success: false, message: err.message });
      }
    }

    // Create the Company/Agency
    const agencyUser = await User.create({
      name: name,
      email,
      phone,
      countryCode: countryCode || (phone ? '91' : undefined),
      password: password || undefined,
      role: targetRole,
      companyName: name,
      plan: plan || packageId || null,
      status: status || 'active',
      logo: logo || null,
      logoDark: logoDark || null,
      features: req.body.features || packageFeatures,
      integrations: finalIntegrations,
      additionalIntegrations: finalAdditional,
      disabledPackageIntegrations: finalDisabled,
      allowedUsers: packageUsers,
      subscriptionStartDate: req.body.subscriptionStartDate,
      subscriptionEndDate: req.body.subscriptionEndDate,
      billingInterval: req.body.billingInterval,
      createdBy: req.user ? req.user._id : undefined
    });

    agencyUser.agencyId = agencyUser._id;
    await agencyUser.save();

    // If a logo is provided, make it the global default for Commander Admin
    if (logo || logoDark) {
      const updateData = {};
      if (logo) updateData.logo = logo;
      if (logoDark) updateData.logoDark = logoDark;
      await User.updateMany({ role: 'commander_admin' }, { $set: updateData });
    }

    // Dispatch system notification
    const { dispatchSystemNotification } = require('../tasks/notification.service');
    const companyId = req.user?.workspaceId || agencyUser._id;
    if (companyId) {
      await dispatchSystemNotification(
        companyId,
        'agencyCreated',
        'agency_created',
        'New Agency Created',
        `Agency ${agencyUser.companyName} (${agencyUser.email}) has been created.`,
        { agencyId: agencyUser._id }
      );
    }

    res.status(201).json({ success: true, data: agencyUser });
  } catch (error) {
    next(error);
  }
};

exports.updateAgency = async (req, res, next) => {
  try {
    const targetRoles = ['agency_super_admin', 'commander_admin'];
    if (req.body.package && !req.body.plan) {
      req.body.plan = req.body.package;
      delete req.body.package;
    }

    const currentAgency = await User.findOne({ _id: req.params.id, role: { $in: targetRoles } });
    if (!currentAgency) {
      return res.status(404).json({ success: false, message: 'Agency not found' });
    }

    const activePlanId = req.body.plan !== undefined ? req.body.plan : (currentAgency.plan?._id || currentAgency.plan);

    let packageIntegrations = [];
    let packageFeatures = [];
    let packageUsers = 5;
    if (activePlanId) {
      const Package = require('../packages/package.model');
      let pkg = await Package.findOne({ _id: activePlanId, type: 'agency' });
      if (!pkg) {
        const SubscriptionPlan = require('../subscriptions/subscription.model');
        pkg = await SubscriptionPlan.findOne({ _id: activePlanId });
      }
      if (!pkg && req.body.plan !== undefined && req.body.plan !== null) {
        return res.status(400).json({ success: false, message: 'Selected package not found' });
      }
      if (pkg) {
        packageIntegrations = pkg.integrations || [];
        packageFeatures = pkg.features || [];
        packageUsers = pkg.users || 5;
      }
    }

    if (req.body.plan !== undefined) {
      req.body.features = req.body.features || packageFeatures;
      req.body.integrations = packageIntegrations;
      req.body.allowedUsers = packageUsers;

      if (req.body.integrations !== undefined && Array.isArray(req.body.integrations)) {
        const invalid = req.body.integrations.filter(i => !packageIntegrations.includes(i));
        if (invalid.length > 0) {
          return res.status(400).json({
            success: false,
            message: `Privilege escalation prevented. Selected integrations not enabled in agency package: ${invalid.join(', ')}`
          });
        }
      }
    } else {
      if (req.body.integrations !== undefined) {
        if (Array.isArray(req.body.integrations)) {
          const invalid = req.body.integrations.filter(i => !packageIntegrations.includes(i));
          if (invalid.length > 0) {
            return res.status(400).json({
              success: false,
              message: `Privilege escalation prevented. Selected integrations not enabled in agency package: ${invalid.join(', ')}`
            });
          }
        }
      }
    }

    if (req.body.additionalIntegrations !== undefined) {
      try {
        const validated = await validateIntegrationsArray(req.body.additionalIntegrations, req);
        req.body.additionalIntegrations = validated.filter(i => !packageIntegrations.includes(i));
      } catch (err) {
        return res.status(400).json({ success: false, message: err.message });
      }
    } else if (req.body.plan !== undefined) {
      const currentAdditional = currentAgency.additionalIntegrations || [];
      req.body.additionalIntegrations = currentAdditional.filter(i => !packageIntegrations.includes(i));
    }

    if (req.body.disabledPackageIntegrations !== undefined) {
      try {
        const validated = await validateIntegrationsArray(req.body.disabledPackageIntegrations, req);
        req.body.disabledPackageIntegrations = validated.filter(i => packageIntegrations.includes(i));
      } catch (err) {
        return res.status(400).json({ success: false, message: err.message });
      }
    } else if (req.body.plan !== undefined) {
      const currentDisabled = currentAgency.disabledPackageIntegrations || [];
      req.body.disabledPackageIntegrations = currentDisabled.filter(i => packageIntegrations.includes(i));
    }

    const finalDisabled = req.body.disabledPackageIntegrations !== undefined ? req.body.disabledPackageIntegrations : (currentAgency.disabledPackageIntegrations || []);
    const finalAdditional = req.body.additionalIntegrations !== undefined ? req.body.additionalIntegrations : (currentAgency.additionalIntegrations || []);
    const finalIntegrations = packageIntegrations.filter(i => !finalDisabled.includes(i));
    finalIntegrations.push(...finalAdditional);
    req.body.integrations = [...new Set(finalIntegrations)];


    if ((req.body.logo || req.body.logoDark) && req.user && req.user.role === 'commander_admin') {
      const updateData = {};
      if (req.body.logo) updateData.logo = req.body.logo;
      if (req.body.logoDark) updateData.logoDark = req.body.logoDark;
      await User.updateMany({ role: 'commander_admin' }, { $set: updateData });
    }
    
    if (req.body.password) {
      const bcrypt = require('bcryptjs');
      const salt = await bcrypt.genSalt(10);
      req.body.password = await bcrypt.hash(req.body.password, salt);
    } else {
      delete req.body.password;
    }
    
    const agency = await User.findOneAndUpdate(
      { _id: req.params.id, role: { $in: targetRoles } },
      req.body,
      { returnDocument: 'after', runValidators: true }
    );
    if (!agency) {
      return res.status(404).json({ success: false, message: 'Agency not found' });
    }
    res.status(200).json({ success: true, data: agency });
  } catch (error) {
    next(error);
  }
};

exports.deleteAgency = async (req, res, next) => {
  try {
    const targetRoles = ['agency_super_admin', 'commander_admin'];
    const agency = await User.findOneAndDelete({ _id: req.params.id, role: { $in: targetRoles } });
    if (!agency) {
      return res.status(404).json({ success: false, message: 'Agency not found' });
    }
    // Also delete all users associated with this agency
    await User.deleteMany({ agencyId: agency._id });

    res.status(200).json({ success: true, data: {} });
  } catch (error) {
    next(error);
  }
};

exports.getDashboardStats = async (req, res, next) => {
  try {
    const agencyId = req.user.agencyId || req.user._id;
    const { month, year } = req.query;
    
    let dateFilter = {};
    if (month !== undefined && year !== undefined) {
      const startDate = new Date(parseInt(year), parseInt(month), 1);
      const endDate = new Date(parseInt(year), parseInt(month) + 1, 0, 23, 59, 59, 999);
      dateFilter = { createdAt: { $gte: startDate, $lte: endDate } };
    }

    // 1. Calculate Agency MRR (Sum of MRR from all clients)
    const clients = await User.find({
      agencyId,
      role: { $in: ['brand_super_admin', 'brand_manager', 'agency_client'] },
      status: 'active',
      ...dateFilter
    });
    
    let totalMrr = 0;
    clients.forEach(c => {
      totalMrr += c.mrr || 0;
    });
    const activeClientsCount = clients.length;

    // 2. Count Team Members (Excluding clients)
    const teamMembersListRaw = await User.find({
      $or: [{ agencyId }, { _id: agencyId }],
      brandId: null,
      role: { $nin: ['brand_super_admin', 'brand_manager', 'agency_client', 'superadmin', 'supreme_super_admin'] },
      ...dateFilter
    }).select('name email phone role status createdAt');
    const teamMembersCount = teamMembersListRaw.length;

    // 3. Team Performance (List of Agency Managers)
    const managers = await User.find({
      $or: [{ agencyId }, { _id: agencyId }],
      role: 'agency_manager',
      ...dateFilter
    }).select('name email phone role roleName status createdAt');

    const teamPerformance = managers.map(m => ({
      key: m._id,
      name: m.name,
      email: m.email,
      phone: m.phone || 'N/A',
      role: m.roleName || 'Agency Manager',
      status: m.status === 'active' ? 'Active' : 'Inactive'
    }));

    // 4. Invoices Calculation
    const Invoice = require('../invoices/invoice.model');
    const invoices = await Invoice.find({
      agencyId,
      isDeleted: false,
      ...dateFilter
    });

    let totalInvoiceAmount = 0;
    let totalPaidAmount = 0;
    let pendingAmount = 0;

    invoices.forEach(inv => {
      totalInvoiceAmount += inv.grandTotal || 0;
      totalPaidAmount += inv.totalPaid || 0;
      pendingAmount += inv.pendingAmount || 0;
    });

    // We can define Revenue as Total Paid Amount + MRR (or just Total Paid for now)
    const revenue = totalPaidAmount;

    // 5. Chart Data (Revenue per month for the last 6 months)
    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const chartDataMap = {};
    const today = (month !== undefined && year !== undefined) ? new Date(parseInt(year), parseInt(month), 15) : new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
      chartDataMap[`${d.getFullYear()}-${d.getMonth()}`] = {
        name: monthNames[d.getMonth()],
        revenue: 0,
        sortOrder: d.getTime()
      };
    }

    invoices.forEach(inv => {
      if (inv.createdAt) {
        const d = new Date(inv.createdAt);
        const key = `${d.getFullYear()}-${d.getMonth()}`;
        if (chartDataMap[key] !== undefined) {
          chartDataMap[key].revenue += inv.totalPaid || 0;
        }
      }
    });

    const chartData = Object.values(chartDataMap).sort((a, b) => a.sortOrder - b.sortOrder).map(item => ({
      name: item.name,
      revenue: item.revenue
    }));

    // 6. Recent Activities
    const recentActivities = [];
    
    // Recent Clients
    const recentClients = await User.find({
      agencyId,
      role: { $in: ['brand_super_admin', 'brand_manager', 'agency_client'] },
      status: 'active'
    }).sort({ createdAt: -1 }).limit(3);
    
    recentClients.forEach(c => {
      recentActivities.push({
        id: `client_${c._id}`,
        title: `New Client Onboarded: ${c.name || c.companyName}`,
        time: c.createdAt ? c.createdAt.toDateString() : 'Recently',
        type: 'client',
        createdAt: c.createdAt
      });
    });

    // Recent Invoices
    const recentInvoices = invoices.sort((a, b) => {
      const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return dateB - dateA;
    }).slice(0, 3);

    recentInvoices.forEach(inv => {
      recentActivities.push({
        id: `invoice_${inv._id}`,
        title: `Invoice ${inv.invoiceNumber} Generated`,
        time: inv.createdAt ? inv.createdAt.toDateString() : 'Recently',
        type: 'invoice',
        createdAt: inv.createdAt
      });
    });

    // Sort combined activities by date
    recentActivities.sort((a, b) => {
      if (!a.createdAt) return 1;
      if (!b.createdAt) return -1;
      return new Date(b.createdAt) - new Date(a.createdAt);
    });

    const formatCurrency = (val) => `₹${val.toLocaleString('en-IN')}`;

    res.status(200).json({
      success: true,
      data: {
        agencyMrr: `₹${(totalMrr / 100000).toFixed(1)}L`,
        grossMargin: 'N/A', // Cannot be computed without costs
        activeClients: activeClientsCount,
        teamMembers: teamMembersCount,
        totalInvoiceAmount: formatCurrency(totalInvoiceAmount),
        totalPaidAmount: formatCurrency(totalPaidAmount),
        pendingAmount: formatCurrency(pendingAmount),
        revenue: formatCurrency(revenue),
        teamPerformance,
        chartData,
        recentActivities: recentActivities.slice(0, 5), // Return top 5
        clientsList: clients.map(c => ({ id: c._id, name: c.name || c.companyName, email: c.email, mrr: c.mrr, status: c.status })),
        invoicesList: invoices.map(inv => ({ id: inv._id, invoiceNumber: inv.invoiceNumber, grandTotal: inv.grandTotal, totalPaid: inv.totalPaid, pendingAmount: inv.pendingAmount, status: inv.status, createdAt: inv.createdAt })),
        teamMembersList: teamMembersListRaw.map(t => ({ id: t._id, name: t.name, email: t.email, role: t.role, status: t.status }))
      }
    });
  } catch (error) {
    next(error);
  }
};