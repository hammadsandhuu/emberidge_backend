module.exports = (res, message = "Error", statusCode = 500, errors = []) => {
  return res.status(statusCode).json({
    status: "error",
    message,
    errors,
  });
};
