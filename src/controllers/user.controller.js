const User = require("../models/user.model");
const catchAsync = require("../utils/catchAsync");
const successResponse = require("../utils/successResponse");
const errorResponse = require("../utils/errorResponse");

// -------------------- USER PROFILE --------------------

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
  const allowedFields = ["name", "dateOfBirth", "phoneNumber", "gender"];
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

// -------------------- ADDRESS BOOK --------------------

// Add new address
exports.addAddress = catchAsync(async (req, res) => {
  const user = await User.findById(req.user.id);
  if (!user) return errorResponse(res, "User not found", 404);

  const newAddress = req.body;
  if (user.addresses.length === 0) {
    newAddress.isDefault = true;
  } else if (newAddress.isDefault) {
    user.addresses.forEach((addr) => {
      addr.isDefault = false;
    });
  }

  // Push new address
  user.addresses.push(newAddress);

  await user.save();

  return successResponse(
    res,
    { addresses: user.addresses },
    "Address added successfully",
    201
  );
});


// Get all addresses
exports.getAddresses = catchAsync(async (req, res) => {
  const user = await User.findById(req.user.id);
  if (!user) return errorResponse(res, "User not found", 404);

  return successResponse(
    res,
    { addresses: user.addresses },
    "Addresses fetched successfully",
    200
  );
});

// Get default address
exports.getDefaultAddress = catchAsync(async (req, res) => {
  const user = await User.findById(req.user.id);
  if (!user) return errorResponse(res, "User not found", 404);

  const address = user.addresses.find((a) => a.isDefault);
  return successResponse(
    res,
    { address: address || null },
    "Default address fetched successfully",
    200
  );
});

// Update address
exports.updateAddress = catchAsync(async (req, res) => {
  const { addressId } = req.params;
  const updates = req.body;

  const user = await User.findById(req.user.id);
  if (!user) return errorResponse(res, "User not found", 404);

  const address = user.addresses.id(addressId);
  if (!address) return errorResponse(res, "Address not found", 404);

  Object.assign(address, updates);
  await user.save();

  return successResponse(
    res,
    { addresses: user.addresses },
    "Address updated successfully",
    200
  );
});

// Delete address
exports.deleteAddress = catchAsync(async (req, res) => {
  const { addressId } = req.params;

  const user = await User.findByIdAndUpdate(
    req.user.id,
    { $pull: { addresses: { _id: addressId } } },
    { new: true }
  );

  if (!user) return errorResponse(res, "User not found", 404);
  if (!user.addresses) return errorResponse(res, "Address not found", 404);

  // if no default remains, set first as default
  if (!user.addresses.some((a) => a.isDefault) && user.addresses.length > 0) {
    user.addresses[0].isDefault = true;
    await user.save();
  }

  return successResponse(
    res,
    { addresses: user.addresses },
    "Address deleted successfully",
    200
  );
});

// Set default address
exports.setDefaultAddress = catchAsync(async (req, res) => {
  const { addressId } = req.params;

  const user = await User.findById(req.user.id);
  if (!user) return errorResponse(res, "User not found", 404);

  let found = false;
  user.addresses.forEach((a) => {
    if (a._id.toString() === addressId) {
      a.isDefault = true;
      found = true;
    } else {
      a.isDefault = false;
    }
  });

  if (!found) return errorResponse(res, "Address not found", 404);

  await user.save();

  return successResponse(
    res,
    { addresses: user.addresses },
    "Default address set successfully",
    200
  );
});

// -------------------- ADMIN ONLY --------------------

// Get all users
exports.getAllUsers = catchAsync(async (req, res) => {
  const users = await User.find();
  return successResponse(res, { users }, "Users fetched successfully", 200);
});

// Get single user
exports.getUser = catchAsync(async (req, res) => {
  const user = await User.findById(req.params.id);
  if (!user) return errorResponse(res, "No user found with that ID", 404);

  return successResponse(res, { user }, "User fetched successfully", 200);
});

// Update user
exports.updateUser = catchAsync(async (req, res) => {
  const user = await User.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true,
  });
  if (!user) return errorResponse(res, "No user found with that ID", 404);

  return successResponse(res, { user }, "User updated successfully", 200);
});

// Delete user
exports.deleteUser = catchAsync(async (req, res) => {
  const user = await User.findByIdAndDelete(req.params.id);
  if (!user) return errorResponse(res, "No user found with that ID", 404);

  return successResponse(res, null, "User deleted successfully", 204);
});
