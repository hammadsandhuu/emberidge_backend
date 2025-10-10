const Product = require("../models/product.model");
const Coupon = require("../models/coupon.model");
const ShippingZone = require("../models/shippingZone.model");
const SiteSetting = require("../models/siteSetting.model");

const {
  EXPRESS_MULTIPLIER,
  DEFAULT_BASE_RATE,
  DEFAULT_REGION_MULTIPLIER,
  DEFAULT_FREE_SHIPPING_THRESHOLD,
  SHIPPING_CLASS_SURCHARGES,
} = require("../../config/constants");
const siteSettingModel = require("../models/siteSetting.model");

const calculateCartTotals = async (cart, userId, userAddress = {}) => {
  // Fetch products
  const productIds = cart.items.map((it) =>
    typeof it.product === "object" ? it.product._id : it.product
  );
  const products = await Product.find({ _id: { $in: productIds } });

  // Calculate subtotal + total weight
  let subtotal = 0;
  let totalWeight = 0;

  for (const item of cart.items) {
    const product = products.find(
      (p) =>
        p._id.toString() ===
        (typeof item.product === "object"
          ? item.product._id.toString()
          : item.product.toString())
    );
    if (!product) continue;

    const price = product.sale_price ?? product.price ?? 0;
    subtotal += price * item.quantity;

    const weight = product.weight ?? 0;
    totalWeight += weight * item.quantity;

    item.product = product;
  }

  // Coupon logic
  let discount = 0;
  let validCoupon = null;

  if (cart.coupon) {
    const coupon = await Coupon.findById(cart.coupon);
    if (
      coupon &&
      coupon.isActive &&
      (!coupon.expiryDate || coupon.expiryDate > new Date())
    ) {
      const eligible =
        subtotal >= (coupon.minCartValue || 0) &&
        (!coupon.startDate || coupon.startDate <= new Date());

      if (eligible) {
        validCoupon = coupon;
        if (coupon.discountType === "percentage") {
          discount = (subtotal * coupon.discountValue) / 100;
          if (coupon.maxDiscount)
            discount = Math.min(discount, coupon.maxDiscount);
        } else if (coupon.discountType === "fixed") {
          discount = coupon.discountValue;
        }
      } else {
        cart.coupon = null;
      }
    } else {
      cart.coupon = null;
    }
  }

  discount = Math.min(discount, subtotal);

  // Shipping zone + weight rates
  const pincode = cart.addressPincode || userAddress.pincode || "";
  const pfx = pincode ? pincode.substring(0, 2) : null;
  let zone = null;

  if (pfx) {
    zone = await ShippingZone.findOne({
      pinCodePrefix: { $regex: `^${pfx}` },
      isActive: true,
    });
  }

  const baseRate = zone?.baseRate ?? DEFAULT_BASE_RATE;
  const regionMultiplier = zone?.regionMultiplier ?? DEFAULT_REGION_MULTIPLIER;
  const expressMultiplier =
    cart.shippingMethod === "express"
      ? zone?.expressMultiplier ?? EXPRESS_MULTIPLIER
      : 1.0;
  const freeShippingThreshold =
    zone?.freeShippingThreshold ?? DEFAULT_FREE_SHIPPING_THRESHOLD;
  const weightRates = Array.isArray(zone?.weightRates) ? zone.weightRates : [];

  // Handling fee
  let baseHandling = 0;
  for (const item of cart.items) {
    baseHandling += (item.product.shippingFee ?? 0) * item.quantity;
  }

  // Weight rate calc
  let weightCharge = 0;
  if (weightRates.length > 0) {
    const tier = weightRates.find(
      (t) => totalWeight >= t.minWeight && totalWeight <= t.maxWeight
    );
    if (tier) weightCharge = tier.rate;
    else {
      const sorted = weightRates.sort((a, b) => a.minWeight - b.minWeight);
      const highest = sorted[sorted.length - 1];
      weightCharge = highest ? highest.rate : 0;
    }
  } else {
    const PER_KG_RATE = 30;
    weightCharge = Math.ceil(totalWeight * PER_KG_RATE);
  }

  // Class multiplier
  let classMultiplier = 1.0;
  if (SHIPPING_CLASS_SURCHARGES) {
    const multipliers = cart.items.map((it) => {
      const c = it.product?.shippingClass ?? "standard";
      return SHIPPING_CLASS_SURCHARGES[c] ?? 1.0;
    });
    classMultiplier = multipliers.length ? Math.max(...multipliers) : 1.0;
  }

  // Calculate shipping fee
  let shippingFee = Math.round(
    (baseRate + baseHandling + weightCharge) *
      regionMultiplier *
      classMultiplier *
      expressMultiplier
  );

  // Check for global free shipping
  let ENABLE_GLOBAL_FREE_SHIPPING = false;
  try {
    const freeShipSetting = await SiteSetting.findOne({
      key: "ENABLE_GLOBAL_FREE_SHIPPING",
    });
    ENABLE_GLOBAL_FREE_SHIPPING =
      freeShipSetting?.value === true || freeShipSetting?.value === "true";
  } catch (err) {
    ENABLE_GLOBAL_FREE_SHIPPING = false;
  }

  if (ENABLE_GLOBAL_FREE_SHIPPING) {
    shippingFee = 0;
  } else {
    if (subtotal >= freeShippingThreshold) shippingFee = 0;
    if (validCoupon?.discountType === "free_shipping") shippingFee = 0;
  }

  // COD fee logic (Dynamic from Site Settings)
  let codFee = 0;

  if (cart.paymentMethod === "cod") {
    try {
      const codFeeSetting = await siteSettingModel.findOne({ key: "COD_FEE" });
      codFee = codFeeSetting ? Number(codFeeSetting.value) || 0 : 0;
    } catch (err) {
      console.error("Error fetching COD_FEE from SiteSetting:", err);
      codFee = 0; // fallback
    }
  } else {
    codFee = 0;
  }

  // Final totals
  cart.total = subtotal;
  cart.discount = discount;
  cart.shippingFee = shippingFee;
  cart.codFee = codFee;
  cart.finalTotal = Math.max(subtotal - discount + shippingFee + codFee, 0);
  cart._computed = { totalWeight };

  return cart;
};

module.exports = calculateCartTotals;
