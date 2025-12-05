const mongoose = require("mongoose");

const imageSchema = new mongoose.Schema(
  { thumbnail: String, original: String, alt: String },
  { timestamps: true }
);

module.exports = mongoose.model("Image", imageSchema);
