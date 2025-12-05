
// Helper to delete cloudinary images (safe)
async function safeDestroy(publicId) {
  if (!publicId) return;
  try {
    await cloudinary.uploader.destroy(publicId);
  } catch (err) {
    console.error("Cloudinary destroy error:", err.message);
  }
}

module.exports = safeDestroy;