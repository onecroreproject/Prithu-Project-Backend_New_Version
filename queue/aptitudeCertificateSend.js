// queue/certificateQueue.js
const createQueue = require("../queue.js");
const AptitudeResult = require("../models/userAptitudeResult.js");
const TestSchedule = require("../models/aptitudeScheduleModel.js");
const User = require("../models/userModels/userModel.js");
const { sendTemplateEmail } = require("../utils/templateMailer.js");

const certificateQueue = createQueue("certificate-generation");

certificateQueue.process(async () => {
  console.log("🎯 Running certificate processing job...");

  // 1️⃣ Fetch results that have certificateId AND email not yet sent
  const results = await AptitudeResult.find({
    certificateId: { $exists: true },
    mailSent: false
  }).lean();

  for (const result of results) {
    const { userId, score, certificateId } = result;

    // testId = certificateId (your rule)
    const testId = certificateId;

    // 2️⃣ Fetch user
    const user = await User.findById(userId).lean();
    if (!user || !user.email) continue;

    // 3️⃣ Fetch Schedule using testId
    const schedule = await TestSchedule.findOne({ testId }).lean();
    if (!schedule) continue;

    const { passScore, totalQuestions, testName } = schedule;

    // 4️⃣ Calculate percentage
    const percentage = ((score / totalQuestions) * 100).toFixed(2);

    // 5️⃣ Certificate Download URL
    const certificateUrl =
      `https://prithu.app/certificate/download?certificateId=${certificateId}`;

    /* -------------------------------------------------------
     * 6️⃣ SEND PASS MAIL or FAIL MAIL
     * ------------------------------------------------------*/
    if (percentage >= passScore) {
      console.log(`🏆 PASS → Sending certificate email to ${user.email}`);

      await sendTemplateEmail({
        templateName: "aptitudePass.html",
        to: user.email,
        subject: `Congratulations! Your Certificate for ${testName} is Ready`,
        embedLogo: true,
        placeholders: {
          firstName: user.firstName || "Student",
          lastName: user.lastName || "",
          testName,
          score: percentage,
          certificateId,
          downloadURL: certificateUrl
        }
      });
    } else {
      console.log(`❌ FAIL → Sending fail email to ${user.email}`);

      await sendTemplateEmail({
        templateName: "aptitudeFail.html",
        to: user.email,
        subject: `Your Test Result for ${testName}`,
        embedLogo: true,
        placeholders: {
          firstName: user.firstName || "Student",
          lastName: user.lastName || "",
          testName,
          score: percentage,
          passScore
        }
      });
    }

    // 7️⃣ Mark email as sent & save certificate URL
    await AptitudeResult.updateOne(
      { _id: result._id },
      {
        $set: {
          mailSent: true,
          certificateUrl
        }
      }
    );
  }

  console.log("✅ Certificate job completed");
});

module.exports = certificateQueue;
