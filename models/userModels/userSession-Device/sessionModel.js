const mongoose = require("mongoose");

const SessionSchema = new mongoose.Schema({
  userId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: "User", 
    required: true 
  },

  role:{type:String ,required:true},

  deviceId: { type: String,required: true},
    
    refreshToken: { type: String, required: true },

  isOnline: { type: Boolean, default: false },
  lastSeenAt: { type: Date, default: null },

  createdAt: { type: Date, default: Date.now },
  expiresAt: { type: Date } // optional (auto-expire session if needed)
});

// Index for auto-expiry (if refreshToken has TTL)
SessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports =  mongoose.models.Session || mongoose.model("Session", SessionSchema,"Session");
