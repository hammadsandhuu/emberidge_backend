const mongoose = require("mongoose");

const variationSchema = new mongoose.Schema(
  {
    value: { type: String, trim: true },
    attribute: { type: mongoose.Schema.Types.ObjectId, ref: "Attribute" },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Variation", variationSchema);
