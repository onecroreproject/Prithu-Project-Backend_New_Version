module.exports = {
  host: process.env.REDIS_HOST || "be-backend",
  port: process.env.REDIS_PORT || 5000,
  retryStrategy: (times) => Math.min(times * 50, 2000),
};
