const Invoice = require('./invoice.model');
const Proposal = require('../proposals/proposal.model');
const MasterItem = require('../masterItems/masterItem.model');
const Transaction = require('../transactions/transaction.model');
const { updateInvoiceBalance } = require('../transactions/transaction.controller');
const { getNextGenerationDate } = require('./invoiceDateHelper');

const syncInvoiceStatus = async (invoices) => {
  if (!invoices) return;
  const list = Array.isArray(invoices) ? invoices : [invoices];
  for (const inv of list) {
    if (!inv || !inv._id) continue;

    // Backfill legacy payments marked as Paid without a Transaction record
    if (inv.paymentStatus === 'Paid' || inv.invoiceStatus === 'Paid') {
      const existingTxn = await Transaction.findOne({ invoiceId: inv._id });
      if (!existingTxn) {
        const paidAmount = inv.grandTotal || inv.amount || 0;
        await Transaction.create({
          invoiceId: inv._id,
          companyId: inv.clientId || inv.brandId,
          amount: paidAmount,
          paymentDate: inv.updatedAt || inv.createdAt || new Date(),
          closingInvoiceDate: inv.dueDate || inv.updatedAt || new Date(),
          paymentMethod: inv.paymentMode || 'Bank Transfer',
          referenceNumber: inv.transactionId || `LEGACY-${inv.invoiceNumber || inv._id}`,
          transactionType: inv.paymentMode === 'Razorpay' ? 'Online' : 'Manual',
          status: 'Verified',
          recordedBy: inv.updatedBy || inv.createdBy || inv.agencyId,
          verifiedBy: inv.updatedBy || inv.createdBy || inv.agencyId,
          adminId: inv.adminId,
          agencyId: inv.agencyId,
          brandId: inv.brandId
        });

        inv.totalPaid = paidAmount;
        inv.pendingAmount = 0;
        inv.paymentStatus = 'Paid';
        inv.invoiceStatus = 'Paid';
        await Invoice.updateOne(
          { _id: inv._id },
          {
            $set: {
              totalPaid: paidAmount,
              pendingAmount: 0,
              paymentStatus: 'Paid',
              invoiceStatus: 'Paid'
            }
          }
        );
        continue;
      }
    }

    const verifiedTxns = await Transaction.find({ invoiceId: inv._id, status: { $in: ['Verified', 'Successful'] } });
    const actualPaid = verifiedTxns.reduce((sum, t) => sum + (t.amount || 0), 0);
    const grandTotal = inv.grandTotal || 0;

    let targetPaymentStatus = 'Pending';
    let targetInvoiceStatus = inv.invoiceStatus;

    if (actualPaid >= grandTotal && grandTotal > 0) {
      targetPaymentStatus = 'Paid';
      targetInvoiceStatus = 'Paid';
    } else if (actualPaid > 0) {
      targetPaymentStatus = 'Partially Paid';
      if (targetInvoiceStatus === 'Paid') targetInvoiceStatus = 'Sent';
    } else {
      targetPaymentStatus = 'Pending';
      if (targetInvoiceStatus === 'Paid') targetInvoiceStatus = 'Sent';
    }

    if (inv.totalPaid !== actualPaid || inv.paymentStatus !== targetPaymentStatus || inv.invoiceStatus !== targetInvoiceStatus) {
      inv.totalPaid = actualPaid;
      inv.pendingAmount = Math.max(0, grandTotal - actualPaid);
      inv.paymentStatus = targetPaymentStatus;
      inv.invoiceStatus = targetInvoiceStatus;
      await Invoice.updateOne(
        { _id: inv._id },
        {
          $set: {
            totalPaid: inv.totalPaid,
            pendingAmount: inv.pendingAmount,
            paymentStatus: inv.paymentStatus,
            invoiceStatus: inv.invoiceStatus
          }
        }
      );
    }
  }
};

