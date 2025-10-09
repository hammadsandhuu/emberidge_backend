const express = require("express");
const router = express.Router();
const zoneController = require("../controllers/shippingZone.controller");
const { protect, restrictTo,  } = require("../middleware/auth.middleware");

// 🔒 Admin routes
router.use(protect);

router.post("/", restrictTo("admin"), zoneController.createZone);
router.put("/:id", restrictTo("admin"), zoneController.updateZone);
router.delete("/:id", restrictTo("admin"), zoneController.deleteZone);

router.get("/", zoneController.getZones);
router.get("/region", zoneController.getZoneByRegion);

module.exports = router;
