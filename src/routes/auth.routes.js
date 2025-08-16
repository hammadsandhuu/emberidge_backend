const express = require("express");
const authController = require("../controllers/auth.controller");
const { protect } = require("../middleware/auth.middleware");

const router = express.Router();

router.post("/signup", authController.signup);
router.post("/login", authController.login);
router.get("/logout", authController.logout);

router.post("/forgot-password", authController.forgotPassword);
router.patch("/update-password", protect, authController.updatePassword);
router.patch("/reset-password/:token", authController.resetPassword);

module.exports = router;
