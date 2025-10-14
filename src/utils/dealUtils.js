const Deal = require("../models/deal.model");

async function getActiveDeals() {
  const now = new Date();
  return Deal.find({
    isActive: true,
    startDate: { $lte: now },
    endDate: { $gte: now },
  }).sort({ priority: -1 });
}

// Option 1: Best Discount Wins
async function applyDealsToProducts(products) {
  const deals = await getActiveDeals();
  const now = new Date();

  return products.map((product) => {
    const basePrice = product.price;
    let finalPrice = basePrice;
    let activeDeal = null;

    // Product’s own sale
    if (
      product.on_sale &&
      product.sale_start &&
      product.sale_end &&
      product.sale_start <= now &&
      product.sale_end >= now &&
      product.sale_price
    ) {
      finalPrice = product.sale_price;
    }

    // Apply deals
    for (const deal of deals) {
      const included =
        deal.isGlobal ||
        deal.products?.includes(product._id) ||
        deal.categories?.includes(product.category);

      if (!included) continue;

      let dealPrice = basePrice;
      if (deal.discountType === "percentage") {
        dealPrice = basePrice - (basePrice * deal.discountValue) / 100;
      } else if (["fixed", "flat"].includes(deal.discountType)) {
        dealPrice = Math.max(0, basePrice - deal.discountValue);
      }

      if (dealPrice < finalPrice) {
        finalPrice = dealPrice;
        activeDeal = deal;
      }
    }

    return {
      ...product.toObject(),
      basePrice,
      finalPrice,
      activeDeal,
      discountPercent: Math.round(((basePrice - finalPrice) / basePrice) * 100),
    };
  });
}

module.exports = { getActiveDeals, applyDealsToProducts };
