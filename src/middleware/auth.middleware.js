const jwt = require("jsonwebtoken");
const { promisify } = require("util");
const User = require("../models/user.model");
const catchAsync = require("../utils/catchAsync");
const AppError = require("../utils/appError");

// Protect routes (only logged in users)
exports.protect = catchAsync(async (req, res, next) => {
  let token;
  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith("Bearer")
  ) {
    token = req.headers.authorization.split(" ")[1];
  } else if (req.cookies.jwt) {
    token = req.cookies.jwt;
  }

  if (!token) return next(new AppError("You are not logged in!", 401));

  const decoded = await promisify(jwt.verify)(token, process.env.JWT_SECRET);

  const currentUser = await User.findById(decoded.id);
  if (!currentUser) return next(new AppError("User no longer exists.", 401));

  if (currentUser.changedPasswordAfter(decoded.iat)) {
    return next(
      new AppError("Password recently changed. Please log in again.", 401)
    );
  }

  req.user = currentUser;
  res.locals.user = currentUser;
  next();
});

// Restrict to roles
exports.restrictTo = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return next(new AppError("You do not have permission.", 403));
    }
    next();
  };
};

// For rendered pages (optional)
exports.isLoggedIn = async (req, res, next) => {
  if (req.cookies.jwt) {
    try {
      const decoded = await promisify(jwt.verify)(
        req.cookies.jwt,
        process.env.JWT_SECRET
      );
      const currentUser = await User.findById(decoded.id);
      if (!currentUser || currentUser.changedPasswordAfter(decoded.iat))
        return next();
      res.locals.user = currentUser;
      return next();
    } catch (err) {
      return next();
    }
  }
  next();
};
