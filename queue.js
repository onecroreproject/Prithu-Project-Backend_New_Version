const Queue = require("bull");

const redisOptions = {
  host: process.env.REDIS_HOST || "127.0.0.1",
  port: process.env.REDIS_PORT || 6379,
  retryStrategy: (times) => Math.min(times * 50, 2000),
};

const myQueue = new Queue("myQueue", { redis: redisOptions });

myQueue.on("error", (err) => console.error("Bull Queue Error:", err));

module.exports = myQueue;
