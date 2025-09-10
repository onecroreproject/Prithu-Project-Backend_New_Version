const { createClient } = require("redis");

exports.initRedis=async() =>{
  const redisClient = createClient({ url: process.env.REDIS_URL });
  await redisClient.connect();
  return redisClient;
}


