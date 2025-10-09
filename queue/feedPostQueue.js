const Queue = require("bull");
const Feed = require("../models/feedModel");

const redisConfig = {
  host: process.env.REDIS_HOST,
  port: process.env.REDIS_PORT
};

const feedQueue = new Queue("feed-posts", { redis: redisConfig });

// Queue Processor
feedQueue.process(async (job) => {
  console.log("🔹 Processing feed-posts job...");
  const now = new Date();
  const feedsToPost = await Feed.find({ scheduledAt: { $lte: now }, isPosted: false });

  for (const feed of feedsToPost) {
    console.log("Posting feed:", feed.title);
    feed.isPosted = true;
    await feed.save();
  }

  console.log("✅ Feed-posts job done");
});

// Optional logging
feedQueue.on("completed", job => console.log(`✅ Job ${job.id} completed`));
feedQueue.on("failed", (job, err) => console.error(`❌ Job ${job.id} failed:`, err));

module.exports = feedQueue;
