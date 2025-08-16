const express = require("express");
const userController = require("../controllers/user.controller");
const { protect, restrictTo } = require("../middleware/auth.middleware");

const router = express.Router();

// 🔹 Logged-in user routes
router.get("/me", protect, userController.getMe);
router.patch("/me", protect, userController.updateMe);

// 🔹 Admin routes
router.use(protect, restrictTo("admin"));
router.get("/",userController.getAllUsers)

router
  .route("/:id")
  .get(protect, restrictTo("admin"), userController.getUser)
  .patch(protect, restrictTo("admin"), userController.updateUser)
  .delete(protect, restrictTo("admin"), userController.deleteUser);

module.exports = router;
