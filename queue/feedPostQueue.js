const Queue = require("bull");
const Feed = require("../models/feedModel");
const redisConfig = require("../Config/redisConfig");

// Ensure correct Redis options for Bull
const feedQueue = new Queue("feed-posts", {
  redis: {
    host: process.env.REDIS_HOST || "127.0.0.1",
    port: process.env.REDIS_PORT || 6379,
    url: process.env.REDIS_URL, // Render uses this
  },
});

feedQueue.process(async (job) => {
  console.log("🔹 Processing feed-posts job...", job.id);

  const now = new Date();
  const feedsToPost = await Feed.find({
    scheduledAt: { $lte: now },
    isPosted: false,
  });

  for (const feed of feedsToPost) {
    console.log("Posting feed:", feed.title);
    feed.isPosted = true;
    await feed.save();
  }

  console.log("✅ Feed-posts job done");
});

feedQueue.on("completed", (job) => console.log(`✅ Job ${job.id} completed`));
feedQueue.on("failed", (job, err) => console.error(`❌ Job ${job.id} failed`, err));

module.exports = feedQueue;
