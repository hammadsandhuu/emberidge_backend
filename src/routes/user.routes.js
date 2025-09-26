const express = require("express");
const userController = require("../controllers/user.controller");
const uploadAvatar = require("../utils/uploadAvatar");
const { protect, restrictTo } = require("../middleware/auth.middleware");

const router = express.Router();

router.use(protect);
router
  .route("/me")
  .get(userController.getMe)
  .patch(uploadAvatar.single("avatar"), userController.updateMe);

// Address Book
router
  .route("/me/addresses")
  .get(userController.getAddresses)
  .post(userController.addAddress);

router.get("/me/addresses/default", userController.getDefaultAddress);

router
  .route("/me/addresses/:addressId")
  .patch(userController.updateAddress)
  .delete(userController.deleteAddress);

router.patch(
  "/me/addresses/:addressId/default",
  userController.setDefaultAddress
);

// Admin Routes
router.use(restrictTo("admin"));
router.route("/").get(userController.getAllUsers); 
router
  .route("/:id")
  .get(userController.getUser)
  .patch(userController.updateUser)
  .delete(userController.deleteUser);

module.exports = router;
