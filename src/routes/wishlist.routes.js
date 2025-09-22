const express = require("express");
const router = express.Router();
const wishlistController = require("../controllers/wishlist.controller");
const { protect } = require("../middleware/auth.middleware");

router.use(protect);
router.get("/", wishlistController.getWishlist);
router.post("/add/:productId", wishlistController.addToWishlist);
router.delete("/remove/:productId", wishlistController.removeFromWishlist);
router.post("/merge", wishlistController.mergeWishlist);


module.exports = router;
