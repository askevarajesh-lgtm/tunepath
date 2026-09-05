const express = require('express');
const router = express.Router();
const ecommerceController = require('./ecommerce.controller');
const authMiddleware = require('../../middlewares/authMiddleware');
const mongoose = require('mongoose');
const Website = require('../websites/website.model');

router.use(authMiddleware);

// Catalog endpoints (global) - Must be defined BEFORE /:websiteId routes
router.get('/catalog', ecommerceController.getCatalogTemplates);
router.post('/:websiteId/catalog/import', ecommerceController.importCatalogTemplate);
router.get('/catalog/:templateId', ecommerceController.getCatalogTemplate);

// Middleware to verify website ownership — prevents cross-workspace data access
const verifyWebsiteOwnership = async (req, res, next) => {
  try {
    if (!req.params.websiteId) return next();

    if (!req.user && !req.workspaceId) {
      return res.status(401).json({ success: false, message: 'Unauthorized: Missing authentication context' });
    }

    const website = await Website.findOne({ _id: req.params.websiteId, isDeleted: false });

    if (!website) {
      return res.status(403).json({ success: false, message: 'Forbidden: Website not found' });
    }

    const isAdmin = req.user && ['commander_admin', 'super_admin'].includes(req.user.role);
    const ownsWebsite = (
      (req.workspaceId && website.workspaceId && req.workspaceId.toString() === website.workspaceId.toString()) ||
      (req.companyId && website.workspaceId && req.companyId.toString() === website.workspaceId.toString()) ||
      (req.companyId && website.agencyId && req.companyId.toString() === website.agencyId.toString())
    );

    if (!isAdmin && !ownsWebsite) {
      return res.status(403).json({ success: false, message: 'Forbidden: Website does not belong to your workspace' });
    }

    // Override the req.workspaceId with the actual website's workspaceId
    // This ensures downstream controllers (which use getIsolatedQuery) correctly scope data
    // even if the JWT had a missing or mismatched workspaceId (e.g. for commander_admins).
    req.workspaceId = website.workspaceId;

    next();
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Server error verifying website ownership' });
  }
};

router.use('/:websiteId', verifyWebsiteOwnership);

// Templates are scoped by websiteId (they represent the stores)
router.get('/:websiteId/stores', ecommerceController.getStores);
router.post('/:websiteId/stores', ecommerceController.createStore);
router.put('/:websiteId/stores/:storeId', ecommerceController.updateStore);
router.delete('/:websiteId/stores/:storeId', ecommerceController.deleteStore);

// Legacy fallback for frontend that might still call /templates
router.get('/:websiteId/templates', ecommerceController.getStores);
router.post('/:websiteId/templates', ecommerceController.createStore);
router.put('/:websiteId/templates/:templateId', ecommerceController.updateStore);
router.delete('/:websiteId/templates/:templateId', ecommerceController.deleteStore);

// All other routes are scoped: /ecommerce/:websiteId/:storeId/...
router.get('/:websiteId/:storeId/products', ecommerceController.getProducts);
router.post('/:websiteId/:storeId/products', ecommerceController.createProduct);
router.put('/:websiteId/:storeId/products/:productId', ecommerceController.updateProduct);
router.delete('/:websiteId/:storeId/products/:productId', ecommerceController.deleteProduct);

router.get('/:websiteId/:storeId/settings', ecommerceController.getSettings);
router.put('/:websiteId/:storeId/settings', ecommerceController.updateSettings);

router.get('/:websiteId/:storeId/orders', ecommerceController.getOrders);
router.patch('/:websiteId/:storeId/orders/:orderId/status', ecommerceController.updateOrderStatus);

router.get('/:websiteId/:storeId/customers', ecommerceController.getCustomers);
router.get('/:websiteId/:storeId/payments', ecommerceController.getPayments);

router.get('/:websiteId/:storeId/shipping', ecommerceController.getShipping);
router.patch('/:websiteId/:storeId/shipping/:shippingId/status', ecommerceController.updateShippingStatus);

router.post('/:websiteId/:storeId/checkout', ecommerceController.checkout);

module.exports = router;
