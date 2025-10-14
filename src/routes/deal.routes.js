const express = require("express");
const router = express.Router();
const dealController = require("../controllers/deal.controller");
const { protect, restrictTo } = require("../middleware/auth.middleware");

// Admin routes
router.post("/", protect, restrictTo("admin"), dealController.createDeal);
router.put("/:id", protect, restrictTo("admin"), dealController.updateDeal);
router.delete("/:id", protect, restrictTo("admin"), dealController.deleteDeal);

// Public routes
router.get("/", dealController.getAllDeals);
router.get("/top-offers", dealController.getTopOffers);
router.get("/:id", dealController.getDeal);

module.exports = router;
