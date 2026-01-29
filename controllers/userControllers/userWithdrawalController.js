const mongoose = require("mongoose");
const Withdrawal = require("../../models/userModels/userRefferalModels/withdrawal");

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
                invoiceId: item._id, // Using withdrawal ID as placeholder for Invoice ID
                invoiceUrl: item.status === "completed" ? invoiceUrl : null
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
