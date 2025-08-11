// routes/product.routes.js (snippet)
const express = require("express");
const router = express.Router();
const productController = require("../controllers/product.controller");
const upload = require("../utils/multer");
const { protect, restrictTo } = require("../middleware/authMiddleware");

router.get("/products", productController.getAllProducts);
router.get("product/:slug", productController.getProduct);

router.use(protect, restrictTo("admin"));
router.post(
  "/product",
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
