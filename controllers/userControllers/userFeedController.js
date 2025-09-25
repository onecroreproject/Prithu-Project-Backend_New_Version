
const Feed = require("../../models/feedModel");
const ImageView = require("../../models/userModels/MediaSchema/userImageViewsModel");
const ImageStats = require("../../models/userModels/MediaSchema/imageViewModel");
const VideoView =require("../../models/userModels/MediaSchema/userVideoViewModel");
const VideoStats =require("../../models/userModels/MediaSchema/videoViewStatusModel");








exports.userImageViewCount = async (req, res) => {
  try {
    const { feedId } = req.body;
    const userId = req.Id || req.body.userId;

    if (!userId || !feedId) {
      return res.status(400).json({ message: "userId and feedId are required" });
    }

    // 1️⃣ Check feed type
    const feed = await Feed.findById(feedId, "type");
    if (!feed || feed.type !== "image") {
      return; 
    }

    // 2️⃣ Check if this user has already viewed this feed
    const existing = await ImageView.findOne({
      userId,
      "views.imageId": feedId,
    });

    if (existing) {
      return; 
    }

    // 3️⃣ Push new feedId + timestamp into views array
    await ImageView.findOneAndUpdate(
      { userId },
      { $push: { views: { imageId: feedId, viewedAt: new Date() } } },
      { upsert: true }
    );

    // 4️⃣ Update aggregated stats
    await ImageStats.findOneAndUpdate(
      { imageId: feedId },
      {
        $inc: { totalViews: 1 },
        $set: { lastViewed: new Date() },
      },
      { upsert: true }
    );

    // 5️⃣ Minimal response
    return res.json({ message: "Image view recorded" });
  } catch (err) {
    console.error("❌ Error recording image view:", err);
    return res.status(500).json({ message: "Server error" });
  }
};




exports.userVideoViewCount = async (req, res) => {
  try {
    const { feedId, watchedSeconds } = req.body;
    const userId = req.Id || req.body.userId;

    if (!userId || !feedId || !watchedSeconds) {
      return res.status(400).json({ message: "userId, feedId, and watchedSeconds are required" });
    }

    // 1️⃣ Check feed type and duration
    const feed = await Feed.findById(feedId, "type duration");
    if (!feed) {
      return res.status(404).json({ message: "Feed not found" });
    }
    if (feed.type !== "video") {
      return res.status(400).json({ message: "Feed is not a video" });
    }

    // 2️⃣ Validate duration (90% rule)
    const minRequired = Math.floor(feed.duration * 0.9);
    if (watchedSeconds < minRequired) {
      return res.status(200).json({ message: "Not watched full video", watched: false });
    }

    // 3️⃣ Check if already recorded for this user + video
    const existing = await VideoView.findOne({
      userId,
      "views.videoId": feedId,
    });

    if (existing) {
      return res.json({ message: "Session already recorded", watched: true });
    }

    // 4️⃣ Push view + increment user's total duration (use feed.duration, not watchedSeconds)
    await VideoView.findOneAndUpdate(
      { userId },
      {
        $push: {
          views: {
            videoId: feedId,
            watchedSeconds,
            totalDuration: feed.duration, // ✅ store feed’s duration
            viewedAt: new Date(),
          },
        },
        $inc: { totalDuration: feed.duration }, // ✅ increment total by feed duration
      },
      { upsert: true }
    );

    // 5️⃣ Update video stats (also increment by feed.duration)
    await VideoStats.findOneAndUpdate(
      { videoId: feedId },
      {
        $inc: { totalViews: 1, totalDuration: feed.duration }, // ✅ add feed duration instead of watchedSeconds
        $set: { lastViewed: new Date() },
      },
      { upsert: true }
    );

    // 6️⃣ Success response
    return res.json({
      message: "Video view recorded",
      watched: true,
      durationCounted: feed.duration,
    });
  } catch (err) {
    console.error("❌ Error recording video view:", err);
    return res.status(500).json({ message: "Server error" });
  }
};



