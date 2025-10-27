const Notification = require("../models/Notification");
const User = require("../models/User");
const JobPost = require("../models/JobPost");
const { sendEmail } = require("../utils/emailService");

// ✅ Send targeted job notifications (after new job created)
exports.notifyUsers = async (jobId) => {
  const job = await JobPost.findById(jobId);
  if (!job) return;

  const users = await User.find({
    "jobPreferences.categories": job.category,
    "jobPreferences.locations": job.location,
  });

  for (const user of users) {
    await Notification.create({
      userId: user._id,
      jobId,
      message: `New ${job.category} job posted: ${job.title}`,
    });

    // send email
    await sendEmail(
      user.email,
      "New Job Alert",
      `A new job "${job.title}" has been posted in ${job.location}. Check it out!`
    );
  }

  console.log(`✅ Notifications sent for job ${jobId}`);
};
