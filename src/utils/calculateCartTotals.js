const Product = require("../models/product.model");
const Coupon = require("../models/coupon.model");

const calculateCartTotals = async (cart, userId) => {
  let total = 0;

  for (const item of cart.items) {
    const product = await Product.findById(item.product);
    if (!product) continue;
    total += product.price * item.quantity;
  }

  let discount = 0;

  if (cart.coupon) {
    const coupon = await Coupon.findById(cart.coupon);

    if (coupon && coupon.isActive && !coupon.isExpired) {
      const now = new Date();
      const valid =
        total >= coupon.minCartValue &&
        (!coupon.startDate || coupon.startDate <= now);

      if (valid) {
        if (coupon.discountType === "percentage") {
          discount = (total * coupon.discountValue) / 100;
          if (coupon.maxDiscount)
            discount = Math.min(discount, coupon.maxDiscount);
        } else if (coupon.discountType === "fixed") {
          discount = coupon.discountValue;
        }

        discount = Math.min(discount, total);
      } else {
        cart.coupon = null; // remove invalid coupon
      }
    }
  }

  cart.total = total;
  cart.discount = discount;
  cart.finalTotal = Math.max(total - discount, 0);

  return cart;
};

module.exports = calculateCartTotals;
