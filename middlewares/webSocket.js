const { Server } = require("socket.io");
const User = require("../models/userModels/userModel");
const { createRedisAdapter } = require("../radisClient/radisClient");
const {makePresenceService} = require("../services/presenseService");

let io;
let presenceService;
let redisAppClient;

exports.initSocket = async (httpServer) => {
  io = new Server(httpServer, {
    cors: {
      origin: process.env.CORS_ORIGIN?.split(",") || ["http://localhost:3000"],
      credentials: true,
    },
  });

  // Init Redis adapter + app client INSIDE initSocket
  const { appClient } = await createRedisAdapter(io);
  redisAppClient = appClient;

  // Presence service
  presenceService = makePresenceService(redisAppClient, User, io);

  // Middleware for authenticating sockets using sessionId
  io.use(async (socket, next) => {
    try {
      const sessionId = socket.handshake.auth?.sessionId;
      if (!sessionId) {
        return next(new Error("No sessionId provided"));
      }
      const user = await User.findOne({ activeSession: sessionId });
      if (!user) {
        return next(new Error("Invalid session"));
      }

      socket.userId = user._id.toString();
      socket.role = user.role;

      // Join user personal room
      socket.join(`user:${socket.userId}`);
      next();
    } catch (error) {
      console.error("Socket auth error:", error);
      next(new Error("Authentication error"));
    }
  });

  io.on("connection", async (socket) => {
    const userId = socket.userId;

    // Extract device info from client handshake
    const deviceInfo = {
      deviceId: socket.handshake.auth.deviceId || socket.id,
      deviceName: socket.handshake.auth.deviceName || "Unknown Device",
      os: socket.handshake.auth.os || "Unknown OS",
      browser: socket.handshake.auth.browser || "Unknown Browser",
      ip: socket.handshake.address || "Unknown IP",
    };

    // Add socket to presence with device info
    await presenceService.addSocket(userId, socket.id, deviceInfo).catch(console.error);

    // If admin, join admins room
    if (socket.role === "admin") socket.join("admins");

    // Heartbeat to update lastSeen
    socket.on("heartbeat", async () => {
      await redisAppClient.set(`lastseen:${userId}`, Date.now().toString()).catch(() => {});
      await User.findByIdAndUpdate(userId, { lastSeenAt: new Date() }).catch(() => {});
      io.to("admins").emit("user:heartbeat", { userId, lastSeenAt: new Date() });
    });

    // Go offline manually
    socket.on("go-offline", async () => {
      await presenceService.removeSocket(userId, socket.id).catch(console.error);
      socket.disconnect(true);
    });

    // Disconnect event
    socket.on("disconnect", async () => {
      await presenceService.removeSocket(userId, socket.id).catch(console.error);
    });
  });
};

exports.socketIO = () => io;
