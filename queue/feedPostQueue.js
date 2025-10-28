// feedQueue.js
const Feed = require("../models/feedModel");
const createQueue = require("../queue.js");

const feedQueue = createQueue("feed-posts");

feedQueue.process(async (job) => {
  const { feedId } = job.data;
  console.log(`🚀 Processing scheduled feed job: ${feedId}`);

  const feed = await Feed.findById(feedId);
  if (!feed) {
    console.log("⚠️ Feed not found:", feedId);
    return;
  }

  if (feed.isScheduled && feed.status === "Pending") {
    feed.isScheduled = false;
    feed.status = "Published";
    await feed.save();
    console.log(`✅ Feed ${feedId} published successfully`);
  } else {
    console.log(`ℹ️ Feed ${feedId} already published or not scheduled`);
  }
});

feedQueue.on("completed", (job) => console.log(`✅ Job ${job.id} completed`));
feedQueue.on("failed", (job, err) => console.error(`❌ Job ${job.id} failed`, err));

module.exports = feedQueue;
