const mongoose = require('mongoose');

const businessUserSchema = new mongoose.Schema({
  // Basic bussiness Information
  userName: {
    type: String,
    required: true,
    unique: true,
    minlength: 3,
    maxlength: 30,
  },
  businessEmail: { 
    type: String, 
    required: true, 
    unique: true, 
    lowercase: true 
  },

  businessPasswordHash:{type:String,
    unique:true,
    required:true
  },
  // OTP Verifiction
   otpCode: { type: String },
  otpExpiresAt: { type: Date },
  
  // bussiness Profile
 profileSettings:{ type: mongoose.Schema.Types.ObjectId, ref: "ProfilesSettings" },



  // Creator verification status
  isVerified: {
    type: Boolean,
    default: false
  },
  
  // Account status
  isActive: {
    type: Boolean,
    default: true
  },

  //Term and Condition 
  termsAccepted: {
    type: Boolean,
    required: true,
    default: false,
  },
  termsAcceptedAt: {
    type: Date,
  },
  
  // Timestamps
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Update the updatedAt timestamp before saving
businessUserSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

module.exports=mongoose.model('BusinessUsers',businessUserSchema,'BusinessUsers')

