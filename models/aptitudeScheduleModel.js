const mongoose = require("mongoose");
const { prithuDB } = require("../database");

/*
  Test Schedule Overview:
  -----------------------
  status:
    - upcoming    = scheduled but not started
    - running     = test is currently active
    - completed   = test finished
    - cancelled   = admin cancelled the test
*/

const TestScheduleSchema = new mongoose.Schema(
  {
    testName: { 
      type: String, 
      required: true, 
      trim: true,
      index: true 
    },

    testId: {
      type: Number,
      required: true,
      index: true
    },

    description: { type: String, default: "" },

    startTime: { type: Date, required: true },

    endTime: { type: Date },

    testDuration: { type: Number, required: true },

    totalQuestions: { type: Number, required: true },

    totalScore: { type: Number, required: true },

    passingScore:{ type: Number, required: true },

    status: {
      type: String,
      enum: ["upcoming", "running", "completed", "cancelled"],
      default: "upcoming",
      index: true
    },

    isActive: { type: Boolean, default: true },

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Admin",
      required: false
    }
  },

  { timestamps: true }
);

/* ---------------------------------------------------------
 * ⭐ AUTO STATUS UPDATE LOGIC
 * --------------------------------------------------------- */
function updateStatus(doc) {
  if (!doc || doc.status === "cancelled") return doc;

  const now = new Date();

  // If test has not started yet
  if (now < doc.startTime) {
    doc.status = "upcoming";
  }
  // Running test window
  else if (now >= doc.startTime && now <= doc.endTime) {
    doc.status = "running";
  }
  // Test finished
  else if (now > doc.endTime) {
    doc.status = "completed";
  }

  return doc;
}

/* ---------------------------------------------------------
 * ⭐ APPLY AUTO STATUS WHEN FETCHED FROM DB
 * --------------------------------------------------------- */
TestScheduleSchema.post("find", function(docs) {
  docs.forEach(updateStatus);
});

TestScheduleSchema.post("findOne", function(doc) {
  updateStatus(doc);
});

/* ---------------------------------------------------------
 * ⭐ BEFORE SAVE — Recalculate status IF needed
 * --------------------------------------------------------- */
TestScheduleSchema.pre("save", function(next) {
  updateStatus(this);
  next();
});

/* --------------------------------------------
 * ⚡ PERFORMANCE INDEXES
 * -------------------------------------------- */
TestScheduleSchema.index({ startTime: 1 });
TestScheduleSchema.index({ endTime: 1 });
TestScheduleSchema.index({ status: 1 });
TestScheduleSchema.index({ testName: 1, status: 1 });
TestScheduleSchema.index({ testId: 1 });

module.exports = prithuDB.model(
  "TestSchedule",
  TestScheduleSchema,
  "TestSchedule"
);
