const Proposal = require('./proposal.model');
const Invoice = require('../invoices/invoice.model');
const MasterItem = require('../masterItems/masterItem.model');

const syncProposalStatus = async (proposals) => {
  if (!proposals) return;
  const list = Array.isArray(proposals) ? proposals : [proposals];
  if (list.length === 0) return;

  const proposalIds = list.map(p => p._id).filter(Boolean);
  if (proposalIds.length === 0) return;

  const activeInvoices = await Invoice.find({ proposalId: { $in: proposalIds }, isDeleted: false }).select('proposalId').lean();
  const invoiceProposalIdSet = new Set(activeInvoices.map(i => i.proposalId.toString()));

  for (const p of list) {
    if (!p || !p._id) continue;
    const hasInvoice = invoiceProposalIdSet.has(p._id.toString());
    if (hasInvoice) {
      if (p.status !== 'Invoice Created') {
        p.status = 'Invoice Created';
        await Proposal.updateOne({ _id: p._id }, { $set: { status: 'Invoice Created' } });
      }
    } else {
      if (p.status === 'Converted to Invoice' || p.status === 'Invoice Created') {
        p.status = 'Draft';
        await Proposal.updateOne({ _id: p._id }, { $set: { status: 'Draft' } });
      }
    }
  }
};

// Create Proposal
exports.createProposal = async (req, res, next) => {
  try {
    const data = { ...req.body };
    data.createdBy = req.user._id;

    const isClient = ['client', 'agency_client', 'brand_team_user', 'client_user', 'brand_manager', 'brand_super_admin'].includes(req.user.role);

    if (req.user.role === 'commander_admin') {
      data.adminId = req.user._id;
    } else if (isClient) {
      data.brandId = req.user.brandId || req.user._id;
      data.clientId = req.user.brandId || req.user._id;
      data.agencyId = req.companyId || req.user.agencyId;
      if (req.user.adminId) data.adminId = req.user.adminId;
    } else {
      data.agencyId = req.companyId || req.user.agencyId || req.user._id;
      if (req.user.adminId) data.adminId = req.user.adminId;
    }

    if (data.customMasterItem) {
      const customData = {
        ...data.customMasterItem,
        isCustom: true,
        createdBy: data.createdBy,
        adminId: data.adminId,
        agencyId: data.agencyId,
        brandId: data.brandId
      };
      const newMasterItem = await MasterItem.create(customData);
      data.masterItems = [newMasterItem._id];
      delete data.customMasterItem;
    }

    const proposal = await Proposal.create(data);
    res.status(201).json({ success: true, data: proposal });
  } catch (error) {
    next(error);
  }
};

// Get All Proposals
exports.getProposals = async (req, res, next) => {
  try {
    let queryFilter = { isDeleted: false };
    
    // Pagination & Search
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 50;
    const skip = (page - 1) * limit;

    if (req.query.search) {
      queryFilter.$or = [
        { name: { $regex: req.query.search, $options: 'i' } },
        { proposalNumber: { $regex: req.query.search, $options: 'i' } }
      ];
    }
    if (req.query.status && req.query.status !== 'all') {
      if (req.query.status === 'Invoice Created' || req.query.status === 'Converted to Invoice') {
        queryFilter.status = { $in: ['Invoice Created', 'Converted to Invoice'] };
      } else {
        queryFilter.status = req.query.status;
      }
    }
    if (req.query.month) {
      const [yearStr, monthStr] = req.query.month.split('-');
      if (yearStr && monthStr) {
        const year = parseInt(yearStr, 10);
        const month = parseInt(monthStr, 10);
        const startOfMonth = new Date(year, month - 1, 1, 0, 0, 0, 0);
        const endOfMonth = new Date(year, month, 0, 23, 59, 59, 999);
        queryFilter.createdAt = { $gte: startOfMonth, $lte: endOfMonth };
      }
    } else if (req.query.startDate && req.query.endDate) {
      const start = new Date(req.query.startDate);
      start.setHours(0, 0, 0, 0);
      const end = new Date(req.query.endDate);
      end.setHours(23, 59, 59, 999);
      queryFilter.createdAt = { $gte: start, $lte: end };
    }

    const isClient = ['client', 'agency_client', 'brand_team_user', 'client_user', 'brand_manager', 'brand_super_admin'].includes(req.user.role);

    if (req.user.role === 'commander_admin') {
      queryFilter.adminId = req.user._id;
    } else if (isClient) {
      queryFilter.clientId = req.user.brandId || req.user._id;
    } else {
      queryFilter.agencyId = req.companyId || req.user.agencyId || req.user._id;
      if (req.query.clientId && req.query.clientId !== 'all') {
        queryFilter.clientId = req.query.clientId;
      }
    }

    const total = await Proposal.countDocuments(queryFilter);
    const proposals = await Proposal.find(queryFilter)
      .populate('clientId', 'name companyName email')
      .populate('masterItems', 'name itemCode price categories handlingDuration description applicableAccess isCampaign campaignDetails department departmentId')
      .populate('createdBy', 'name email roleName')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    await syncProposalStatus(proposals);

    res.status(200).json({ 
      success: true, 
      count: proposals.length,
      total,
      page,
      pages: Math.ceil(total / limit),
      data: proposals 
    });
  } catch (error) {
    next(error);
  }
};

