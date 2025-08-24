const User = require("../models/user.model");
const catchAsync = require("../utils/catchAsync");
const successResponse = require("../utils/successResponse");
const errorResponse = require("../utils/errorResponse");

// Get logged-in user
exports.getMe = catchAsync(async (req, res, next) => {
  const user = await User.findById(req.user.id);
  if (!user) return errorResponse(res, "User not found", 404);

  return successResponse(res, { user }, "User fetched successfully", 200);
});

// Update logged-in user (not email/password)
exports.updateMe = catchAsync(async (req, res, next) => {
  if (req.body.password || req.body.email) {
    return errorResponse(
      res,
      "This route is not for email/password updates",
      400
    );
  }

  const allowedFields = [
    "name",
    "address",
    "dateOfBirth",
    "phoneNumber",
    "gender",
  ];
  const filteredBody = {};

  Object.keys(req.body).forEach((key) => {
    if (allowedFields.includes(key)) filteredBody[key] = req.body[key];
  });

  if (req.file && req.file.path) filteredBody.avatar = req.file.path;

  const updatedUser = await User.findByIdAndUpdate(req.user.id, filteredBody, {
    new: true,
    runValidators: true,
  });

  if (!updatedUser) return errorResponse(res, "User not found", 404);

  return successResponse(
    res,
    { user: updatedUser },
    "User updated successfully",
    200
  );
});

// Admin: Get all users
exports.getAllUsers = catchAsync(async (req, res, next) => {
  const users = await User.find();
  return successResponse(res, { users }, "Users fetched successfully", 200);
});

// Admin: Get single user
exports.getUser = catchAsync(async (req, res, next) => {
  const user = await User.findById(req.params.id);
  if (!user) return errorResponse(res, "No user found with that ID", 404);

  return successResponse(res, { user }, "User fetched successfully", 200);
});

// Admin: Update user
exports.updateUser = catchAsync(async (req, res, next) => {
  const user = await User.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true,
  });
  if (!user) return errorResponse(res, "No user found with that ID", 404);

  return successResponse(res, { user }, "User updated successfully", 200);
});

// Admin: Delete user
exports.deleteUser = catchAsync(async (req, res, next) => {
  const user = await User.findByIdAndDelete(req.params.id);
  if (!user) return errorResponse(res, "No user found with that ID", 404);

  return successResponse(res, null, "User deleted successfully", 204);
});
