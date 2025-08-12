const cloudinary = require("cloudinary").v2;
const { CloudinaryStorage } = require("multer-storage-cloudinary");

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

/**
 * Factory to create multer storage with dynamic folder
 * @param {string} defaultFolder
 */
const getCloudinaryStorage = (defaultFolder = "ecommerce/others") => {
  return new CloudinaryStorage({
    cloudinary,
    params: async (req, file) => {
      // Folder can be set in middleware as req.folder or fallback to default
      const folder = req.folder || defaultFolder;

      return {
        folder,
        allowed_formats: ["jpg", "jpeg", "png"],
        public_id: `${Date.now()}-${file.originalname.split(".")[0]}`,
      };
    },
  });
};

module.exports = { cloudinary, getCloudinaryStorage };
