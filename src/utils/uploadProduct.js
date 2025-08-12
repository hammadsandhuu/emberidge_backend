const multer = require("multer");
const { getCloudinaryStorage } = require("../../config/cloudinary");

const uploadProduct = multer({
  storage: getCloudinaryStorage("ecommerce/products"),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith("image")) cb(null, true);
    else cb(new Error("Not an image! Upload images only."), false);
  },
});

module.exports = uploadProduct;
