const mongoose = require("mongoose");

const directFinisherSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  finished: { type: Boolean, default: false },
}, { timestamps: true });

module.exports = mongoose.model("DirectFinisher", directFinisherSchema,"DirectFinisher");
