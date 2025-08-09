const express = require("express");
const router = express.Router();
const categoryController = require("../controllers/category.controller");
const upload = require("../utils/multer");
const { protect, restrictTo } = require("../middleware/authMiddleware");

// Public routes
router.get("/categories", categoryController.getAllCategories);
router.get("/categories/:slug", categoryController.getCategory);

// Admin-only routes
router.use(protect, restrictTo("admin"));
router.post("/categories", upload.single("image"), categoryController.createCategory);
router.patch("/categories/:id", upload.single("image"), categoryController.updateCategory);
router.delete("/categories/:id", categoryController.deleteCategory);

// Child category management (admin only)
router.post("/categories/:id/children", upload.single("image"), categoryController.addChildCategory);
router.patch("/categories/:id/children/:childId", upload.single("image"), categoryController.updateChildCategory);
router.delete("/categories/:id/children/:childId", categoryController.deleteChildCategory);


module.exports = router;
