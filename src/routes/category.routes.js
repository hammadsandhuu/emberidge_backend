const express = require("express");
const router = express.Router();
const categoryController = require("../controllers/category.controller");
const { protect, restrictTo } = require("../middleware/auth.middleware");
const uploadCategoryFields = require("../utils/uploadCategory"); 



// PUBLIC ROUTES
router.get("", categoryController.getAllCategories);
router.get("/subcategories", categoryController.getAllSubCategories);
router.get("/path", categoryController.getAllSubCategories);
router.get("/:slug", categoryController.getCategory);


// PROTECTED ROUTES (ADMIN ONLY)
router.use(protect, restrictTo("admin"));

// CATEGORY CRUD
router.post(
  "",
  uploadCategoryFields,
  categoryController.createCategory
);

router.patch(
  "/:id",
  uploadCategoryFields,
  categoryController.updateCategory
);

router.delete("/:id", categoryController.deleteCategory);

// SUBCATEGORY CRUD
router.post(
  "/:parentId/subcategories",
  uploadCategoryFields,
  categoryController.createSubCategory
);

router.patch(
  "/subcategories/:id",
  uploadCategoryFields,
  categoryController.updateSubCategory
);

router.delete("/subcategories/:id", categoryController.deleteSubCategory);

module.exports = router;
