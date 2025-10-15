const jwt = require("jsonwebtoken");
const successResponse = require("./successResponse");

exports.signToken = (user) =>
  jwt.sign(
    { id: user._id, role: user.role, name: user.name },
    process.env.JWT_SECRET,
    {
      expiresIn: process.env.JWT_EXPIRES_IN,
    }
  );

exports.createSendToken = (user, statusCode, res, message = "Success") => {
  const token = this.signToken(user);

  const cookieOptions = {
    expires: new Date(
      Date.now() + process.env.JWT_COOKIE_EXPIRES_IN * 24 * 60 * 60 * 1000
    ),
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "Strict",
    path: "/",
  };
  res.cookie("auth_token", token, cookieOptions);
  user.password = undefined;

  return successResponse(res, { token, user }, message, statusCode);
};
