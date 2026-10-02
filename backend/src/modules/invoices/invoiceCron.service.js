const cron = require('node-cron');
const Invoice = require('./invoice.model');
const Proposal = require('../proposals/proposal.model');
const { getNextGenerationDate } = require('./invoiceDateHelper');

const startInvoiceCron = () => {
  // Run daily at midnight (0 0 * * *)
  cron.schedule('0 0 * * *', async () => {
    try {
      console.log('Running daily Retainer Invoice Generation job...');
      const now = new Date();
      
      // Find invoices that are Retainer, haven't been cancelled, and their nextGenerationDate is due
      const dueInvoices = await Invoice.find({
        invoiceType: 'Retainer',
        invoiceStatus: { $ne: 'Cancelled' },
        nextGenerationDate: { $lte: now }
      }).populate('proposalId');
      
      for (const invoice of dueInvoices) {
        let newProposalId = invoice.proposalId?._id || invoice.proposalId;

        // If the invoice is linked to a proposal, clone it for the new month
        if (invoice.proposalId && typeof invoice.proposalId === 'object') {
          const monthName = now.toLocaleString('default', { month: 'long' });
          // Remove any existing month brackets at the end and append the new month
          const baseName = invoice.proposalId.name.replace(/\s*\([^)]*\)$/, '').trim();
          const newProposalName = `${baseName} (${monthName})`;
          
          const newProposalData = {
            name: newProposalName,
            clientId: invoice.proposalId.clientId,
            masterItems: invoice.proposalId.masterItems,
            subtotal: invoice.proposalId.subtotal,
            tax: invoice.proposalId.tax,
            discount: invoice.proposalId.discount,
            grandTotal: invoice.proposalId.grandTotal,
            status: 'Draft',
            createdBy: invoice.createdBy,
            adminId: invoice.proposalId.adminId,
            agencyId: invoice.proposalId.agencyId,
            brandId: invoice.proposalId.brandId
          };
          
          const createdProposal = await Proposal.create(newProposalData);
          newProposalId = createdProposal._id;
        }

        // Clone invoice details
        const count = await Invoice.countDocuments();
        const newInvoiceData = {
          invoiceNumber: `INV-${Date.now()}-${count + 1}`,
          proposalId: newProposalId,
          clientId: invoice.clientId,
          amount: invoice.amount,
          tax: invoice.tax,
          discount: invoice.discount,
          grandTotal: invoice.grandTotal,
          paymentStatus: 'Pending',
          invoiceStatus: 'Draft',
          invoiceType: 'Retainer',
          dueDate: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000), // Default due date 7 days from now
          invoiceDate: now,
          adminId: invoice.adminId,
          agencyId: invoice.agencyId,
          brandId: invoice.brandId,
          createdBy: invoice.createdBy,
          retainerDuration: invoice.retainerDuration,
          parentInvoiceId: invoice._id
        };
        
        // Calculate new nextGenerationDate for the NEW invoice
        const nextDate = getNextGenerationDate(now, invoice.retainerDuration);
        newInvoiceData.nextGenerationDate = nextDate;
        
        // Create the new invoice
        await Invoice.create(newInvoiceData);
        if (newProposalId) {
          await Proposal.findByIdAndUpdate(newProposalId, { status: 'Invoice Created' });
        }
        
        // Update the old invoice so it's no longer the active retainer head
        invoice.nextGenerationDate = null;
        await invoice.save();
      }
      
      console.log(`Successfully generated ${dueInvoices.length} recurring invoices.`);
    } catch (error) {
      console.error('Error running invoice cron job:', error);
    }
  });
};

module.exports = { startInvoiceCron };
