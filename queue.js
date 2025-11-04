const Queue = require("bull");
 
const redisOptions = process.env.REDIS_URL

  ? process.env.REDIS_URL

  : {

      host: process.env.REDIS_HOST || "127.0.0.1",

      port: process.env.REDIS_PORT || 6379,

      password: process.env.REDIS_PASSWORD || undefined, 

      retryStrategy: (times) => Math.min(times * 50, 2000),

    };
 
const createQueue = (name) => new Queue(name, { redis: redisOptions });
 
module.exports = createQueue;

 