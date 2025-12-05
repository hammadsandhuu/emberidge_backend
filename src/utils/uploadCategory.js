const multer = require("multer");
const { getCloudinaryStorage } = require("../../config/cloudinary");
const imageFileFilter = require("./multerFileFilter");

const uploadCategory = multer({
  storage: getCloudinaryStorage("ecommerce/categories"),
  limits: { fileSize: 3 * 1024 * 1024 }, // 3MB
  fileFilter: imageFileFilter,
});

const uploadCategoryFields = uploadCategory.fields([
  { name: "thumbnail", maxCount: 1 },
  { name: "banner", maxCount: 1 },
  { name: "mobile", maxCount: 1 },
  { name: "gallery", maxCount: 5 },
]);

module.exports = uploadCategoryFields;
