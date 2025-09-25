const mongoose =require("mongoose");

const subscriptionPlanSchema = new mongoose.Schema({
  name: { type: String, required: true }, 
  price: { type: Number, required: true },
  durationDays: { type: Number, required: true },
  
  limits: {
    downloadLimit: { type: Number, default: 0 },
    adFree: { type: Boolean, default: false },
    deviceLimit: { type: Number, default: 1 },
  },

  description: { type: String },       // For UI display
  planType: {                          // Categorize plans
    type: String,
    enum: ["trial", "basic", "premium"], // Allowed values
    default: "basic"
  },

  isActive: { type: Boolean, default: true },

  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

module.exports=mongoose.model("SubscriptionPlan", subscriptionPlanSchema,"SubscriptionPlan");
// module.exports= mongoose.models.SubscriptionPlan || mongoose.model("SubscriptionPlan", subscriptionPlanSchema,"SubscriptionPlan");




