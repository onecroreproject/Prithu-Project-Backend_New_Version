const mongoose = require("mongoose");
const { prithuDB } = require("../database");

const InterestedUserSchema = new mongoose.Schema(
  {
    userId: { 
      type: mongoose.Schema.Types.ObjectId, 
      ref: "User", 
      required: true,
      index: true
    },

    testId:{
      type:Number,
       required: true,
      index: true
    },

    firstName: {
      type: String,
      required: true,
      trim: true
    },

    lastName: {
      type: String,
      default: "",
      trim: true
    },

    scheduleId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "TestSchedule",
      required: true,
      index: true
    },

    // Store test name for quick reference (avoid extra DB lookup)
    testName: { 
      type: String, 
      required: true,
      trim: true,
      index: true 
    },

    interestedAt: { 
      type: Date, 
      default: Date.now,
      index: true
    },

    // NEW FIELD
    isValid: {
      type: Boolean,
      default: true,
      index: true
    }
  },

  { timestamps: true }
);

/* --------------------------------------------------------
 * ⚡ PERFORMANCE & DATA QUALITY INDEXES
 * -------------------------------------------------------- */

// Prevent duplicate interest request by same user for same schedule
InterestedUserSchema.index(
  { userId: 1, scheduleId: 1 },
  { unique: true }
);

// Fast filtering by test + schedule
InterestedUserSchema.index({ testName: 1, scheduleId: 1 });

// Fast sorting for admin dashboard
InterestedUserSchema.index({ interestedAt: -1 });

module.exports = prithuDB.model(
  "InterestedUser",
  InterestedUserSchema,
  "InterestedUsers"
);
