// db.js
import mongoose from "mongoose";

mongoose.set("monitorCommands", true);
 // enables 'commandStarted' events

export const connectDB = async () => {
  await mongoose.connect(process.env.MONGO_URI, { dbName: "yourdb" });
  console.log("✅ Mongo connected");
};