// Create Invoice
exports.createInvoice = async (req, res, next) => {
  try {
    const data = { ...req.body };
    data.createdBy = req.user._id;

    const isClient = ['client', 'agency_client', 'brand_team_user', 'client_user', 'brand_manager', 'brand_super_admin'].includes(req.user.role);

    if (req.user.role === 'commander_admin') {
      data.adminId = req.user._id;
    } else if (isClient) {
      data.brandId = req.user.brandId || req.user._id;
      data.agencyId = req.companyId || req.user.agencyId;
      if (req.user.adminId) data.adminId = req.user.adminId;
    } else {
      data.agencyId = req.companyId || req.user.agencyId || req.user._id;
      if (req.user.adminId) data.adminId = req.user.adminId;
    }

    if (data.invoiceType === 'Retainer' && data.proposalId) {
      const proposal = await Proposal.findById(data.proposalId).populate('masterItems');
      if (proposal && proposal.masterItems && proposal.masterItems.length > 0) {
        let durationString = '1 Month';
        for (const item of proposal.masterItems) {
          if (item.handlingDuration) {
            durationString = item.handlingDuration;
            break;
          }
        }
        data.retainerDuration = durationString;
        
        const nextDate = getNextGenerationDate(data.invoiceDate || Date.now(), durationString);
        data.nextGenerationDate = nextDate;
      }
    }

    const invoice = await Invoice.create(data);
    res.status(201).json({ success: true, data: invoice });
  } catch (error) {
    next(error);
  }
};

// Update Invoice
exports.updateInvoice = async (req, res, next) => {
  try {
    const invoice = await Invoice.findOne({ _id: req.params.id, isDeleted: false });
    if (!invoice) {
      return res.status(404).json({ success: false, message: 'Invoice not found' });
    }

    req.body.updatedBy = req.user._id;

    const updatedInvoice = await Invoice.findByIdAndUpdate(req.params.id, req.body, { returnDocument: 'after', runValidators: true });
    res.status(200).json({ success: true, data: updatedInvoice });
  } catch (error) {
    next(error);
  }
};

// Get All Invoices
exports.getInvoices = async (req, res, next) => {
  try {
    let queryFilter = { isDeleted: false };
    
    // Pagination & Search
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 50;
    const skip = (page - 1) * limit;

    if (req.query.search) {
      queryFilter.invoiceNumber = { $regex: req.query.search, $options: 'i' };
    }
    if (req.query.paymentStatus) {
      queryFilter.paymentStatus = req.query.paymentStatus;
    }
    if (req.query.invoiceStatus) {
      queryFilter.invoiceStatus = req.query.invoiceStatus;
    }
    if (req.query.clientId) {
      queryFilter.clientId = req.query.clientId;
    }
    if (req.query.companyId) {
      queryFilter.clientId = req.query.companyId;
    }

    const isClient = ['client', 'agency_client', 'brand_team_user', 'client_user', 'brand_manager', 'brand_super_admin'].includes(req.user.role);

    if (req.user.role === 'commander_admin') {
      queryFilter.adminId = req.user._id;
    } else if (isClient) {
      queryFilter.clientId = req.user.brandId || req.user._id;
      queryFilter.invoiceStatus = { $ne: 'Draft' };
    } else {
      queryFilter.agencyId = req.companyId || req.user.agencyId || req.user._id;
    }

    const total = await Invoice.countDocuments(queryFilter);
    const invoices = await Invoice.find(queryFilter)
      .populate('clientId', 'companyName name email')
      .populate('agencyId', 'companyName name email phone industry logo logoDark invoiceSignature')
      .populate('brandId', 'companyName name email phone industry logo logoDark invoiceSignature')
      .populate({
        path: 'proposalId',
        select: 'proposalNumber name masterItems',
        populate: {
          path: 'masterItems',
          select: 'name price description status categories applicableAccess startDate endDate handlingDuration isCampaign campaignDetails'
        }
      })
      .populate('createdBy', 'name email roleName')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    await syncInvoiceStatus(invoices);

    res.status(200).json({ 
      success: true, 
      count: invoices.length,
      total,
      page,
      pages: Math.ceil(total / limit),
      data: invoices 
    });
  } catch (error) {
    next(error);
  }
};

