const Transaction = require('./transaction.model');
const Invoice = require('../invoices/invoice.model');

// Helper to update invoice balance
const updateInvoiceBalance = async (invoiceId) => {
  if (!invoiceId) return;

  // Aggregate sum of successful or verified transactions
  const result = await Transaction.aggregate([
    {
      $match: {
        invoiceId: invoiceId,
        status: { $in: ['Verified', 'Successful'] }
      }
    },
    {
      $group: {
        _id: '$invoiceId',
        totalAmount: { $sum: '$amount' }
      }
    }
  ]);

  const totalPaid = result.length > 0 ? result[0].totalAmount : 0;
  
  const invoice = await Invoice.findById(invoiceId);
  if (invoice) {
    invoice.totalPaid = totalPaid;
    invoice.pendingAmount = Math.max(0, invoice.grandTotal - totalPaid);
    
    if (invoice.pendingAmount <= 0 && invoice.grandTotal > 0) {
      invoice.paymentStatus = 'Paid';
      invoice.invoiceStatus = 'Paid';
    } else if (invoice.totalPaid > 0) {
      invoice.paymentStatus = 'Partially Paid';
      if (invoice.invoiceStatus === 'Paid') {
        invoice.invoiceStatus = 'Sent';
      }
    } else {
      invoice.paymentStatus = 'Pending';
      if (invoice.invoiceStatus === 'Paid') {
        invoice.invoiceStatus = 'Sent';
      }
    }
    
    await invoice.save();
  }
};

exports.updateInvoiceBalance = updateInvoiceBalance;

exports.createManualTransaction = async (req, res) => {
  try {
    const {
      invoiceId,
      companyId,
      amount,
      paymentDate,
      closingInvoiceDate,
      paymentMethod,
      referenceNumber
    } = req.body;

    const screenshotUrl = req.file ? req.file.path : null;

    const invoice = await Invoice.findById(invoiceId);
    if (!invoice) {
      return res.status(404).json({ success: false, message: 'Invoice not found' });
    }

    const transaction = new Transaction({
      invoiceId,
      companyId,
      amount: Number(amount),
      paymentDate,
      closingInvoiceDate,
      paymentMethod,
      referenceNumber,
      screenshotUrl,
      transactionType: 'Manual',
      status: 'Pending', // Requires verification
      recordedBy: req.user._id,
      adminId: invoice.adminId,
      agencyId: invoice.agencyId,
      brandId: invoice.brandId
    });

    await transaction.save();

    res.status(201).json({
      success: true,
      message: 'Manual transaction recorded successfully',
      data: transaction
    });
  } catch (error) {
    console.error('Error creating manual transaction:', error);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

exports.getTransactions = async (req, res) => {
  try {
    const { invoiceId, status, paymentMethod } = req.query;
    let query = {};
    
    // If a specific client is selected via the agency switcher, filter by their company ID
    if (req.selectedClientId) {
      query.companyId = req.selectedClientId;
    } else if (req.user.role !== 'commander_admin') {
      // RBAC filtering for non-impersonated requests
      if (req.user.role.includes('brand')) query.brandId = req.user.brandId || req.user._id;
      else if (req.user.role.includes('agency')) query.agencyId = req.user.agencyId || req.user._id;
      else if (req.user.role.includes('admin')) query.adminId = req.user.adminId || req.user._id;
    }

    if (invoiceId) query.invoiceId = invoiceId;
    if (status) query.status = status;
    if (paymentMethod) query.paymentMethod = paymentMethod;

    // Backfill legacy paid invoices missing Transaction records
    try {
      let invQuery = { isDeleted: false, $or: [{ paymentStatus: 'Paid' }, { invoiceStatus: 'Paid' }] };
      if (query.agencyId) invQuery.agencyId = query.agencyId;
      if (query.brandId) invQuery.clientId = query.brandId;
      if (query.adminId) invQuery.adminId = query.adminId;

      const legacyPaidInvoices = await Invoice.find(invQuery);
      for (const inv of legacyPaidInvoices) {
        const existing = await Transaction.findOne({ invoiceId: inv._id });
        if (!existing) {
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
        }
      }
    } catch (e) {
      console.error('Error during getTransactions backfill:', e);
    }

    const transactions = await Transaction.find(query)
      .populate('invoiceId', 'invoiceNumber grandTotal totalPaid pendingAmount')
      .populate('marketplacePurchaseId', 'moduleName')
      .populate('companyId', 'name email companyName')
      .populate('recordedBy', 'name email')
      .populate('verifiedBy', 'name email')
      .sort({ paymentDate: -1 });

    res.status(200).json({
      success: true,
      data: transactions
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

exports.verifyTransaction = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body; // 'Verified' or 'Rejected'

    if (!['Verified', 'Rejected'].includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid status' });
    }

    const transaction = await Transaction.findById(id);
    if (!transaction) {
      return res.status(404).json({ success: false, message: 'Transaction not found' });
    }

    transaction.status = status;
    transaction.verifiedBy = req.user._id;
    await transaction.save();

    // Update invoice balance if verified
    if (status === 'Verified') {
      await updateInvoiceBalance(transaction.invoiceId);
    }

    res.status(200).json({
      success: true,
      message: `Transaction ${status.toLowerCase()} successfully`,
      data: transaction
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

exports.razorpayWebhook = async (req, res) => {
  try {
    // Basic verification placeholder. Ideally verify webhook signature here
    const { event, payload } = req.body;
    
    if (event === 'payment.captured' || event === 'payment.authorized') {
      const payment = payload.payment.entity;
      
      // Look up invoice via payment notes or custom logic (assuming invoiceId is passed in notes)
      const invoiceId = payment.notes ? payment.notes.invoiceId : null;
      if (!invoiceId) {
         return res.status(200).send('No invoiceId found in notes');
      }

      const invoice = await Invoice.findById(invoiceId);
      if (!invoice) {
        return res.status(200).send('Invoice not found');
      }

      // Check if transaction already exists
      let transaction = await Transaction.findOne({ razorpayPaymentId: payment.id });
      
      if (!transaction) {
        transaction = new Transaction({
          invoiceId: invoice._id,
          companyId: invoice.clientId, // Assuming clientId is the user who made payment
          amount: payment.amount / 100, // Razorpay amount is in paise
          paymentDate: new Date(payment.created_at * 1000),
          paymentMethod: 'Razorpay',
          status: 'Pending', // Force pending so it requires manual verification
          transactionType: 'Online',
          razorpayPaymentId: payment.id,
          razorpayOrderId: payment.order_id,
          adminId: invoice.adminId,
          agencyId: invoice.agencyId,
          brandId: invoice.brandId
        });
        await transaction.save();
      }
      
      // We no longer update the invoice balance automatically here
      // Admin needs to verify it manually from the UI to update balance
    }
    
    res.status(200).send('OK');
  } catch (error) {
    console.error('Webhook error:', error);
    res.status(500).send('Webhook Error');
  }
};
