const express = require("express");
const router = express.Router();
const dealController = require("../controllers/deal.controller");
const { protect, restrictTo } = require("../middleware/auth.middleware");
const uploadDeal = require("../utils/uploadDeal");

// -------------------- ADMIN ROUTES --------------------
router.post(
  "/",
  protect,
  restrictTo("admin"),
  uploadDeal.fields([
    { name: "desktop", maxCount: 1 },
    { name: "mobile", maxCount: 1 },
  ]),
  dealController.createDeal
);

// router.put(
//   "/:id",
//   protect,
//   restrictTo("admin"),
//   uploadDeal.fields([
//     { name: "desktop", maxCount: 1 },
//     { name: "mobile", maxCount: 1 },
//   ]),
//   dealController.updateDeal
// );

// router.delete("/:id", protect, restrictTo("admin"), dealController.deleteDeal);

// -------------------- PUBLIC ROUTES --------------------

// Keep this before "/:id" or else it’ll break
// router.get("/top-offers", dealController.getTopOffers);

// List all deals (with pagination/filter)
router.get("/", dealController.getAllDeals);

// Get single deal by ID
router.get("/:id", dealController.getDeal);

module.exports = router;
