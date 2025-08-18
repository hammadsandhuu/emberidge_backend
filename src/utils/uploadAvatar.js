const multer = require("multer");
const { getCloudinaryStorage } = require("../../config/cloudinary");

const uploadAvatar = multer({
  storage: getCloudinaryStorage("ecommerce/avatars"), // folder cloudinary pe
  limits: { fileSize: 3 * 1024 * 1024 }, // 3MB
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith("image")) cb(null, true);
    else cb(new Error("Not an image! Upload images only."), false);
  },
});

module.exports = uploadAvatar;
