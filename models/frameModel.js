// models/Frame.js
const mongoose = require("mongoose");

const frameSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    publicId: { type: String, required: true }, 
    url: { type: String, required: true }, 
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Frame", frameSchema,"Frames");
