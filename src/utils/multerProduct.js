// src/utils/multerProduct.js
const multer = require("multer");
const { CloudinaryStorage } = require("multer-storage-cloudinary");
const { cloudinary } = require("../../config/cloudinary"); // adjust the path if needed

const productStorage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: "ecommerce/products",
    format: async (req, file) => {
      // keep original extension (jpg/png)
      const mime = file.mimetype.split("/")[1];
      return mime === "jpeg" ? "jpg" : mime;
    },
    transformation: [{ width: 1200, height: 1200, crop: "limit" }],
  },
});

const upload = multer({
  storage: productStorage,
  limits: { fileSize: 8 * 1024 * 1024 }, // 8MB
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith("image")) cb(null, true);
    else cb(new Error("Not an image! Please upload images only."), false);
  },
});

module.exports = upload;
