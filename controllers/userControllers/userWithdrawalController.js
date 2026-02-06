const mongoose = require("mongoose");
const Withdrawal = require("../../models/userModels/userRefferalModels/withdrawal");
const UserBankDetails = require("../../models/userModels/userRefferalModels/userBankDetails");
const ProfileSettings = require("../../models/profileSettingModel");
const UserEarning = require("../../models/userModels/userRefferalModels/referralEarnings");
const ReferralCycle = require("../../models/userModels/userRefferalModels/referralCycle");

// 1. Get User Bank Details
exports.getBankDetails = async (req, res) => {
    try {
        const userId = req.Id;
        const bankDetails = await UserBankDetails.findOne({ userId });
        return res.status(200).json({
            success: true,
            data: bankDetails
        });
    } catch (error) {
        console.error("Error getting bank details:", error);
        return res.status(500).json({ message: "Server error", error: error.message });
    }
};

// 2. Save/Update User Bank Details & Sync Profile
exports.saveBankDetails = async (req, res) => {
    try {
        const userId = req.Id;
        const {
            accountHolderName,
            mobileNumber,
            ifscCode,
            bankName,
            branch,
            bankAddress,
            accountNumber,
            accountType
        } = req.body;

        // Update or create bank details
        const bankDetails = await UserBankDetails.findOneAndUpdate(
            { userId },
            {
                accountHolderName,
                mobileNumber,
                ifscCode,
                bankName,
                branch,
                bankAddress,
                accountNumber,
                accountType
            },
            { new: true, upsert: true }
        );

        // Sync Profile Settings
        await ProfileSettings.findOneAndUpdate(
            { userId },
            {
                $set: {
                    name: accountHolderName,
                    phoneNumber: mobileNumber
                }
            }
        );

        return res.status(200).json({
            success: true,
            message: "Bank details saved and profile updated",
            data: bankDetails
        });
    } catch (error) {
        console.error("Error saving bank details:", error);
        return res.status(500).json({ message: "Server error", error: error.message });
    }
};

// 3. Request Withdrawal (Full Amount - Cycle Based)
exports.requestWithdrawal = async (req, res) => {
    const session = await prithuDB.startSession();
    session.startTransaction();
    try {
        const userId = req.Id;

        // 1. Check for existing pending requests (Idempotency)
        const pendingRequest = await Withdrawal.findOne({ userId, status: "pending" }).session(session);
        if (pendingRequest) {
            await session.abortTransaction();
            session.endSession();
            return res.status(400).json({
                success: false,
                message: "You already have a pending withdrawal request."
            });
        }

        // 2. Find completed cycles that haven't been withdrawn
        const completedCycles = await ReferralCycle.find({
            userId,
            status: "completed"
        }).session(session);

        if (completedCycles.length === 0) {
            await session.abortTransaction();
            session.endSession();
            return res.status(400).json({
                success: false,
                message: "No completed referral cycles available for withdrawal. You need 25 referrals within a 30-day cycle."
            });
        }

        const totalToWithdraw = completedCycles.reduce((sum, cycle) => sum + cycle.earnedAmount, 0);

        if (totalToWithdraw <= 0) {
            await session.abortTransaction();
            session.endSession();
            return res.status(400).json({
                success: false,
                message: "No earnings available for withdrawal in completed cycles."
            });
        }

        // 3. Get Bank Details for Snapshot
        const bankDetails = await UserBankDetails.findOne({ userId }).session(session);
        if (!bankDetails) {
            await session.abortTransaction();
            session.endSession();
            return res.status(400).json({
                success: false,
                message: "Please save your bank details before requesting withdrawal."
            });
        }

        // 4. Create Withdrawal Record
        const { notes } = req.body;
        const newWithdrawal = new Withdrawal({
            userId,
            amount: totalToWithdraw,
            withdrawalAmount: totalToWithdraw,
            totalAmount: totalToWithdraw, // In new system, we track per cycle withdrawal
            bankDetails: bankDetails.toObject(),
            cycleIds: completedCycles.map(c => c._id),
            notes: notes || "",
            status: "pending"
        });

        await newWithdrawal.save({ session });

        // 5. Mark cycles as withdrawn and reset user balance
        await ReferralCycle.updateMany(
            { _id: { $in: completedCycles.map(c => c._id) } },
            { $set: { status: "withdrawn" } },
            { session }
        );

        // Reset user balance earnings (Subtract only what was withdrawn)
        const user = await User.findById(userId).session(session);
        const newBalance = Math.max(0, (user.balanceEarnings || 0) - totalToWithdraw);
        const newWithdrawn = (user.withdrawnEarnings || 0) + totalToWithdraw;

        await User.updateOne(
            { _id: userId },
            { $set: { balanceEarnings: newBalance, withdrawnEarnings: newWithdrawn } },
            { session }
        );

        await session.commitTransaction();
        session.endSession();

        return res.status(200).json({
            success: true,
            message: "Withdrawal request submitted successfully",
            data: newWithdrawal
        });

    } catch (error) {
        await session.abortTransaction();
        session.endSession();
        console.error("Error requesting withdrawal:", error);
        return res.status(500).json({ message: "Server error", error: error.message });
    }
};

// 7️⃣ Get Withdrawal Details & Invoice
exports.getWithdrawalHistory = async (req, res) => {
    try {
        const userId = req.Id;

        const history = await Withdrawal.find({ userId })
            .sort({ requestedAt: -1 })
            .lean();

        const result = history.map(item => {
            // Simulate downloadable invoice URL
            const invoiceUrl = `https://your-domain.com/api/v1/invoices/download/${item._id}.pdf`;

            return {
                _id: item._id,
                amount: item.amount,
                withdrawalAmount: item.withdrawalAmount,
                status: item.status,
                requestedAt: item.requestedAt,
                processedAt: item.processedAt,
                bankDetails: item.bankDetails,
                notes: item.notes,
                invoiceUrl: (item.status === "completed" || item.status === "paid") ? invoiceUrl : null
            };
        });

        return res.status(200).json({
            success: true,
            data: result
        });
    } catch (error) {
        console.error("Error getting withdrawal history:", error);
        return res.status(500).json({ message: "Server error", error: error.message });
    }
};

// 8. Update Withdrawal Request (Pending Only)
exports.updateWithdrawalRequest = async (req, res) => {
    try {
        const userId = req.Id;
        const { requestId } = req.params;
        const { notes, bankDetails } = req.body;

        const withdrawal = await Withdrawal.findOne({ _id: requestId, userId });
        if (!withdrawal) {
            return res.status(404).json({ success: false, message: "Withdrawal request not found" });
        }

        if (withdrawal.status !== "pending") {
            return res.status(400).json({
                success: false,
                message: "Only pending requests can be modified."
            });
        }

        // Update fields if provided
        if (notes !== undefined) withdrawal.notes = notes;
        if (bankDetails) {
            withdrawal.bankDetails = {
                ...withdrawal.bankDetails,
                ...bankDetails
            };
        }

        await withdrawal.save();

        return res.status(200).json({
            success: true,
            message: "Withdrawal request updated successfully",
            data: withdrawal
        });
    } catch (error) {
        console.error("Error updating withdrawal request:", error);
        return res.status(500).json({ message: "Server error", error: error.message });
    }
};
