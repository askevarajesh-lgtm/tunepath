const express = require('express');
const router = express.Router();
const proposalController = require('./proposal.controller');
const authMiddleware = require('../../middlewares/authMiddleware');

router.use(authMiddleware);

router.route('/')
  .post(proposalController.createProposal)
  .get(proposalController.getProposals);

router.route('/:id')
  .get(proposalController.getProposal)
  .put(proposalController.updateProposal)
  .delete(proposalController.deleteProposal);

router.post('/:id/approve', proposalController.approveProposal);
router.post('/:id/generate-invoice', proposalController.generateInvoice);
router.post('/:id/approve-and-generate-invoice', proposalController.approveAndGenerateInvoice);
router.get('/:id/pdf', proposalController.generatePDF);

module.exports = router;
