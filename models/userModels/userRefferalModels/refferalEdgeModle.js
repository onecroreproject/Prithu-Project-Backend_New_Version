const mongoose = require('mongoose');

const ReferralEdgeSchema = new mongoose.Schema({
  parentId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  childId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },

  // level info
  level: { type: Number, required: true, default: 1 }, // level number in parent's tree
  side: { type: String, enum: ['left', 'right'], required: true },

  // track tiers
  tier: { type: Number, default: 1 }, // Tier number (1..N)

  // carry-over tracking
  carryOver: { type: Number, default: 0 }, // if one side overflows, store extra users here

  // status tracking
  completed: { type: Boolean, default: false }, // whether this edge completed its role in leveling

  createdAt: { type: Date, default: Date.now }
});

// 🔑 Indexes for faster tree queries
ReferralEdgeSchema.index({ parentId: 1, level: 1, side: 1, createdAt: 1 });
ReferralEdgeSchema.index({ childId: 1 });
ReferralEdgeSchema.index({ parentId: 1, childId: 1 }, { unique: true });

module.exports = mongoose.model("ReferralEdge", ReferralEdgeSchema, "ReferralEdges");
