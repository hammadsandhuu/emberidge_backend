const AppError = require("../utils/appError");
const logger = require("../utils/logger");
const multer = require("multer");

// Handle specific DB errors
const handleCastErrorDB = (err) =>
  new AppError(`Invalid ${err.path}: ${err.value}`, 400);

const handleDuplicateFieldsDB = (err) => {
  const value = err.keyValue ? JSON.stringify(err.keyValue) : "Duplicate field";
  const message = `Duplicate field value: ${value}. Please use another value!`;
  return new AppError(message, 400);
};

const handleValidationErrorDB = (err) => {
  const errors = Object.values(err.errors).map((el) => el.message);
  return new AppError("Invalid input data", 400, errors);
};

// 🔥 Handle Multer errors
const handleMulterError = (err) => {
  let message = err.message;

  if (err.code === "LIMIT_FILE_SIZE") {
    message = "File too large! Max size is 5MB.";
  } else if (err.code === "LIMIT_UNEXPECTED_FILE") {
    message = "Only JPG, PNG, and WebP images are allowed.";
  }

  return new AppError(message, 400);
};

// Dev response
const sendErrorDev = (err, res) => {
  res.status(err.statusCode).json({
    status: err.status,
    message: err.message,
    error: err,
    stack: err.stack,
    errors: err.errors || [],
  });
};

// Prod response
const sendErrorProd = (err, res) => {
  if (err.isOperational) {
    res.status(err.statusCode).json({
      status: err.status,
      message: err.message,
      errors: err.errors || [],
    });
  } else {
    logger.error(err);
    res.status(500).json({
      status: "error",
      message: "Something went very wrong!",
    });
  }
};

module.exports = (err, req, res, next) => {
  err.statusCode = err.statusCode || 500;
  err.status = err.status || "error";

  let error = err;

  // Multer error handling
  if (err instanceof multer.MulterError) {
    error = handleMulterError(err);
  } else {
    if (err.name === "CastError") error = handleCastErrorDB(err);
    if (err.code === 11000) error = handleDuplicateFieldsDB(err);
    if (err.name === "ValidationError") error = handleValidationErrorDB(err);
  }

  if (process.env.NODE_ENV === "development") {
    sendErrorDev(error, res);
  } else {
    sendErrorProd(error, res);
  }
};
