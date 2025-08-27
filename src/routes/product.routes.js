const express = require("express");
const router = express.Router();
const productController = require("../controllers/product.controller");
const uploadProduct = require("../utils/uploadProduct");
const { protect, restrictTo } = require("../middleware/auth.middleware");

// Public routes
router.get("/", productController.getAllProducts);
router.get("/:slug", productController.getProduct);
router.get("/category/:categorySlug", productController.getProductsByCategory);
router.get(
  "/category/:categorySlug/:subCategorySlug",
  productController.getProductsByCategory
);

// Review routes (public and authenticated)
router.get("/:id/reviews", productController.getProductReviews);
router.post("/:id/reviews", protect, productController.createReview);
router.patch("/reviews/:reviewId", protect, productController.updateReview);
router.delete("/reviews/:reviewId", protect, productController.deleteReview);
router.patch(
  "/reviews/:reviewId/helpful",
  protect,
  productController.markReviewHelpful
);
router.patch(
  "/reviews/:reviewId/not-helpful",
  protect,
  productController.markReviewNotHelpful
);

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

// Admin review management
router.get("/reviews/all", productController.getAllReviews);
router.patch("/reviews/:reviewId/moderate", productController.moderateReview);

module.exports = router;
