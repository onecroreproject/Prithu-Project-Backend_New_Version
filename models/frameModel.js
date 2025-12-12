const mongoose = require("mongoose");
const { prithuDB } = require("../database");

const frameSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },

    // Local file fields
    localPath: { type: String, required: true },
    url: { type: String, required: true },

    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

module.exports = prithuDB.model("Frame", frameSchema, "Frames");
