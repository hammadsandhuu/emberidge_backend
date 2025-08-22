const express = require("express");
const router = express.Router();
const categoryController = require("../controllers/category.controller");
const { protect, restrictTo } = require("../middleware/auth.middleware");
const uploadCategory = require("../utils/uploadCategory");

// Public routes
router.get("", categoryController.getAllCategories);
router.get("/:slug", categoryController.getCategory);

// Admin-only routes
router.use(protect, restrictTo("admin"));
router.post(
  "",
  uploadCategory.single("image"),
  categoryController.createCategory
);
router.patch(
  "/:id",
  uploadCategory.single("image"),
  categoryController.updateCategory
);
router.delete("/:id", categoryController.deleteCategory);

// Child category management (admin only)
router.post(
  "/:id/children",
  uploadCategory.single("image"),
  categoryController.addChildCategory
);
router.patch(
  "/:id/children/:childId",
  uploadCategory.single("image"),
  categoryController.updateChildCategory
);
router.delete("/:id/children/:childId", categoryController.deleteChildCategory);


module.exports = router;
