const express = require("express");
const salesPipelineController = require("./salesPipeline.controller");
const authMiddleware = require("../../middlewares/authMiddleware");

const router = express.Router();

// Apply auth middleware to all pipeline endpoints
router.use(authMiddleware);

router.get("/analytics", salesPipelineController.getPipelineAnalytics);
router.get("/reps", salesPipelineController.getSalesReps);
router.get("/", salesPipelineController.getAllDeals);
router.post("/", salesPipelineController.createDeal);
router.get("/:id", salesPipelineController.getDealById);
router.put("/:id", salesPipelineController.updateDeal);
router.delete("/:id", salesPipelineController.deleteDeal);
router.post("/:id/notes", salesPipelineController.addDealNote);
router.post("/:id/convert", salesPipelineController.convertDealToClient);

module.exports = router;
