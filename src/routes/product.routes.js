// routes/product.routes.js
const express = require("express");
const router = express.Router();
const productController = require("../controllers/product.controller");
const upload = require("../utils/multer");
const { protect, restrictTo } = require("../middleware/authMiddleware");

// Public routes
router.get("/", productController.getAllProducts);
router.get("/:slug", productController.getProduct);

// Admin-only routes
router.use(protect, restrictTo("admin"));
router.post(
  "/",
  upload.fields([
    { name: "image", maxCount: 1 },
    { name: "gallery", maxCount: 5 },
  ]),
  productController.createProduct
);
router.patch(
  "/:id",
  upload.fields([
    { name: "image", maxCount: 1 },
    { name: "gallery", maxCount: 5 },
  ]),
  productController.updateProduct
);
router.delete("/:id", productController.deleteProduct);

module.exports = router;
