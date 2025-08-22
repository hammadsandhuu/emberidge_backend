const multer = require("multer");
const { getCloudinaryStorage } = require("../../config/cloudinary");

const uploadCategory = multer({
  storage: getCloudinaryStorage("ecommerce/categories"),
  limits: { fileSize: 3 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith("image")) cb(null, true);
    else cb(new Error("Not an image! Upload images only."), false);
  },
});

module.exports = uploadCategory;
