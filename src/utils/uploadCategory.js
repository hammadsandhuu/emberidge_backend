const multer = require("multer");
const { getCloudinaryStorage } = require("../../config/cloudinary");
const imageFileFilter = require("./multerFileFilter");

const uploadCategory = multer({
  storage: getCloudinaryStorage("ecommerce/categories"),
  limits: { fileSize: 3 * 1024 * 1024 }, // 3MB
  fileFilter: imageFileFilter,
});

module.exports = uploadCategory;
