const express = require("express");
const router = express.Router();
const productController = require("../controllers/product.controller");
const uploadProduct = require("../utils/uploadProduct");
const { protect, restrictTo } = require("../middleware/auth.middleware");

// Public routes
router.get("/", productController.getAllProducts);
router.get("/:slug", productController.getProduct);

// Admin-only routes
router.use(protect, restrictTo("admin"));

router.post(
  "/",
  uploadProduct.fields([
    { name: "image", maxCount: 1 },
    { name: "gallery", maxCount: 5 },
  ]),
  productController.createProduct
);

router.patch(
  "/:id",
  uploadProduct.fields([
    { name: "image", maxCount: 1 },
    { name: "gallery", maxCount: 5 },
  ]),
  productController.updateProduct
);

router.delete("/:id", productController.deleteProduct);

module.exports = router;
