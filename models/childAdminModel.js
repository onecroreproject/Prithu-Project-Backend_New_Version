const mongoose = require('mongoose');

const childAdminSchema = new mongoose.Schema({

  // Inherit from Admin model

  childAdminId: { type: String, unique: true },
  
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
  
  // Child admin specific fields
  parentAdminId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Admin',
    required: true
  },
  
  childAdminType: {
    type: String,
    enum: ['Child_Admin', 'sub_admin', 'limited_admin'],
    default: 'Child_Admin'
  },
  
  // Permission inheritance from parent
  inheritedPermissions: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Admin',
    default: null
  },
  
  // Custom permissions (can be restricted by parent)
  customPermissions: {
    canManageUsers: { type: Boolean, default: false },
    canManageCreators: { type: Boolean, default: false },
    canManageBusinesses: { type: Boolean, default: false },
    canManageFeeds: { type: Boolean, default: false },
    canManageCategories: { type: Boolean, default: false },
    canManageReports: { type: Boolean, default: false },
    canManageSettings: { type: Boolean, default: false },
    canViewAnalytics: { type: Boolean, default: false },
    canManageChildAdmins: { type: Boolean, default: false } // Can this child admin create other child admins?
  },
  
  // Permission restrictions set by parent
  permissionRestrictions: {
    maxUsersToManage: { type: Number, default: 0 }, // 0 means unlimited
    maxCreatorsToManage: { type: Number, default: 0 },
    maxBusinessesToManage: { type: Number, default: 0 },
    restrictedActions: [{ type: String }], // List of restricted action types
    allowedActions: [{ type: String }], // Whitelist approach
    restrictedRoutes: [{ type: String }], // API routes this child cannot access
    timeRestrictions: {
      allowedStartTime: { type: String, default: '00:00' },
      allowedEndTime: { type: String, default: '23:59' },
      allowedDays: [{ type: String, enum: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'] }]
    }
  },
  
  // Access scope
  accessScope: {
    allowedUserIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }], // Specific users this child can manage
    allowedCreatorIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Creator' }], // Specific creators
    allowedBusinessIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Business' }], // Specific businesses
    allowedCategories: [{ type: String }], // Specific categories
    allowedLanguages: [{ type: String }] // Specific languages
  },
  
  // Profile information
  profile: {
    firstName: { type: String, trim: true },
    lastName: { type: String, trim: true },
    displayName: { type: String, trim: true },
    avatarUrl: { type: String, default: '' },
    phoneNumber: { type: String, trim: true }
  },

  // Status tracking
  isActive: { type: Boolean, default: true },
  isEmailVerified: { type: Boolean, default: false },
  isApprovedByParent: { type: Boolean, default: false }, // Parent admin approval
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
    required: true
  },
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Admin',
    default: null
  },
  
  // Activity tracking
  lastActivity: {
    type: Date,
    default: Date.now
  },
  totalActionsPerformed: {
    type: Number,
    default: 0
  },
  actionsLog: [{
    action: { type: String },
    performedAt: { type: Date, default: Date.now },
    targetId: { type: mongoose.Schema.Types.ObjectId },
    targetType: { type: String },
    details: { type: mongoose.Schema.Types.Mixed }
  }]

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
childAdminSchema.virtual('fullName').get(function() {
  return `${this.profile.firstName || ''} ${this.profile.lastName || ''}`.trim();
});

// Check if account is locked
childAdminSchema.virtual('isLocked').get(function() {
  return !!(this.lockUntil && this.lockUntil > Date.now());
});

// Check if child admin has permission for a specific action
childAdminSchema.methods.hasPermission = function(action, target = null) {
  // Check if approved by parent
  if (!this.isApprovedByParent) return false;
  
  // Check time restrictions
  if (this.permissionRestrictions.timeRestrictions) {
    const now = new Date();
    const currentTime = now.toTimeString().slice(0, 5);
    const currentDay = now.toLocaleLowerCase().split(',')[0];
    
    const { allowedStartTime, allowedEndTime, allowedDays } = this.permissionRestrictions.timeRestrictions;
    
    if (allowedDays.length > 0 && !allowedDays.includes(currentDay)) return false;
    
    if (currentTime < allowedStartTime || currentTime > allowedEndTime) return false;
  }
  
  // Check custom permissions
  if (this.customPermissions[action] === false) return false;
  
  // Check target-specific restrictions
  if (target && this.accessScope) {
    const { allowedUserIds, allowedCreatorIds, allowedBusinessIds } = this.accessScope;
    
    if (target.type === 'User' && allowedUserIds.length > 0 && !allowedUserIds.includes(target.id)) return false;
    if (target.type === 'Creator' && allowedCreatorIds.length > 0 && !allowedCreatorIds.includes(target.id)) return false;
    if (target.type === 'Business' && allowedBusinessIds.length > 0 && !allowedBusinessIds.includes(target.id)) return false;
  }
  
  return true;
};

// Index for performance
childAdminSchema.index({ email: 1 });
childAdminSchema.index({ username: 1 });
childAdminSchema.index({ parentAdminId: 1 });
childAdminSchema.index({ createdBy: 1 });
childAdminSchema.index({ isActive: 1 });
childAdminSchema.index({ isApprovedByParent: 1 });

module.exports = mongoose.model('ChildAdmin', childAdminSchema, 'ChildAdmin');
