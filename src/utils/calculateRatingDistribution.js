const { Review } = require("../models/product.model");

async function calculateRatingDistribution(productId) {
  const reviews = await Review.find({ product: productId, is_approved: true });

  const distribution = {
    5: 0,
    4: 0,
    3: 0,
    2: 0,
    1: 0,
  };

  reviews.forEach((review) => {
    distribution[review.rating]++;
  });

  // Convert to percentages
  const total = reviews.length;
  if (total > 0) {
    for (let rating in distribution) {
      distribution[rating] = Math.round((distribution[rating] / total) * 100);
    }
  }

  return distribution;
}

module.exports = calculateRatingDistribution;
