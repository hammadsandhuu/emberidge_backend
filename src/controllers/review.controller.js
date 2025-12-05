const Review = require("../models/review.model");
const Product = require("../models/product.model");

const catchAsync = require("../utils/catchAsync");
const successResponse = require("../utils/successResponse");
const errorResponse = require("../utils/errorResponse");
const { updateProductRatings } = require("../utils/reviewUtils");

// ------------------ CREATE REVIEW ------------------
exports.createReview = catchAsync(async (req, res, next) => {
  const { rating, title, comment } = req.body;
  const productId = req.params.id;
  const userId = req.user._id;

  const product = await Product.findById(productId);
  if (!product) return errorResponse(res, "Product not found", 404);

  const existingReview = await Review.findOne({
    product: productId,
    user: userId,
  });
  if (existingReview) {
    return errorResponse(res, "You have already reviewed this product", 400);
  }

  const review = await Review.create({
    product: productId,
    user: userId,
    rating,
    title,
    comment,
    is_approved: true,
  });

  product.reviews.push(review._id);
  await product.save();

  await updateProductRatings(productId);

  const populatedReview = await Review.findById(review._id).populate({
    path: "user",
    select: "name email",
  });

  return successResponse(
    res,
    { review: populatedReview },
    "Review created successfully",
    201
  );
});

// ------------------ GET PRODUCT REVIEWS ------------------
exports.getProductReviews = catchAsync(async (req, res, next) => {
  const productId = req.params.id;

  const reviews = await Review.find({ product: productId, is_approved: true })
    .populate({
      path: "user",
      select: "name email",
    })
    .sort({ createdAt: -1 });

  const product = await Product.findById(productId);
  if (!product) return errorResponse(res, "Product not found", 404);

  return successResponse(
    res,
    {
      reviews,
      total: reviews.length,
      averageRating: product.ratingsAverage,
      totalRatings: product.ratingsQuantity,
    },
    "Reviews fetched successfully"
  );
});

// ------------------ UPDATE REVIEW ------------------
exports.updateReview = catchAsync(async (req, res, next) => {
  const { rating, title, comment } = req.body;
  const reviewId = req.params.reviewId;

  const review = await Review.findById(reviewId);
  if (!review) return errorResponse(res, "Review not found", 404);

  if (
    review.user.toString() !== req.user._id.toString() &&
    req.user.role !== "admin"
  ) {
    return errorResponse(res, "You can only update your own reviews", 403);
  }

  const oldRating = review.rating;

  const updatedReview = await Review.findByIdAndUpdate(
    reviewId,
    { rating, title, comment },
    { new: true, runValidators: true }
  ).populate({
    path: "user",
    select: "name email",
  });

  if (rating !== oldRating) {
    await updateProductRatings(review.product);
  }

  return successResponse(
    res,
    { review: updatedReview },
    "Review updated successfully"
  );
});

// ------------------ DELETE REVIEW ------------------
exports.deleteReview = catchAsync(async (req, res, next) => {
  const reviewId = req.params.reviewId;

  const review = await Review.findById(reviewId);
  if (!review) return errorResponse(res, "Review not found", 404);

  if (
    review.user.toString() !== req.user._id.toString() &&
    req.user.role !== "admin"
  ) {
    return errorResponse(res, "You can only delete your own reviews", 403);
  }

  await Product.findByIdAndUpdate(review.product, {
    $pull: { reviews: reviewId },
  });

  await Review.findByIdAndDelete(reviewId);

  await updateProductRatings(review.product);

  return successResponse(res, null, "Review deleted successfully", 204);
});

// ------------------ MODERATE REVIEW (ADMIN) ------------------
exports.moderateReview = catchAsync(async (req, res, next) => {
  const { is_approved } = req.body;
  const reviewId = req.params.reviewId;

  const review = await Review.findByIdAndUpdate(
    reviewId,
    { is_approved },
    { new: true, runValidators: true }
  ).populate({
    path: "user",
    select: "name email",
  });

  if (!review) return errorResponse(res, "Review not found", 404);

  await updateProductRatings(review.product);

  return successResponse(
    res,
    { review },
    `Review ${is_approved ? "approved" : "rejected"} successfully`
  );
});

// ------------------ GET ALL REVIEWS (ADMIN) ------------------
exports.getAllReviews = catchAsync(async (req, res, next) => {
  const filter = {};

  if (req.query.status) {
    filter.is_approved = req.query.status === "approved";
  }

  if (req.query.product) {
    filter.product = req.query.product;
  }

  if (req.query.user) {
    filter.user = req.query.user;
  }

  const reviews = await Review.find(filter)
    .populate({
      path: "user",
      select: "name email",
    })
    .populate({
      path: "product",
      select: "name slug",
    })
    .sort({ createdAt: -1 });

  return successResponse(
    res,
    { reviews, total: reviews.length },
    "Reviews fetched successfully"
  );
});

// ------------------ MARK REVIEW HELPFUL ------------------
exports.markReviewHelpful = catchAsync(async (req, res, next) => {
  const reviewId = req.params.reviewId;
  const userId = req.user._id;

  const review = await Review.findById(reviewId);
  if (!review) return errorResponse(res, "Review not found", 404);

  // Remove user from notHelpfulUsers if they had voted not helpful
  review.notHelpfulUsers = review.notHelpfulUsers.filter(
    (id) => id.toString() !== userId.toString()
  );

  if (review.helpfulUsers.some((id) => id.toString() === userId.toString())) {
    // If already marked helpful, toggle off
    review.helpfulUsers = review.helpfulUsers.filter(
      (id) => id.toString() !== userId.toString()
    );
  } else {
    // Otherwise, add user to helpfulUsers
    review.helpfulUsers.push(userId);
  }

  await review.save();

  return successResponse(
    res,
    {
      helpfulCount: review.helpfulUsers.length,
      notHelpfulCount: review.notHelpfulUsers.length,
    },
    "Helpful vote updated"
  );
});

// ------------------ MARK REVIEW NOT HELPFUL ------------------
exports.markReviewNotHelpful = catchAsync(async (req, res, next) => {
  const reviewId = req.params.reviewId;
  const userId = req.user._id;

  const review = await Review.findById(reviewId);
  if (!review) return errorResponse(res, "Review not found", 404);

  // Remove user from helpfulUsers if they had voted helpful
  review.helpfulUsers = review.helpfulUsers.filter(
    (id) => id.toString() !== userId.toString()
  );

  if (
    review.notHelpfulUsers.some((id) => id.toString() === userId.toString())
  ) {
    // If already marked not helpful, toggle off
    review.notHelpfulUsers = review.notHelpfulUsers.filter(
      (id) => id.toString() !== userId.toString()
    );
  } else {
    // Otherwise, add user to notHelpfulUsers
    review.notHelpfulUsers.push(userId);
  }

  await review.save();

  return successResponse(
    res,
    {
      helpfulCount: review.helpfulUsers.length,
      notHelpfulCount: review.notHelpfulUsers.length,
    },
    "Not helpful vote updated"
  );
});
