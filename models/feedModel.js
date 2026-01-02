const mongoose = require("mongoose");
const { prithuDB } = require("../database");

const feedSchema = new mongoose.Schema(
  {
    // image | video
    type: { type: String, required: true },

    language: { type: String, default: "en" },

    category: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Categories",
      required: true,
    },

    // Video duration (if video)
    duration: { type: Number, default: null },

    // Public URL of stored file
    contentUrl: { type: String, required: true },

    // Array for multiple files support
    files: [{
      url: { type: String, required: true },
      type: { type: String, enum: ["image", "video"], required: true },
      mimeType: { type: String },
      size: { type: Number },
      thumbnail: { type: String }, // For video thumbnails
      duration: { type: Number }, // For videos
      order: { type: Number, default: 0 }
    }],

    // Local filename for deletion / update
    localFilename: { type: String },

    // Optional: absolute local path
    localPath: { type: String },

    // Description
    dec: { type: String, default: "" },

    // Duplicate detection hash
    fileHash: { type: String, index: true },

    // Creator
    createdByAccount: {
      type: mongoose.Schema.Types.ObjectId,
      refPath: "roleRef",
      required: true,
      index: true,
    },

    roleRef: {
      type: String,
      enum: ["Admin", "Child_Admin", "User"],
      default: "User",
      index: true,
    },

    // Precomputed colors
    themeColor: {
      primary: { type: String, default: "#ffffff" },
      secondary: { type: String, default: "#cccccc" },
      accent: { type: String, default: "#999999" },
      gradient: {
        type: String,
        default: "linear-gradient(135deg, #ffffff, #cccccc, #999999)",
      },
      text: { type: String, default: "#000000" },
    },

    hashtags: [{ type: String, index: true }],

    // New: Mentioned/tagged users
    taggedUsers: [{
      userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true
      },
      userName: { type: String },
      name: { type: String }
    }],

    // New: Post editing metadata
    editMetadata: {
      // Crop and positioning
      crop: {
        ratio: { 
          type: String, 
          enum: ["original", "1:1", "4:5", "16:9"], 
          default: "original" 
        },
        zoomLevel: { type: Number, default: 1, min: 1, max: 3 },
        position: {
          x: { type: Number, default: 0 },
          y: { type: Number, default: 0 }
        }
      },
      // Filters and adjustments
      filters: {
        preset: { 
          type: String, 
          enum: ["original", "aden", "clarendon", "crema", "gingham", "juno", 
                "lark", "ludwig", "moon", "perpetua", "reyes", "slumber"], 
          default: "original" 
        },
        adjustments: {
          brightness: { type: Number, default: 0, min: -100, max: 100 },
          contrast: { type: Number, default: 0, min: -100, max: 100 },
          saturation: { type: Number, default: 0, min: -100, max: 100 },
          fade: { type: Number, default: 0, min: 0, max: 100 },
          temperature: { type: Number, default: 0, min: -100, max: 100 },
          vignette: { type: Number, default: 0, min: 0, max: 100 }
        }
      }
    },

    // Audience settings
    audience: {
      type: String,
      enum: ["public", "private", "followers", "specific"],
      default: "public"
    },
    // For "specific" audience
    allowedUsers: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: "User"
    }],


    storageType: {
  type: String,
  enum: ["local", "gdrive"],
  default: "local"
},

