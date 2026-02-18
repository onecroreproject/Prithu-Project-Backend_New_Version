const Feed = require('../../models/feedModel');
const mongoose = require("mongoose");
const { getMediaUrl } = require("../../utils/storageEngine");

/**
 * Get feeds for public landing page (unauthenticated)
 */
exports.getAllPublicFeeds = async (req, res) => {
    try {
        const page = Math.max(1, Number(req.query.page || 1));
        const limit = Math.max(1, Math.min(50, Number(req.query.limit || 10)));
        const { categoryId, postType } = req.query;

        const matchStage = {
            isApproved: true,
            isDeleted: false,
            status: { $in: ["Published", "published"] },
            isScheduled: { $ne: true },
            audience: "public" // 🔒 Only public-intent posts
        };

        if (categoryId) {
            matchStage.category = new mongoose.Types.ObjectId(categoryId);
        }

        if (postType) {
            if (postType === 'image') {
                matchStage.postType = { $in: ['image', 'image+audio'] };
            } else {
                matchStage.postType = postType;
            }
        }

        const feeds = await Feed.aggregate([
            { $match: matchStage },

            // Basic lookup for creator info
            { $addFields: { effectiveCreatorId: { $ifNull: ["$postedBy.userId", "$createdByAccount"] } } },
            {
                $lookup: {
                    from: "ProfileSettings",
                    let: { creatorId: "$effectiveCreatorId", role: "$roleRef" },
                    pipeline: [
                        {
                            $match: {
                                $expr: {
                                    $or: [
                                        { $and: [{ $eq: ["$$role", "Admin"] }, { $eq: ["$adminId", "$$creatorId"] }] },
                                        { $and: [{ $eq: ["$$role", "Child_Admin"] }, { $eq: ["$childAdminId", "$$creatorId"] }] },
                                        { $and: [{ $eq: ["$$role", "User"] }, { $eq: ["$userId", "$$creatorId"] }] }
                                    ]
                                }
                            }
                        },
                        { $project: { name: 1, userName: 1, profileAvatar: 1, modifyAvatar: 1, privacy: 1, visibility: 1 } }
                    ],
                    as: "creatorProfile"
                }
            },
            { $unwind: { path: "$creatorProfile", preserveNullAndEmptyArrays: true } },

            // 🔒 Join with ProfileVisibility for detailed field-level privacy
            {
                $lookup: {
                    from: "ProfileVisibility",
                    localField: "creatorProfile.visibility",
                    foreignField: "_id",
                    as: "fieldVisibility"
                }
            },
            { $unwind: { path: "$fieldVisibility", preserveNullAndEmptyArrays: true } },

            // 🔒 Privacy Guard: If account is private, omit their content from public landing
            {
                $match: {
                    $or: [
                        { "creatorProfile.privacy": { $exists: false } },
                        { "creatorProfile.privacy": "public" },
                        { roleRef: { $in: ["Admin", "Child_Admin"] } } // Admins/ChildAdmins are always public for landing
                    ]
                }
            },

            { $sort: { createdAt: -1 } },
            { $skip: (page - 1) * limit },
            { $limit: limit },

            {
                $addFields: {
                    creatorData: {
                        userName: { $ifNull: ["$creatorProfile.userName", "unknown"] },
                        name: { $ifNull: ["$creatorProfile.name", "User"] },
                        avatar: {
                            $cond: {
                                if: { $eq: ["$fieldVisibility.profileAvatar", "private"] },
                                then: "https://via.placeholder.com/150", // Mask if private
                                else: {
                                    $ifNull: [
                                        "$creatorProfile.modifyAvatar",
                                        "$creatorProfile.profileAvatar",
                                        "https://via.placeholder.com/150"
                                    ]
                                }
                            }
                        }
                    }
                }
            },
            {
                $project: {
                    _id: 1,
                    postType: 1,
                    mediaUrl: 1,
                    caption: 1,
                    creatorData: 1,
                    category: 1,
                    createdAt: 1
                }
            }
        ]);

        const enrichedFeeds = feeds.map(feed => ({
            ...feed,
            feedId: feed._id,
            mediaUrl: getMediaUrl(feed.mediaUrl),
            creatorData: {
                ...feed.creatorData,
                avatar: getMediaUrl(feed.creatorData.avatar)
            }
        }));

        res.status(200).json({
            success: true,
            data: {
                feeds: enrichedFeeds,
                pagination: {
                    page,
                    limit,
                    total: await Feed.countDocuments(matchStage)
                }
            }
        });
    } catch (err) {
        console.error("❌ Public Feed Error:", err.message);
        res.status(500).json({ success: false, message: "Server error" });
    }
};
