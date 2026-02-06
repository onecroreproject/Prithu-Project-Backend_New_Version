const ReferralCycle = require("../../models/userModels/userRefferalModels/referralCycle");
const User = require("../../models/userModels/userModel");
const ProfileSettings = require("../../models/profileSettingModel");
const { getOrCreateActiveCycle } = require("../../services/referralCycleService");

/**
 * Fetch all referral cycles for a user (Active and Past)
 */
exports.getReferralCycles = async (req, res) => {
    try {
        const userId = req.Id;

        // Proactively expire old cycles and ensure an active one exists
        await getOrCreateActiveCycle(userId);

        const cycles = await ReferralCycle.find({ userId })
            .sort({ endDate: -1 })
            .lean();

        return res.status(200).json({
            success: true,
            data: cycles
        });
    } catch (error) {
        console.error("Error fetching referral cycles:", error);
        return res.status(500).json({ message: "Server error", error: error.message });
    }
};

/**
 * Fetch detailed referral user list for a specific cycle
 */
exports.getCycleDetails = async (req, res) => {
    try {
        const userId = req.Id;
        const { cycleId } = req.params;

        const cycle = await ReferralCycle.findOne({ _id: cycleId, userId }).lean();
        if (!cycle) {
            return res.status(404).json({ success: false, message: "Cycle not found" });
        }

        // Fetch user details for each referral in the cycle
        const referrals = await User.find({ _id: { $in: cycle.referralIds } })
            .select("userName email createdAt")
            .lean();

        // Fetch profile settings for phone numbers
        const profileSettings = await ProfileSettings.find({ userId: { $in: cycle.referralIds } })
            .select("userId phoneNumber name")
            .lean();

        const result = referrals.map(ref => {
            const profile = profileSettings.find(p => p.userId.toString() === ref._id.toString());
            return {
                _id: ref._id,
                userName: profile?.name || ref.userName,
                mobileNumber: profile?.phoneNumber || "N/A",
                email: ref.email,
                referralDate: ref.createdAt
            };
        });

        return res.status(200).json({
            success: true,
            data: result
        });
    } catch (error) {
        console.error("Error fetching cycle details:", error);
        return res.status(500).json({ message: "Server error", error: error.message });
    }
};
