const jwt = require("jsonwebtoken");
const successResponse = require("./successResponse");

exports.signToken = (id) =>
  jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN,
  });

exports.createSendToken = (user, statusCode, res, message = "Success") => {
  const token = this.signToken(user._id);

  const cookieOptions = {
    expires: new Date(
      Date.now() + process.env.JWT_COOKIE_EXPIRES_IN * 24 * 60 * 60 * 1000
    ),
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
  };

  res.cookie("jwt", token, cookieOptions);

  // remove password before sending user data
  user.password = undefined;

  return successResponse(res, { token, user }, message, statusCode);
};
