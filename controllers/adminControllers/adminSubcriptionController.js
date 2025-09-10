const SubscriptionPlan= require ("../../models/subcriptionModels/subscriptionPlanModel.js");


exports.createPlan = async (req, res) => {
  try {
    const { name, price, durationDays, limits, description, planType, isActive } = req.body;
    console.log({ name, price, durationDays, limits, description, planType, isActive });

    // Basic validation
if(isActive !== undefined && typeof isActive !== 'boolean') {
      return res.status(400).json({ message: "isActive must be a boolean" });
    }

if (planType && typeof planType !== 'string') {
      return res.status(400).json({ message: "PlanType must be a string" });
    }

if (description && typeof description !== 'string') {
      return res.status(400).json({ message: "Description must be a string" });
    }

    if (limits && typeof limits !== 'object') {
      return res.status(400).json({ message: "Limits must be an object" });
    }

    if (!name || durationDays === undefined) {
      return res.status(400).json({ message: "Name and durationDays are required" });
    }

    if (price === undefined || price === null) {
      return res.status(400).json({ message: "Price is required (can be 0 for trial)" });
    }

    // Validate planType (default: "basic")
    const allowedTypes = ["trial", "basic", "premium"];
    if (planType && !allowedTypes.includes(planType)) {
      return res.status(400).json({ message: `Invalid planType. Allowed: ${allowedTypes.join(", ")}` });
    }

    // Create subscription plan
    const plan = await SubscriptionPlan.create({
      name,
      price,
      durationDays,
      limits: {
        downloadLimit: limits?.downloadLimit || 0,
        adFree: limits?.adFree || false,
        deviceLimit: limits?.deviceLimit || 1,
      },
      description: description || "",
      planType: planType || "basic",
      isActive: isActive !== undefined ? isActive : true,
    });

    res.status(201).json({ message: "Subscription plan created successfully", plan });
  } catch (error) {
    console.error("Error creating plan:", error);
    res.status(500).json({ message: "Server error while creating plan" });
  }
};






exports.updatePlan = async (req, res) => {
  try {
    const { planId } = req.params;
    if (!planId) {
      return res.status(400).json({ message: "Plan ID is required" });
    }

    // ✅ Allowed fields from schema
    const allowedFields = [
      "name",
      "price",
      "durationDays",
      "limits",
      "description",
      "planType",
      "isActive"
    ];

    const updates = {};

    // Pick only allowed fields
    allowedFields.forEach((field) => {
      if (req.body[field] !== undefined) {
        updates[field] = req.body[field];
      }
    });

    // Always update timestamp
    updates.updatedAt = new Date();

    if (Object.keys(updates).length === 1 && updates.updatedAt) {
      return res.status(400).json({ message: "No valid fields to update" });
    }

    const plan = await SubscriptionPlan.findByIdAndUpdate(planId, updates, {
      new: true,
      runValidators: true,
    });

    if (!plan) {
      return res.status(404).json({ message: "Plan not found" });
    }

    res.status(200).json({ message: "Plan updated", plan });
  } catch (error) {
    console.error("Error updating plan:", error);
    res.status(500).json({ message: "Server error" });
  }
};



exports.deletePlan = async (req, res) => {
  const { planId } = req.params;
  if (!planId) {
    return res.status(400).json({ message: "Plan ID is required" });
  }
  await SubscriptionPlan.findByIdAndDelete(planId);
  res.status(200).json({ message: "Plan deleted" });
};


exports.getAllPlans = async (req, res) => {
  try {
    const plans = await SubscriptionPlan.find();
    if (!plans || plans.length === 0) {
      return res.status(404).json({ message: "No plans found" });
    }
console.log(plans.durationDays);

    // Convert duration from days to years
    const plansWithYears = plans.map(plan => {
      return {
        ...plan._doc, // spread existing plan fields
        durationYears: (plan.durationDays/ 365).toFixed(), // approximate years
      };
    });

    res.status(200).json({ plans: plansWithYears });
  } catch (error) {
    console.error("Error fetching plans:", error);
    res.status(500).json({ message: "Server error" });
  }
};

