const express = require("express");
const userController = require("../controllers/user.controller");
const uploadAvatar = require("../utils/uploadAvatar");
const { protect, restrictTo } = require("../middleware/auth.middleware");

const router = express.Router();

router.get("/me", protect, userController.getMe);

router.patch(
  "/me",
  protect,
  uploadAvatar.single("avatar"),
  userController.updateMe
);

router.use(protect, restrictTo("admin"));

router.get("/", userController.getAllUsers);

router
  .route("/:id")
  .get(userController.getUser)
  .patch(userController.updateUser)
  .delete(userController.deleteUser);

module.exports = router;
