const mongoose = require("mongoose");
const { prithuDB } = require("../../../database");

const ReferralCycleSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    referralCount: { type: Number, default: 0 },
    earnedAmount: { type: Number, default: 0 },
    referralIds: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    status: {
        type: String,
        enum: ["active", "completed", "expired", "withdrawn"],
        default: "active"
    }
}, { timestamps: true });

ReferralCycleSchema.index({ userId: 1, status: 1 });
ReferralCycleSchema.index({ userId: 1, endDate: 1 });

module.exports = prithuDB.model("ReferralCycle", ReferralCycleSchema, "ReferralCycles");
