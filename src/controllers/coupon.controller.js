const Coupon = require("../models/coupon.model");
const catchAsync = require("../utils/catchAsync");
const successResponse = require("../utils/successResponse");
const errorResponse = require("../utils/errorResponse");

// Admin: Create coupon
exports.createCoupon = catchAsync(async (req, res, next) => {
  const coupon = await Coupon.create(req.body);
  return successResponse(res, { coupon }, "Coupon created successfully");
});

// Admin: Update coupon
exports.updateCoupon = catchAsync(async (req, res, next) => {
  const { id } = req.params;
  const coupon = await Coupon.findByIdAndUpdate(id, req.body, { new: true });
  if (!coupon) return errorResponse(res, "Coupon not found", 404);
  return successResponse(res, { coupon }, "Coupon updated successfully");
});

// Admin: Delete coupon
exports.deleteCoupon = catchAsync(async (req, res, next) => {
  const { id } = req.params;
  const coupon = await Coupon.findByIdAndDelete(id);
  if (!coupon) return errorResponse(res, "Coupon not found", 404);
  return successResponse(res, {}, "Coupon deleted successfully");
});

// Public: Get all active coupons
exports.getCoupons = catchAsync(async (req, res, next) => {
  const coupons = await Coupon.find({ isActive: true });
  return successResponse(res, { coupons }, "Coupons fetched successfully");
});

// Public: Get single coupon by code
exports.getCoupon = catchAsync(async (req, res, next) => {
  const { code } = req.params;
  const coupon = await Coupon.findOne({
    code: code.toUpperCase(),
    isActive: true,
  });
  if (!coupon) return errorResponse(res, "Coupon not found", 404);
  return successResponse(res, { coupon }, "Coupon fetched successfully");
});

// Redeem coupon after checkout
exports.redeemCoupon = async (couponId, userId) => {
  const coupon = await Coupon.findById(couponId);
  if (!coupon) return;

  coupon.usedCount = (coupon.usedCount || 0) + 1;
  const currentUsage = coupon.userUsage.get(userId.toString()) || 0;
  coupon.userUsage.set(userId.toString(), currentUsage + 1);

  await coupon.save();
};
