const express = require('express');
const router = express.Router();
const brandController = require('./brand.controller');
const authMiddleware = require('../../middlewares/authMiddleware');

// All brand routes should be protected
router.use(authMiddleware);

router.route('/dropdown')
  .get(brandController.getBrandsDropdown);

router.route('/')
  .get(brandController.getBrands)
  .post(brandController.createBrand);

router.route('/profile')
  .put(brandController.updateBrandProfile);

router.route('/:id')
  .put(brandController.updateBrand) // New endpoint for editing details
  .delete(brandController.deleteBrand);

router.route('/:id/status')
  .put(brandController.updateBrandStatus);

router.route('/:id/assign-users')
  .post(brandController.assignUsersToBrand);

module.exports = router;
