const express = require("express");
const router = express.Router();
const couponController = require("../controllers/coupon.controller");
const { protect, restrictTo } = require("../middleware/auth.middleware");

// ---------- Admin Routes ----------
router.post("/", protect, restrictTo("admin"), couponController.createCoupon);
router.put("/:id", protect, restrictTo("admin"), couponController.updateCoupon);
router.delete(
  "/:id",
  protect,
  restrictTo("admin"),
  couponController.deleteCoupon
);

// ---------- Public Routes ----------
router.get("/", couponController.getCoupons);
router.get("/:code", couponController.getCoupon);
router.post("/validate", protect, couponController.validateCoupon); // Checkout validation

module.exports = router;
