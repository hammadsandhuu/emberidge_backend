const express = require("express");
const router = express.Router();
const cartController = require("../controllers/cart.controller");
const { protect, restrictTo } = require("../middleware/auth.middleware");

router.use(protect);
router.get("/", cartController.getCart);
router.post("/add", cartController.addToCart);
router.patch("/update/:productId", cartController.updateCartItem);
router.delete("/remove/:productId", cartController.removeFromCart);
router.delete("/clear", cartController.clearCart);

module.exports = router;
