const mongoose = require("mongoose");

const feedSchema = new mongoose.Schema({
  type: { type: String, required: true },       // image or video
  language: { type: String, required: true },
    category: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: "Categories", 
    required: true 
  },
  duration: { type: Number, default: null },
  contentUrl: { type: String, required: true },


  contentUrl:{type: String},  // Cloudinary URL
  cloudinaryId:{type: String},
  fileHash: { type: String, index: true },

  // Reference to Creator or Admin account
  createdByAccount: {
    type: mongoose.Schema.Types.ObjectId,
    refPath: "roleRef",  
    required: true,
  },

  roleRef: {
    type: String,
    enum: [ "Admin","Child_Admin","User"],
    required: true,
    default: "User"
  },

  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
},{ timestamps: true });

feedSchema.pre("save", function (next) {
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model("Feed", feedSchema,"Feeds");
