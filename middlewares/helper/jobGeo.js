const redisClient = require("../../Config/redisConfig");

/**
 * Redis GEO key for job locations
 * Each member = jobId
 * Coordinates = [longitude, latitude]
 */
const GEO_KEY = "jobs:geo";

/**
 * ✅ Add or update job location in Redis GEO (ioredis)
 * @param {String|ObjectId} jobId
 * @param {Array} coordinates [lng, lat]
 */
async function upsertJobGeo(jobId, coordinates) {
  try {
    if (!jobId || !Array.isArray(coordinates) || coordinates.length !== 2) {
      return;
    }

    const [lng, lat] = coordinates;

    if (
      typeof lng !== "number" ||
      typeof lat !== "number" ||
      Number.isNaN(lng) ||
      Number.isNaN(lat)
    ) {
      return;
    }

    // ✅ ioredis GEOADD
    await redisClient.geoadd(
      GEO_KEY,
      lng,
      lat,
      jobId.toString()
    );

    console.log("✅ Redis GEO updated:", jobId.toString());
  } catch (error) {
    console.error("❌ Redis GEO upsert error:", error);
  }
}

/**
 * ❌ Remove job from Redis GEO (ioredis)
 * @param {String|ObjectId} jobId
 */
async function removeJobGeo(jobId) {
  try {
    if (!jobId) return;

    // ✅ ioredis ZREM
    await redisClient.zrem(
      GEO_KEY,
      jobId.toString()
    );

    console.log("🗑 Redis GEO removed:", jobId.toString());
  } catch (error) {
    console.error("❌ Redis GEO remove error:", error);
  }
}

module.exports = {
  upsertJobGeo,
  removeJobGeo,
};
