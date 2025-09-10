// Run this file as a separate worker process. Must be connected to a replica set for change streams.
const mongoose = require("mongoose");
const User = require("../models/userModels/userModel");
const ReferralEdge = require("../models/userModels/userRefferalModels/refferalEdgeModle");
const DirectFinisher = require("../models/userModels/userRefferalModels/directReferralFinishers");

async function startWatcher() {
  const changeStream = User.watch(
    [
      {
        $match: {
          operationType: "update",
          "updateDescription.updatedFields.referralCodeIsValid": { $exists: true },
        },
      },
    ],
    { fullDocument: "updateLookup" }
  );

  changeStream.on("change", async (change) => {
    try {
      const userId = change.documentKey._id;
      const newValid = change.updateDescription.updatedFields.referralCodeIsValid;

      // find the parent edge (child -> parent)
      const edge = await ReferralEdge.findOne({ childId: userId }).sort({ createdAt: 1 });
      if (!edge) return;

      // update DirectFinisher row for parent->child
      await DirectFinisher.updateOne(
        { parentId: edge.parentId, childId: userId },
        {
          $set: {
            status: newValid ? "finished" : "incomplete", // ✅ corrected
            side: edge.side,
            updatedAt: new Date(),
          },
          $setOnInsert: { createdAt: new Date() },
        },
        { upsert: true }
      );

      if (newValid) {
        console.log(`Referral finished: parent=${edge.parentId}, child=${userId}`);
        // 🔄 Optional: trigger payout or promotion event here
      }
    } catch (err) {
      console.error("ChangeStream processing error:", err);
    }
  });

  changeStream.on("error", (err) => {
    console.error("ChangeStream error:", err);
    // Restart strategy: PM2/Docker or backoff reconnect
  });

  console.log("Referral code watcher started ✅");
}

module.exports = { startWatcher };
