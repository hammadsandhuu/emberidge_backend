// controllers/coupon.controller.js
const Coupon = require("../models/coupon.model");
const catchAsync = require("../utils/catchAsync");
const successResponse = require("../utils/successResponse");
const errorResponse = require("../utils/errorResponse");

//  Admin: Create
exports.createCoupon = catchAsync(async (req, res) => {
  const coupon = await Coupon.create(req.body);
  return successResponse(res, { coupon }, "Coupon created successfully");
});

//  Admin: Update
exports.updateCoupon = catchAsync(async (req, res) => {
  const coupon = await Coupon.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
  });
  if (!coupon) return errorResponse(res, "Coupon not found", 404);
  return successResponse(res, { coupon }, "Coupon updated successfully");
});

//  Admin: Delete
exports.deleteCoupon = catchAsync(async (req, res) => {
  const coupon = await Coupon.findByIdAndDelete(req.params.id);
  if (!coupon) return errorResponse(res, "Coupon not found", 404);
  return successResponse(res, {}, "Coupon deleted successfully");
});

//  Public: Get active coupons
exports.getCoupons = catchAsync(async (req, res) => {
  const coupons = await Coupon.find({ isActive: true });
  return successResponse(res, { coupons }, "Coupons fetched successfully");
});

//  Public: Get single coupon
exports.getCoupon = catchAsync(async (req, res) => {
  const coupon = await Coupon.findOne({
    code: req.params.code.toUpperCase(),
    isActive: true,
  });
  if (!coupon) return errorResponse(res, "Coupon not found", 404);
  return successResponse(res, { coupon }, "Coupon fetched successfully");
});

// Redeem (atomic updates)
exports.redeemCoupon = async (couponId, userId) => {
  await Coupon.findByIdAndUpdate(couponId, {
    $inc: {
      usedCount: 1,
      [`userUsage.${userId}`]: 1,
    },
  });
};
