const Redis = require("ioredis");

// Replace with your Render Redis URL
const redis = new Redis("redis://red-d3l7ip1r0fns73f4g1eg:6379");

redis.on("connect", () => {
  console.log("✅ Connected to Redis successfully!");
});

redis.on("error", (err) => {
  console.error("❌ Redis connection error:", err);
});

// Test setting and getting a value
async function testRedis() {
  try {
    await redis.set("testKey", "Hello Render Redis!");
    const value = await redis.get("testKey");
    console.log("Value from Redis:", value);
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

testRedis();
