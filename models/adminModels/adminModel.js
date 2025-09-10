const mongoose = require('mongoose');

const adminSchema = new mongoose.Schema({
  userName: {
    type: String,
    required: true,
    unique: true,
    minlength: 3,
    maxlength: 30,
    trim: true
  },
  email: { 
    type: String, 
    required: true, 
    unique: true, 
    lowercase: true,
    trim: true
  },
  passwordHash: { 
    type: String, 
    required: true 
  },
  
  // Admin-specific fields
  adminType: {
    type: String,
    enum: ['ChildAdmin', 'Admin', 'Moderator'],
    default: 'Admin'
  },
  permissions: {
    canManageUsers: { type: Boolean, default: false },
    canManageCreators: { type: Boolean, default: false },
    canManageBusinesses: { type: Boolean, default: false },
    canManageFeeds: { type: Boolean, default: false },
    canManageCategories: { type: Boolean, default: false },
    canManageReports: { type: Boolean, default: false },
    canManageSettings: { type: Boolean, default: false },
    canViewAnalytics: { type: Boolean, default: false }
  },

  // Profile information
  profileSettings:{ type: mongoose.Schema.Types.ObjectId, ref: "ProfileSettings" },

  // Status tracking
  isActive: { type: Boolean, default: true },
  isEmailVerified: { type: Boolean, default: false },
  lastLoginAt: { type: Date },
  
  // Security fields
  loginAttempts: { type: Number, default: 0 },
  lockUntil: { type: Date },
  
  // OTP for password reset
  otpCode: { type: String },
  otpExpiresAt: { type: Date },

  // Audit fields
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Admin',
    default: null
  },
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Admin',
    default: null
  },

  feeds: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Feed'
    }],

}, { 
  timestamps: true,
  toJSON: { 
    transform: function(doc, ret) {
      delete ret.passwordHash;
      delete ret.otpCode;
      delete ret.otpExpiresAt;
      return ret;
    }
  }
});

// Virtual for full name
adminSchema.virtual('fullName').get(function() {
  return `${this.profile.firstName || ''} ${this.profile.lastName || ''}`.trim();
});

// Check if account is locked
adminSchema.virtual('isLocked').get(function() {
  return !!(this.lockUntil && this.lockUntil > Date.now());
}, { timestamps: true });




// Index for performance
adminSchema.index({ adminType: 1 });
adminSchema.index({ isActive: 1 });

module.exports = mongoose.model('Admin', adminSchema, 'Admin');