// Get Single Proposal
exports.getProposal = async (req, res, next) => {
  try {
    const proposal = await Proposal.findOne({ _id: req.params.id, isDeleted: false })
      .populate('clientId', 'name companyName email address phone')
      .populate('masterItems', 'name itemCode category categories price duration description handlingDuration applicableAccess isCampaign campaignDetails department departmentId isCustom')
      .populate('agencyId', 'name companyName email phone supportPhone address domain logo logoDark industry invoiceSignature')
      .populate('adminId', 'name companyName email phone supportPhone address domain logo logoDark industry invoiceSignature')
      .populate('createdBy', 'name companyName email phone supportPhone address domain logo logoDark industry invoiceSignature');
    if (!proposal) {
      return res.status(404).json({ success: false, message: 'Proposal not found' });
    }

    await syncProposalStatus(proposal);

    res.status(200).json({ success: true, data: proposal });
  } catch (error) {
    next(error);
  }
};

// Update Proposal
exports.updateProposal = async (req, res, next) => {
  try {
    const proposal = await Proposal.findOne({ _id: req.params.id, isDeleted: false });
    if (!proposal) {
      return res.status(404).json({ success: false, message: 'Proposal not found' });
    }

    req.body.updatedBy = req.user._id;

    if (req.body.customMasterItem) {
      const customData = {
        ...req.body.customMasterItem,
        isCustom: true,
        createdBy: req.body.updatedBy,
        adminId: proposal.adminId,
        agencyId: proposal.agencyId,
        brandId: proposal.brandId
      };
      const newMasterItem = await MasterItem.create(customData);
      req.body.masterItems = [newMasterItem._id];
      delete req.body.customMasterItem;
    }

    await Proposal.findByIdAndUpdate(req.params.id, req.body, { runValidators: true });
    const updatedProposal = await Proposal.findById(req.params.id)
      .populate('clientId', 'name companyName email address phone')
      .populate('masterItems', 'name itemCode category categories price duration description handlingDuration applicableAccess isCampaign campaignDetails department departmentId isCustom')
      .populate('agencyId', 'name companyName email phone supportPhone address domain logo logoDark industry invoiceSignature')
      .populate('adminId', 'name companyName email phone supportPhone address domain logo logoDark industry invoiceSignature')
      .populate('createdBy', 'name companyName email phone supportPhone address domain logo logoDark industry invoiceSignature');
    
    await syncProposalStatus(updatedProposal);

    res.status(200).json({ success: true, data: updatedProposal });
  } catch (error) {
    next(error);
  }
};

// Soft Delete Proposal
exports.deleteProposal = async (req, res, next) => {
  try {
    const proposal = await Proposal.findOne({ _id: req.params.id, isDeleted: false });
    if (!proposal) {
      return res.status(404).json({ success: false, message: 'Proposal not found' });
    }

    proposal.isDeleted = true;
    proposal.updatedBy = req.user._id;
    await proposal.save();

    res.status(200).json({ success: true, message: 'Proposal deleted successfully' });
  } catch (error) {
    next(error);
  }
};

