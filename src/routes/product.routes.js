const express = require("express");
const router = express.Router();
const productController = require("../controllers/product.controller");
const reviewController = require("../controllers/review.controller");
const uploadProduct = require("../utils/uploadProduct");
const { protect, restrictTo } = require("../middleware/auth.middleware");

// Public routes
router.get("/categories", productController.getProductsByCategory);
router.get("/category/:categorySlug", productController.getProductsByCategory);
router.get("/", productController.getAllProducts);
router.get("/:slug", productController.getProduct);

// Review routes (public and authenticated)
router.get("/:id/reviews", reviewController.getProductReviews);
router.post("/:id/reviews", protect, reviewController.createReview);
router.patch("/reviews/:reviewId", protect, reviewController.updateReview);
router.delete("/reviews/:reviewId", protect, reviewController.deleteReview);
router.patch(
  "/reviews/:reviewId/helpful",
  protect,
  reviewController.markReviewHelpful
);
router.patch(
  "/reviews/:reviewId/not-helpful",
  protect,
  reviewController.markReviewNotHelpful
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
router.get("/reviews/all", reviewController.getAllReviews);
router.patch("/reviews/:reviewId/moderate", reviewController.moderateReview);

module.exports = router;
