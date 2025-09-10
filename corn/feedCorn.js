const cron = require("node-cron");
const Feed = require("../models/feedModel");

// Check every minute for feeds to post
exports.scheduleFeedPosts = () => {
  cron.schedule("* * * * *", async () => {
    const now = new Date();
    const feedsToPost = await Feed.find({ scheduledAt: { $lte: now }, isPosted: false });

    feedsToPost.forEach(async (feed) => {
      console.log("Posting feed:", feed.title); // replace with real posting logic

      feed.isPosted = true;
      await feed.save();
    });
  });
};


