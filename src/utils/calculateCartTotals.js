const Product = require("../models/product.model");

const calculateCartTotals = async (cart) => {
  let total = 0;

  for (const item of cart.items) {
    const product = await Product.findById(item.product);
    if (!product) continue;
    total += product.price * item.quantity;
  }

  cart.total = total;
  cart.finalTotal = total;

  return cart;
};

module.exports = calculateCartTotals;
