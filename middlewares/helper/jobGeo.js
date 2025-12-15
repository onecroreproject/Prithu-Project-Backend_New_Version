// redis/jobGeo.js
const redisClient = require("../../Config/redisConfig");

/**
 * Redis GEO key for job locations
 * Each member = jobId
 * Coordinates = [longitude, latitude]
 */
const GEO_KEY = "jobs:geo";

/**
 * ✅ Add or update job location in Redis GEO
 * @param {String|ObjectId} jobId
 * @param {Array} coordinates [lng, lat]
 */
async function upsertJobGeo(jobId, coordinates) {
  try {
    if (!jobId || !Array.isArray(coordinates) || coordinates.length !== 2) {
      return;
    }

    const [lng, lat] = coordinates;

    // Validate numeric values
    if (
      typeof lng !== "number" ||
      typeof lat !== "number" ||
      Number.isNaN(lng) ||
      Number.isNaN(lat)
    ) {
      return;
    }

    await redisClient.geoAdd(GEO_KEY, {
      longitude: lng,
      latitude: lat,
      member: jobId.toString(),
    });

  } catch (error) {
    console.error("❌ Redis GEO upsert error:", error);
  }
}

/**
 * ❌ Remove job from Redis GEO
 * @param {String|ObjectId} jobId
 */
async function removeJobGeo(jobId) {
  try {
    if (!jobId) return;

    await redisClient.zRem(GEO_KEY, jobId.toString());

  } catch (error) {
    console.error("❌ Redis GEO remove error:", error);
  }
}

module.exports = {
  upsertJobGeo,
  removeJobGeo,
};
