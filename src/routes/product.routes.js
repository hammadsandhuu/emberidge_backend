const express = require("express");
const router = express.Router();
const productController = require("../controllers/product.controller");
const { protect, restrictTo } = require("../middleware/authMiddleware");
// Single endpoint for all product operations
router.get("/products", productController.getAllProducts);

// Protected admin routes
router.use(protect, restrictTo("admin"));
router.post("/", productController.createProduct);
router
  .route("/:id")
  .patch(productController.updateProduct)
  .delete(productController.deleteProduct);

module.exports = router;
