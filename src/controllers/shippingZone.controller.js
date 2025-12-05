const ShippingZone = require("../models/shippingZone.model");
const catchAsync = require("../utils/catchAsync");
const successResponse = require("../utils/successResponse");
const errorResponse = require("../utils/errorResponse");

// 🧱 Admin: Create
exports.createZone = catchAsync(async (req, res) => {
  const zone = await ShippingZone.create(req.body);
  return successResponse(res, { zone }, "Shipping zone created successfully");
});

// ✏️ Admin: Update
exports.updateZone = catchAsync(async (req, res) => {
  const zone = await ShippingZone.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
  });
  if (!zone) return errorResponse(res, "Zone not found", 404);
  return successResponse(res, { zone }, "Shipping zone updated successfully");
});

// ❌ Admin: Delete
exports.deleteZone = catchAsync(async (req, res) => {
  const zone = await ShippingZone.findByIdAndDelete(req.params.id);
  if (!zone) return errorResponse(res, "Zone not found", 404);
  return successResponse(res, {}, "Shipping zone deleted successfully");
});

// 🌍 Get all active zones
exports.getZones = catchAsync(async (req, res) => {
  const zones = await ShippingZone.find({ isActive: true });
  return successResponse(res, { zones }, "Shipping zones fetched successfully");
});

// 🔍 Get single zone by region code or pincode prefix
exports.getZoneByRegion = catchAsync(async (req, res) => {
  const { regionCode, pincode } = req.query;

  let zone = null;
  if (regionCode) zone = await ShippingZone.findOne({ regionCode });
  else if (pincode)
    zone = await ShippingZone.findOne({
      pinCodePrefix: { $regex: `^${pincode.substring(0, 2)}` },
    });

  if (!zone) return errorResponse(res, "Zone not found", 404);
  return successResponse(res, { zone }, "Shipping zone fetched successfully");
});
