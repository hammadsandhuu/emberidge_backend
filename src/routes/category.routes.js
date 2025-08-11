const express = require("express");
const router = express.Router();
const categoryController = require("../controllers/category.controller");
const upload = require("../utils/multer");
const { protect, restrictTo } = require("../middleware/authMiddleware");

// Public routes
router.get("", categoryController.getAllCategories);
router.get("/:slug", categoryController.getCategory);

// Admin-only routes
router.use(protect, restrictTo("admin"));
router.post("", upload.single("image"), categoryController.createCategory);
router.patch("/:id", upload.single("image"), categoryController.updateCategory);
router.delete("/:id", categoryController.deleteCategory);

// Child category management (admin only)
router.post(
  "/:id/children",
  upload.single("image"),
  categoryController.addChildCategory
);
router.patch(
  "/:id/children/:childId",
  upload.single("image"),
  categoryController.updateChildCategory
);
router.delete("/:id/children/:childId", categoryController.deleteChildCategory);


module.exports = router;
