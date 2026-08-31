const Proposal = require('./proposal.model');
const Invoice = require('../invoices/invoice.model');
const MasterItem = require('../masterItems/masterItem.model');

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
    if (req.query.status) {
      queryFilter.status = req.query.status;
    }

    const isClient = ['client', 'agency_client', 'brand_team_user', 'client_user', 'brand_manager', 'brand_super_admin'].includes(req.user.role);

    if (req.user.role === 'commander_admin') {
      queryFilter.adminId = req.user._id;
    } else if (isClient) {
      queryFilter.clientId = req.user.brandId || req.user._id;
    } else {
      queryFilter.agencyId = req.companyId || req.user.agencyId || req.user._id;
      if (req.query.clientId) {
        queryFilter.clientId = req.query.clientId;
      }
    }

    const total = await Proposal.countDocuments(queryFilter);
    const proposals = await Proposal.find(queryFilter)
      .populate('clientId', 'name companyName email')
      .populate('masterItems', 'name itemCode price categories handlingDuration description applicableAccess isCampaign campaignDetails')
      .populate('createdBy', 'name email roleName')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

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
      .populate('masterItems', 'name itemCode category categories price duration description handlingDuration applicableAccess isCampaign campaignDetails')
      .populate('agencyId', 'name companyName email phone supportPhone address domain logo logoDark industry invoiceSignature')
      .populate('adminId', 'name companyName email phone supportPhone address domain logo logoDark industry invoiceSignature')
      .populate('createdBy', 'name companyName email phone supportPhone address domain logo logoDark industry invoiceSignature');
    if (!proposal) {
      return res.status(404).json({ success: false, message: 'Proposal not found' });
    }
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
      // For updates, we can either update the existing custom master item if it's already custom, 
      // or create a new one. Since a proposal might have used a global one previously, 
      // the safest is to create a new custom one and link it.
      const newMasterItem = await MasterItem.create(customData);
      req.body.masterItems = [newMasterItem._id];
      delete req.body.customMasterItem;
    }

    const updatedProposal = await Proposal.findByIdAndUpdate(req.params.id, req.body, { returnDocument: 'after', runValidators: true });
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
    if (proposal.status !== 'Approved') {
      return res.status(400).json({ success: false, message: 'Proposal must be approved to generate invoice' });
    }

    // Check if invoice already exists
    const existingInvoice = await Invoice.findOne({ proposalId: proposal._id, isDeleted: false });
    if (existingInvoice) {
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

    proposal.status = 'Converted to Invoice';
    await proposal.save();

    res.status(201).json({ success: true, data: invoice, message: 'Invoice generated successfully' });
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
