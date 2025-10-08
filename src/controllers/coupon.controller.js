const Coupon = require("../models/coupon.model");
const catchAsync = require("../utils/catchAsync");
const successResponse = require("../utils/successResponse");
const errorResponse = require("../utils/errorResponse");

/**
 * ------------------------------
 * Admin Routes
 * ------------------------------
 */

// Create a new coupon
exports.createCoupon = catchAsync(async (req, res) => {
  const coupon = await Coupon.create(req.body);
  return successResponse(res, { coupon }, "Coupon created successfully");
});

// Update an existing coupon
exports.updateCoupon = catchAsync(async (req, res) => {
  const { id } = req.params;
  const coupon = await Coupon.findByIdAndUpdate(id, req.body, { new: true });
  if (!coupon) return errorResponse(res, "Coupon not found", 404);
  return successResponse(res, { coupon }, "Coupon updated successfully");
});

// Delete coupon
exports.deleteCoupon = catchAsync(async (req, res) => {
  const { id } = req.params;
  const coupon = await Coupon.findByIdAndDelete(id);
  if (!coupon) return errorResponse(res, "Coupon not found", 404);
  return successResponse(res, {}, "Coupon deleted successfully");
});

/**
 * ------------------------------
 * Public / User Routes
 * ------------------------------
 */

// Get all active coupons
exports.getCoupons = catchAsync(async (req, res) => {
  const coupons = await Coupon.find({ isActive: true });
  return successResponse(res, { coupons }, "Coupons fetched successfully");
});

// Get single coupon by code
exports.getCoupon = catchAsync(async (req, res) => {
  const { code } = req.params;
  const coupon = await Coupon.findOne({
    code: code.toUpperCase(),
    isActive: true,
  });
  if (!coupon) return errorResponse(res, "Coupon not found", 404);
  return successResponse(res, { coupon }, "Coupon fetched successfully");
});

// Validate coupon during checkout
exports.validateCoupon = catchAsync(async (req, res) => {
  const { code, totalAmount } = req.body;
  const userId = req.user?._id;

  if (!code) return errorResponse(res, "Coupon code is required", 400);
  if (!totalAmount) return errorResponse(res, "Total amount is required", 400);

  const coupon = await Coupon.findOne({
    code: code.toUpperCase(),
    isActive: true,
  });
  if (!coupon) return errorResponse(res, "Invalid coupon", 400);

  // Check expiry
  if (coupon.isExpired) return errorResponse(res, "Coupon expired", 400);

  // Check global usage
  if (coupon.usageLimit && coupon.usedCount >= coupon.usageLimit)
    return errorResponse(res, "Coupon usage limit reached", 400);

  // Check per user usage
  const userUsage = coupon.userUsage.get(userId?.toString()) || 0;
  if (userUsage >= coupon.perUserLimit)
    return errorResponse(res, "You have already used this coupon", 400);

  // Check minimum cart value
  if (coupon.minCartValue && totalAmount < coupon.minCartValue)
    return errorResponse(
      res,
      `Minimum cart value is ${coupon.minCartValue}`,
      400
    );

  // Calculate discount
  let discount = 0;
  if (coupon.discountType === "percentage") {
    discount = (totalAmount * coupon.discountValue) / 100;
    if (coupon.maxDiscount) discount = Math.min(discount, coupon.maxDiscount);
  } else if (coupon.discountType === "fixed") {
    discount = coupon.discountValue;
  }

  const finalTotal = Math.max(totalAmount - discount, 0);

  return successResponse(
    res,
    { coupon, discount, finalTotal },
    "Coupon validated successfully"
  );
});

/**
 * ------------------------------
 * Internal helper (for orders)
 * ------------------------------
 */

// Redeem coupon after successful order
exports.redeemCoupon = async (couponId, userId) => {
  if (!couponId || !userId) return;

  const coupon = await Coupon.findById(couponId);
  if (!coupon) return;

  // Increment global usage
  coupon.usedCount = (coupon.usedCount || 0) + 1;

  // Increment per-user usage
  const userUsage = coupon.userUsage.get(userId.toString()) || 0;
  coupon.userUsage.set(userId.toString(), userUsage + 1);

  await coupon.save();
};
