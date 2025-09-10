const ReferralEdge = require("../../models/userModels/userRefferalModels/refferalEdgeModle");
const User = require("../../models/userModels/userModel");
const mongoose=require('mongoose');

async function buildReferralTree(userId) {
    console.log(userId)
  // Fetch user details
  const user = await User.findById(userId, "userName email referralCode");
  if (!user) return null;

  // Fetch direct children (edges where this user is parent)
  const edges = await ReferralEdge.find({ parentId: userId }).populate(
    "childId",
    "userName email referralCode"
  );

  // Separate left and right children
  const leftChild = edges.find((e) => e.side === "left");
  const rightChild = edges.find((e) => e.side === "right");

  return {
    user,
    left: leftChild ? await buildReferralTree(leftChild.childId._id) : null,
    right: rightChild ? await buildReferralTree(rightChild.childId._id) : null,
  };
}

// Get left referrals for a user
exports.getLeftReferrals = async (req, res) => {
    console.log("woking")
  try {
    const  userId  = req.body.userId;
    console.log(userId)

    const edges = await ReferralEdge.find({ parentId: userId, side: "left" })
    //   .populate("childId", "userName email referralCode") // populate child user details
    //   .sort({ createdAt: 1 }); // oldest first
 console.log(edges)
    return res.status(200).json({
      count: edges.length,
      referrals: edges.map(edge => ({
        childId: edge.childId._id,
        userName: edge.childId.userName,
        email: edge.childId.email,
        referralCode: edge.childId.referralCode,
        level: edge.level,
        joinedAt: edge.createdAt
      }))
    });
  } catch (err) {
    console.error("Error fetching left referrals:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

// Get right referrals for a user
exports.getRightReferrals = async (req, res) => {
  try {
    const { userId } = req.body;

    const edges = await ReferralEdge.find({ parentId: userId, side: "right" })
      .populate("childId", "userName email referralCode")
      .sort({ createdAt: 1 });

    return res.status(200).json({
      count: edges.length,
      referrals: edges.map(edge => ({
        childId: edge.childId._id,
        userName: edge.childId.userName,
        email: edge.childId.email,
        referralCode: edge.childId.referralCode,
        level: edge.level,
        joinedAt: edge.createdAt
      }))
    });
  } catch (err) {
    console.error("Error fetching right referrals:", err);
    return res.status(500).json({ message: "Server error" });
  }
};



exports.getUserReferralTree = async (req, res) => {
  try {
    const { userId } = req.body;

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ success: false, message: "Invalid userId" });
    }

    const tree = await buildReferralTree(userId);

    if (!tree) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    return res.status(200).json({ success: true, tree });
  } catch (err) {
    console.error("Error in getUserReferralTree:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};
