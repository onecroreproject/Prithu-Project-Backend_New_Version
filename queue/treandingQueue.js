const Queue = require("bull");
const computeTrendingCreators = require("../middlewares/computeTreandingCreators");

const redisConfig = {
  host: process.env.REDIS_HOST || "127.0.0.1",
  port: process.env.REDIS_PORT || 6379,
};

const trendingQueue = new Queue("trending-creators", { redis: redisConfig });

trendingQueue.process(async () => {
  console.log("🔹 Processing trending creators job...");
  await computeTrendingCreators();
  console.log("✅ Trending creators job finished");
});

module.exports = trendingQueue;
