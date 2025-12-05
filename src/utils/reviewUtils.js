// utils/reviewUtils.js
const Review = require("../models/review.model");
const Product = require("../models/product.model");

async function updateProductRatings(productId) {
  const reviews = await Review.find({ product: productId, is_approved: true });

  if (reviews.length === 0) {
    await Product.findByIdAndUpdate(productId, {
      ratingsAverage: 0,
      ratingsQuantity: 0,
    });
    return;
  }

  const totalRating = reviews.reduce((sum, review) => sum + review.rating, 0);
  const averageRating = totalRating / reviews.length;

  await Product.findByIdAndUpdate(productId, {
    ratingsAverage: averageRating,
    ratingsQuantity: reviews.length,
  });
}

module.exports = { updateProductRatings };
