const mongoose = require("mongoose");

const feedSchema = new mongoose.Schema({
  type: { type: String, required: true },       // image or video
  language: { type: String, required: true },
  category: { type: String, required: true },
  duration: { type: Number, default: null },
  contentUrl: { type: String, required: true },

  // Reference to Creator or Admin account
  createdByAccount: {
    type: mongoose.Schema.Types.ObjectId,
    refPath: "roleRef",  // dynamically reference model based on roleRef
    required: true,
  },

  roleRef: {
    type: String,
    enum: [ "Admin","Account","Child_Admin","Creator"],
    required: true,
    default: "Account"
  },

  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
},{ timestamps: true });

feedSchema.pre("save", function (next) {
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model("Feed", feedSchema,"Feeds");
