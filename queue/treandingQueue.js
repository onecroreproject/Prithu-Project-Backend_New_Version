const Queue = require("bull");
const computeTrendingCreators = require("../middlewares/computeTreandingCreators");
const redisConfig = require("../Config/redisConfig");

console.log(process.env.REDIS_URL)
const redisOptions = process.env.REDIS_URL
  ? process.env.REDIS_URL
  : {
      host: process.env.REDIS_HOST || "127.0.0.1",
      port: process.env.REDIS_PORT || 6379,
    };

const trendingQueue = new Queue("feed-posts", { redis: redisOptions });

trendingQueue.process(async (job) => { // <-- include job
  console.log("🔹 Processing trending creators job...", job.id);
  await computeTrendingCreators();
  console.log("✅ Trending creators job finished");
});

trendingQueue.on("completed", (job) => {
  console.log(`✅ Job completed: ${job.id}`);
});

trendingQueue.on("failed", (job, err) => {
  console.error(`❌ Job failed: ${job.id}`, err);
});

module.exports = trendingQueue;
