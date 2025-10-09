const SiteSetting = require("../models/siteSetting.model");
const catchAsync = require("../utils/catchAsync");
const successResponse = require("../utils/successResponse");
const errorResponse = require("../utils/errorResponse");

// 🔹 Get all settings
exports.getSettings = catchAsync(async (req, res) => {
  const settings = await SiteSetting.find({});
  return successResponse(res, { settings }, "Settings fetched successfully");
});

// 🔹 Get single setting
exports.getSetting = catchAsync(async (req, res) => {
  const { key } = req.params;
  const setting = await SiteSetting.findOne({ key });
  if (!setting) return errorResponse(res, "Setting not found", 404);
  return successResponse(res, { setting }, "Setting fetched successfully");
});

// 🔹 Create or update a setting
exports.upsertSetting = catchAsync(async (req, res) => {
  const { key, value, description } = req.body;
  if (!key) return errorResponse(res, "Key is required", 400);

  const setting = await SiteSetting.findOneAndUpdate(
    { key },
    { value, description },
    { new: true, upsert: true }
  );

  return successResponse(res, { setting }, "Setting saved successfully");
});
