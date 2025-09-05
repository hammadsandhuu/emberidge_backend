const Deal = require("../models/deal.model");

async function getActiveDeals() {
  const now = new Date();
  return Deal.find({
    isActive: true,
    startDate: { $lte: now },
    endDate: { $gte: now },
  });
}

async function applyDealsToProducts(products) {
  const deals = await getActiveDeals();

  return products.map((product) => {
    const pricing = product.getPricingWithDeal(deals);

    return {
      ...product.toObject(),
      finalPrice: pricing.finalPrice,
      basePrice: pricing.basePrice,
      activeDeal: pricing.activeDeal,
      variation_options: pricing.variations,
    };
  });
}

module.exports = { getActiveDeals, applyDealsToProducts };
