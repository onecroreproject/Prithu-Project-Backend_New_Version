const mongoose = require("mongoose");
const {prithuDB}=require("../../../database");


const ProjectSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    title: {
      type: String,
      required: true,
      trim: true,
    },

    description: {
      type: String,
      default: "",
      trim: true,
    },

    technologies: [
      {
        type: String,
        trim: true,
      },
    ],

    githubLink: {
      type: String,
      trim: true,
    },

    liveDemoLink: {
      type: String,
      trim: true,
    },

    projectImage: {
      type: String,
      default: "https://cdn-icons-png.flaticon.com/512/906/906324.png", // placeholder
    },

    startDate: {
      type: Date,
      default: null,
    },

    endDate: {
      type: Date,
      default: null,
    },

    isOngoing: {
      type: Boolean,
      default: false,
    },

    role: {
      type: String,
      trim: true,
      default: "",
    },

    highlights: [
      {
        type: String,
        trim: true,
      },
    ],

    visibility: {
      type: String,
      enum: ["public", "private"],
      default: "public",
    },
  },
  { timestamps: true, collection: "Projects" }
);

// Index for faster resume/portfolio load
ProjectSchema.index({ userId: 1, updatedAt: -1 });

module.exports = ProjectSchema;