driveFileId: {
  type: String,
  default: null
},


    // Location
    location: {
      name: { type: String },
      coordinates: {
        type: { type: String, enum: ["Point"], default: "Point" },
        coordinates: { type: [Number], default: [0, 0] } // [lng, lat]
      }
    },

    // Stats
    statsId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "FeedStats",
      index: true,
    },

    // Scheduling support
    isScheduled: { type: Boolean, default: false },
    scheduleDate: { type: Date, default: null, index: true },

    // Post status
    status: {
      type: String,
      enum: ["Pending", "Published", "Draft", "Scheduled", "Archived", "Deleted"],
      default: "Published",
    },

    // Soft delete
    isDeleted: { type: Boolean, default: false },
    deletedAt: { type: Date },

    // Version for edit history
    version: { type: Number, default: 1 },
    previousVersions: [{
      dec: { type: String },
      files: [{
        url: { type: String },
        type: { type: String },
        mimeType: { type: String }
      }],
      editMetadata: { type: mongoose.Schema.Types.Mixed },
      editedAt: { type: Date, default: Date.now },
      editedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" }
    }]
  },
  { 
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

// Virtual for formatted URL
feedSchema.virtual('formattedUrl').get(function() {
  return this.contentUrl || (this.files && this.files[0]?.url);
});

// Virtual for thumbnail URL
feedSchema.virtual('thumbnailUrl').get(function() {
  if (this.type === 'video' && this.files && this.files[0]?.thumbnail) {
    return this.files[0].thumbnail;
  }
  return this.contentUrl || (this.files && this.files[0]?.url);
});

// Index for geospatial queries
feedSchema.index({ "location.coordinates": "2dsphere" });

// PERFORMANCE INDEXES
feedSchema.index({ createdAt: -1 });
feedSchema.index({ createdByAccount: 1 });
feedSchema.index({ roleRef: 1 });
feedSchema.index({ category: 1 });
feedSchema.index({ isScheduled: 1, scheduleDate: 1 });
feedSchema.index({ fileHash: 1 });
feedSchema.index({ language: 1 });
feedSchema.index({ hashtags: 1 });
feedSchema.index({ status: 1 });
feedSchema.index({ audience: 1 });
feedSchema.index({ "taggedUsers.userId": 1 });
feedSchema.index({ "editMetadata.filters.preset": 1 });

// Pre-save middleware
feedSchema.pre("save", function (next) {
  this.updatedAt = Date.now();
  
  // Extract hashtags from description
  if (this.dec && this.isModified('dec')) {
    const hashtagRegex = /#(\w+)/g;
    const matches = this.dec.match(hashtagRegex);
    this.hashtags = matches ? matches.map(tag => tag.slice(1)) : [];
  }
  
  // Set status based on scheduling
  if (this.isScheduled && this.scheduleDate > new Date()) {
    this.status = "Scheduled";
  }
  
  next();
});

// Method to get filter CSS
feedSchema.methods.getFilterStyle = function() {
  if (!this.editMetadata?.filters) return '';
  
  const { preset, adjustments } = this.editMetadata.filters;
  let filterStyle = '';
  
  // Apply preset filter
  switch(preset) {
    case 'aden':
      filterStyle += 'sepia(0.2) brightness(1.15) saturate(1.4) ';
      break;
    case 'clarendon':
      filterStyle += 'contrast(1.2) saturate(1.35) ';
      break;
    case 'crema':
      filterStyle += 'sepia(0.5) contrast(1.25) brightness(1.15) saturate(0.9) ';
      break;
    case 'gingham':
      filterStyle += 'contrast(1.1) brightness(1.1) ';
      break;
    case 'juno':
      filterStyle += 'sepia(0.35) contrast(1.15) brightness(1.15) saturate(1.8) ';
      break;
    case 'lark':
      filterStyle += 'contrast(0.9) ';
      break;
    case 'ludwig':
      filterStyle += 'sepia(0.25) contrast(1.05) brightness(1.05) saturate(2) ';
      break;
    case 'moon':
      filterStyle += 'grayscale(1) contrast(1.1) brightness(1.1) ';
      break;
    case 'perpetua':
      filterStyle += 'contrast(1.1) brightness(1.25) saturate(1.1) ';
      break;
    case 'reyes':
      filterStyle += 'sepia(0.75) contrast(0.75) brightness(1.25) saturate(1.4) ';
      break;
    case 'slumber':
      filterStyle += 'saturate(0.66) brightness(1.05) ';
      break;
    default:
      // Original - no preset filter
      break;
  }
  
  // Apply adjustments
  if (adjustments) {
    filterStyle += `brightness(${1 + (adjustments.brightness / 100)}) `;
    filterStyle += `contrast(${1 + (adjustments.contrast / 100)}) `;
    filterStyle += `saturate(${1 + (adjustments.saturation / 100)}) `;
    filterStyle += `sepia(${adjustments.fade / 100}) `;
    filterStyle += `hue-rotate(${adjustments.temperature}deg) `;
  }
  
  return filterStyle.trim();
};

// Method to create edit history
feedSchema.methods.saveEditHistory = async function(userId) {
  const historyEntry = {
    dec: this.dec,
    files: this.files.map(file => ({
      url: file.url,
      type: file.type,
      mimeType: file.mimeType
    })),
    editMetadata: this.editMetadata,
    editedBy: userId
  };
  
  this.previousVersions.push(historyEntry);
  this.version += 1;
  
  return this.save();
};

module.exports = prithuDB.model("Feed", feedSchema, "Feeds");