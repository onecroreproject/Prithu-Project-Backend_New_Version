const Follower=require('../../models/followerModel')
const Account=require('../../models/accountSchemaModel')

exports.toggleFollowCreator = async (req, res) => {
  try {
    const creatorAccountId = req.body.accountId;
    const userId=req.Id || req.body.userId;
    if (!userId || !creatorAccountId) {
      return res.status(400).json({ message: "userId and creatorAccountId are required" });
    }

    //  Ensure creatorAccountId is a valid creator account
    const creatorAccount = await Account.findById(creatorAccountId).select("type");
    if (!creatorAccount || creatorAccount.type !== "Creator") {
      return res.status(400).json({ message: "Invalid Creator account" });
    }

    //  Find if user already follows this creator
    let followDoc = await Follower.findOne({ userId, creatorAccountId });

    if (!followDoc) {
      //  First time follow
      followDoc = new Follower({ userId, creatorAccountId, isFollow: true });
      await followDoc.save();
      return res.status(200).json({ message: "Followed successfully", isFollow: true });
    } else {
      //  Toggle isFollow
      followDoc.isFollow = !followDoc.isFollow;
      await followDoc.save();

      const action = followDoc.isFollow ? "Followed" : "Unfollowed";
      return res.status(200).json({ message: `${action} successfully`, isFollow: followDoc.isFollow });
    }
  } catch (error) {
    console.error("Error toggling follow:", error);
    return res.status(500).json({ message: "Server error", error: error.message });
  }
};