const Redis = require("ioredis");

// Use REDIS_URL if available (Render style), else fallback to local setup
const redis = new Redis(process.env.REDIS_URL || {
  host: process.env.REDIS_HOST || "127.0.0.1",
  port: process.env.REDIS_PORT || 6379,
  retryStrategy: (times) => Math.min(times * 50, 2000),
});

module.exports = redis;