// Approve Proposal
exports.approveProposal = async (req, res, next) => {
  try {
    const proposal = await Proposal.findOne({ _id: req.params.id, isDeleted: false });
    if (!proposal) {
      return res.status(404).json({ success: false, message: 'Proposal not found' });
    }

    proposal.status = 'Approved';
    proposal.updatedBy = req.user._id;
    await proposal.save();

    res.status(200).json({ success: true, data: proposal, message: 'Proposal approved' });
  } catch (error) {
    next(error);
  }
};

// Generate Invoice from Proposal
exports.generateInvoice = async (req, res, next) => {
  try {
    const proposal = await Proposal.findOne({ _id: req.params.id, isDeleted: false });
    if (!proposal) {
      return res.status(404).json({ success: false, message: 'Proposal not found' });
    }
    if (proposal.status !== 'Approved' && proposal.status !== 'Draft') {
      return res.status(400).json({ success: false, message: 'Invalid proposal status to generate invoice' });
    }

    // Check if invoice already exists
    const existingInvoice = await Invoice.findOne({ proposalId: proposal._id, isDeleted: false });
    if (existingInvoice) {
      proposal.status = 'Invoice Created';
      await proposal.save();
      return res.status(400).json({ success: false, message: 'Invoice already generated for this proposal', invoiceId: existingInvoice._id });
    }

    // Create Invoice
    const invoiceData = {
      proposalId: proposal._id,
      clientId: proposal.clientId,
      amount: proposal.subtotal,
      tax: proposal.tax,
      discount: proposal.discount,
      grandTotal: proposal.grandTotal,
      dueDate: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000), // Default +15 days
      createdBy: req.user._id,
      adminId: proposal.adminId,
      agencyId: proposal.agencyId,
      brandId: proposal.brandId
    };

    const invoice = await Invoice.create(invoiceData);

    proposal.status = 'Invoice Created';
    await proposal.save();

    res.status(201).json({ success: true, data: invoice, message: 'Invoice generated successfully' });
  } catch (error) {
    next(error);
  }
};

// Approve and Generate Invoice
exports.approveAndGenerateInvoice = async (req, res, next) => {
  try {
    const proposal = await Proposal.findOne({ _id: req.params.id, isDeleted: false });
    if (!proposal) {
      return res.status(404).json({ success: false, message: 'Proposal not found' });
    }

    // Check if invoice already exists
    const existingInvoice = await Invoice.findOne({ proposalId: proposal._id, isDeleted: false });
    if (existingInvoice) {
      proposal.status = 'Invoice Created';
      proposal.updatedBy = req.user._id;
      await proposal.save();
      return res.status(200).json({
        success: true,
        data: {
          proposal,
          invoice: existingInvoice
        },
        message: 'Invoice already exists for this proposal.'
      });
    }

    // Create Invoice
    const invoiceData = {
      proposalId: proposal._id,
      clientId: proposal.clientId,
      amount: proposal.subtotal,
      tax: proposal.tax,
      discount: proposal.discount,
      grandTotal: proposal.grandTotal,
      dueDate: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000), // Default +15 days
      createdBy: req.user._id,
      adminId: proposal.adminId,
      agencyId: proposal.agencyId,
      brandId: proposal.brandId
    };

    const invoice = await Invoice.create(invoiceData);

    proposal.status = 'Invoice Created';
    proposal.updatedBy = req.user._id;
    await proposal.save();

    res.status(200).json({
      success: true,
      data: {
        proposal,
        invoice
      },
      message: 'Invoice generated successfully'
    });
  } catch (error) {
    next(error);
  }
};

// Generate PDF (Mock implementation)
exports.generatePDF = async (req, res, next) => {
  try {
    // Return a dummy PDF URL or binary stream for now
    res.status(200).json({ success: true, url: '/dummy-proposal.pdf' });
  } catch (error) {
    next(error);
  }
};
