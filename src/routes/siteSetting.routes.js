const express = require("express");
const router = express.Router();
const {
  getSettings,
  getSetting,
  upsertSetting,
} = require("../controllers/siteSetting.controller");
const { protect, restrictTo } = require("../middleware/auth.middleware");

router.use(protect);
router.use(restrictTo("admin"));

router.get("/", getSettings);
router.get("/:key", getSetting);
router.post("/", upsertSetting); 

module.exports = router;
