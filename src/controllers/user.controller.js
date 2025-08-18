const User = require("../models/user.model");
const catchAsync = require("../utils/catchAsync");
const AppError = require("../utils/appError");

// Get logged-in user
exports.getMe = catchAsync(async (req, res, next) => {
  const user = await User.findById(req.user.id);
  if (!user) return next(new AppError("User not found", 404));
  res.status(200).json({ status: "success", data: { user } });
});

// Update logged-in user (not email/password)
exports.updateMe = catchAsync(async (req, res, next) => {
  if (req.body.password || req.body.email) {
    return next(
      new AppError("This route is not for email/password updates", 400)
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

  Object.keys(req.body).forEach((el) => {
    if (allowedFields.includes(el)) filteredBody[el] = req.body[el];
  });

  // ✅ avatar update
  if (req.file && req.file.path) {
    filteredBody.avatar = req.file.path;
  }

  const updatedUser = await User.findByIdAndUpdate(req.user.id, filteredBody, {
    new: true,
    runValidators: true,
  });

  res.status(200).json({
    status: "success",
    data: { user: updatedUser },
  });
});



/* ===========================
   🔹 ADMIN CONTROLLERS
   =========================== */

// Get all users (ADMIN ONLY)
exports.getAllUsers = catchAsync(async (req, res, next) => {
  const users = await User.find();
  res.status(200).json({
    status: "success",
    results: users.length,
    data: { users },
  });
});

// Get one user by ID (ADMIN ONLY)
exports.getUser = catchAsync(async (req, res, next) => {
  const user = await User.findById(req.params.id);
  if (!user) return next(new AppError("No user found with that ID", 404));
  res.status(200).json({ status: "success", data: { user } });
});

// Update a user (ADMIN ONLY)
exports.updateUser = catchAsync(async (req, res, next) => {
  const user = await User.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true,
  });
  if (!user) return next(new AppError("No user found with that ID", 404));
  res.status(200).json({ status: "success", data: { user } });
});

// Delete a user (ADMIN ONLY)
exports.deleteUser = catchAsync(async (req, res, next) => {
  const user = await User.findByIdAndDelete(req.params.id);
  if (!user) return next(new AppError("No user found with that ID", 404));
  res.status(204).json({ status: "success", data: null });
});