// Get Single Invoice
exports.getInvoice = async (req, res, next) => {
  try {
    const invoice = await Invoice.findOne({ _id: req.params.id, isDeleted: false })
      .populate('clientId', 'companyName name email address phone')
      .populate('agencyId', 'companyName name email phone industry logo logoDark invoiceSignature')
      .populate('brandId', 'companyName name email phone industry logo logoDark invoiceSignature')
      .populate('adminId', 'companyName name email phone industry logo logoDark invoiceSignature')
      .populate({
        path: 'proposalId',
        select: 'proposalNumber name masterItems',
        populate: {
          path: 'masterItems',
          select: 'name itemCode category categories price duration description applicableAccess startDate endDate handlingDuration isCampaign campaignDetails'
        }
      });
    if (!invoice) {
      return res.status(404).json({ success: false, message: 'Invoice not found' });
    }

    await syncInvoiceStatus(invoice);

    res.status(200).json({ success: true, data: invoice });
  } catch (error) {
    next(error);
  }
};

// Update Payment
exports.updatePayment = async (req, res, next) => {
  try {
    const invoice = await Invoice.findOne({ _id: req.params.id, isDeleted: false });
    if (!invoice) {
      return res.status(404).json({ success: false, message: 'Invoice not found' });
    }

    const { paymentMode, transactionId } = req.body;
    
    // Create a transaction record with status Pending (awaiting verification)
    const transaction = new Transaction({
      invoiceId: invoice._id,
      companyId: invoice.clientId || invoice.brandId,
      amount: invoice.pendingAmount > 0 ? invoice.pendingAmount : invoice.grandTotal,
      paymentDate: new Date(),
      closingInvoiceDate: new Date(),
      paymentMethod: paymentMode || 'Bank Transfer',
      referenceNumber: transactionId || `TXN-${Date.now()}`,
      transactionType: paymentMode === 'Razorpay' ? 'Online' : 'Manual',
      status: 'Pending',
      recordedBy: req.user._id,
      adminId: invoice.adminId,
      agencyId: invoice.agencyId,
      brandId: invoice.brandId
    });

    await transaction.save();

    // Recalculate invoice balance based on verified transactions
    await updateInvoiceBalance(invoice._id);

    const updatedInvoice = await Invoice.findById(invoice._id);

    res.status(200).json({ 
      success: true, 
      data: updatedInvoice, 
      transaction,
      message: 'Payment recorded successfully and submitted for verification' 
    });
  } catch (error) {
    next(error);
  }
};

