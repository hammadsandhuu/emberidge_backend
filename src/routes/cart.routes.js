const express = require("express");
const router = express.Router();
const cartController = require("../controllers/cart.controller");
const { protect } = require("../middleware/auth.middleware");

router.use(protect);

router.get("/", cartController.getCart);
router.post("/add", cartController.addToCart);
router.patch("/update/:productId", cartController.updateCartItem);
router.delete("/remove/:productId", cartController.removeFromCart);
router.delete("/clear", cartController.clearCart);

// Coupon routes (user)
router.post("/apply-coupon", cartController.applyCoupon);
router.delete("/remove-coupon", cartController.removeCoupon);
// Shipping method
router.patch("/set-shipping-method", cartController.setShippingMethod);
router.patch("/set-payment-method", cartController.setPaymentMethod);

module.exports = router;
