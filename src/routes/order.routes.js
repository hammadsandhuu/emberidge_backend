const express = require("express");
const router = express.Router();
const orderController = require("../controllers/order.controller");
const { protect, restrictTo } = require("../middleware/auth.middleware");

// User routes
router.use(protect);
router.get("/", orderController.getOrders);
router.post("/", orderController.createOrder);
router.get("/:id", orderController.getOrder);
router.patch("/:id/cancel", orderController.cancelOrder);
router.get("/track/:trackingNumber", orderController.trackOrder);


// Admin routes
router.use(restrictTo("admin"));
router.get("/admin/all", orderController.getAllOrders);
router.patch("/admin/:id/status", orderController.updateOrderStatus);
router.delete("/admin/:id", orderController.deleteOrder);
router.put("/:id/status", orderController.markOrderStatus);

module.exports = router;