// Generate PDF
exports.generatePDF = async (req, res, next) => {
  try {
    const Invoice = require('./invoice.model');
    const User = require('../auth/user.model');
    const { generateInvoicePDF } = require('../../utils/pdf.service');

    const invoice = await Invoice.findOne({ _id: req.params.id, isDeleted: false })
      .populate('clientId', 'name email address phone companyName gstin')
      .populate({
        path: 'proposalId',
        populate: { path: 'masterItems' }
      })
      .lean();
    
    if (!invoice) {
      return res.status(404).json({ success: false, message: 'Invoice not found' });
    }

    let tenantCompany = {};
    const compId = invoice.agencyId || invoice.companyId || req.companyId;
    if (compId) {
      tenantCompany = await User.findById(compId).lean() || {};
    }

    // Ensure items array is populated for PDF generator
    if (!invoice.items || invoice.items.length === 0) {
      const prop = invoice.proposalId;
      if (prop && Array.isArray(prop.masterItems) && prop.masterItems.length > 0) {
        invoice.items = prop.masterItems.map(item => ({
          serviceId: { name: typeof item === 'object' ? (item.name || item.title || 'Service Item') : 'Service Item' },
          description: typeof item === 'object' ? (item.description || '') : '',
          quantity: 1,
          rate: typeof item === 'object' ? (item.price || item.cost || (invoice.grandTotal / prop.masterItems.length)) : (invoice.grandTotal / prop.masterItems.length),
          amount: typeof item === 'object' ? (item.price || item.cost || (invoice.grandTotal / prop.masterItems.length)) : (invoice.grandTotal / prop.masterItems.length)
        }));
      } else {
        invoice.items = [{
          serviceId: { name: invoice.invoiceType ? `${invoice.invoiceType} Retainer Invoice` : 'Retainer Service' },
          description: `Invoice ${invoice.invoiceNumber}`,
          quantity: 1,
          rate: invoice.grandTotal || invoice.amount || 0,
          amount: invoice.grandTotal || invoice.amount || 0
        }];
      }
    }

    const pdfBuffer = await generateInvoicePDF(invoice, tenantCompany);

    const filename = `Invoice_${invoice.invoiceNumber || invoice._id}.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', pdfBuffer.length);
    return res.send(pdfBuffer);
  } catch (error) {
    console.error('Error generating PDF:', error);
    next(error);
  }
};

// Delete Invoice
exports.deleteInvoice = async (req, res, next) => {
  try {
    const invoice = await Invoice.findOne({ _id: req.params.id, isDeleted: false });
    if (!invoice) {
      return res.status(404).json({ success: false, message: 'Invoice not found' });
    }
    
    invoice.isDeleted = true;
    invoice.updatedBy = req.user._id;
    await invoice.save();
    
    res.status(200).json({ success: true, message: 'Invoice deleted successfully' });
  } catch (error) {
    next(error);
  }
};

// Send Invoice to Client
exports.sendInvoice = async (req, res, next) => {
  try {
    const { method } = req.body;
    const invoice = await Invoice.findOne({ _id: req.params.id, isDeleted: false });
    
    if (!invoice) {
      return res.status(404).json({ success: false, message: 'Invoice not found' });
    }

    if (method === 'email') {
      console.log(`[Email Integration] Sending invoice ${invoice.invoiceNumber} to client via Email...`);
      // TODO: Connect actual email integration
    } else if (method === 'whatsapp') {
      console.log(`[WhatsApp Integration] Sending invoice ${invoice.invoiceNumber} to client via WhatsApp...`);
      // TODO: Connect actual WhatsApp integration
    } else if (method === 'dashboard') {
      console.log(`[Dashboard Integration] Making invoice ${invoice.invoiceNumber} available on Client Dashboard...`);
      // Simply updating status handles this due to our query filter logic
    } else {
      return res.status(400).json({ success: false, message: 'Invalid delivery method' });
    }

    // Change status from Draft to Sent (or leave as Pending/Paid if already updated)
    if (invoice.invoiceStatus === 'Draft') {
      invoice.invoiceStatus = 'Sent';
      await invoice.save();
    }

    // Populate before returning to frontend so it doesn't break UI
    const populatedInvoice = await Invoice.findOne({ _id: req.params.id, isDeleted: false })
      .populate('clientId', 'companyName name email address phone')
      .populate('agencyId', 'companyName name email phone industry logo logoDark invoiceSignature')
      .populate('brandId', 'companyName name email phone industry logo logoDark invoiceSignature')
      .populate('adminId', 'companyName name email phone industry logo logoDark invoiceSignature')
      .populate({
        path: 'proposalId',
        select: 'proposalNumber name masterItems',
        populate: {
          path: 'masterItems',
          select: 'name itemCode category categories price duration description applicableAccess startDate endDate handlingDuration isCampaign campaignDetails'
        }
      });

    res.status(200).json({ 
      success: true, 
      message: `Invoice successfully sent via ${method}`,
      data: populatedInvoice
    });
  } catch (error) {
    next(error);
  }
};
