// backend/redis/clients.js
const { createClient } = require("redis");
const { createAdapter } = require("@socket.io/redis-adapter");

exports.createRedisAdapter = async (io) => {
  const pubClient = createClient({ url: process.env.REDIS_URL });
  const subClient = pubClient.duplicate();
  await pubClient.connect();
  await subClient.connect();

  io.adapter(createAdapter(pubClient, subClient));

  // app client for presence operations
  const appClient = createClient({ url: process.env.REDIS_URL });
  await appClient.connect();
  return { pubClient, subClient, appClient };
};
