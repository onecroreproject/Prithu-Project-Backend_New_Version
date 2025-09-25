const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const app = express();
const root =require ('./roots/root');
require('dotenv').config();
const cookieParser=require('cookie-parser');
const path = require ("path")
const {scheduleFeedPosts}=require('./corn/feedCorn');
const {startWatcher}=require('./middlewares/referralMiddleware/refferalCodeWatcher');

const allowedOrigins = process.env.CLIENT_URL?.split(",") || ["http://localhost:5173"];

app.use(
  cors({
    origin: function (origin, callback) {
      console.log("🔍 Incoming Origin:", origin); // log frontend origin
      if (!origin) return callback(null, true); 
      if (allowedOrigins.indexOf(origin) === -1) {
        return callback(new Error("CORS not allowed"), false);
      }
      return callback(null, true);
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

// Middleware
app.use(express.json());
app.use('/api',root);
app.use(cookieParser());



app.use("/uploads", express.static(path.join(__dirname, "uploads")));

scheduleFeedPosts();




startWatcher()

// Mongodb Server and Port ServerConnectiion
mongoose.connect(process.env.MONGODB_URI, {
}).then(() => {
  app.listen(process.env.SERVER_PORT, () => {
  console.log(`Server running on port ${process.env.SERVER_PORT}`);
});
}).catch((err) => {
  console.error('MongoDB connection error:', err);
});


