const crypto = require("crypto");
const TestSession = require("../models/userTestSchema");
const AptitudeResult = require("../models/userAptitudeResult");
const User =require("../models/userModels/userModel");
const ProfileSettings=require("../models/profileSettingModel");
const mongoose=require("mongoose");
const axios=require("axios");
const { prithuDB } = require("../database");
const InterestedUser = require("../models/aptitudeIntrestedModel");
const TestSchedule = require("../models/aptitudeScheduleModel");
const {sendTemplateEmail}=require("../utils/templateMailer");




// ------------------------------------------------------
// GOOGLE CALENDAR URL GENERATOR
// ------------------------------------------------------
function makeGoogleCalendarUrl({ title, description, start, end }) {
  const formatDate = (d) =>
    new Date(d).toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";

  return (
    `https://www.google.com/calendar/render?action=TEMPLATE` +
    `&text=${encodeURIComponent(title)}` +
    `&details=${encodeURIComponent(description || "")}` +
    `&dates=${formatDate(start)}/${formatDate(end)}`
  );
}





exports.startAptitudeTest = async (req, res) => {
  try {
    const userId = req.Id;
    const { scheduleId, testId } = req.body;

    if (!scheduleId) {
      return res.status(400).json({
        success: false,
        message: "scheduleId is required"
      });
    }

    // -----------------------------------------------------
    // 1️⃣ Check if user marked interest (must be valid)
    // -----------------------------------------------------
    const interested = await InterestedUser.findOne({
      userId,
      scheduleId,
      testId,
      isValid: true
    });

    if (!interested) {
      return res.status(403).json({
        success: false,
        message: "You are not registered or your interest is invalid."
      });
    }

    // -----------------------------------------------------
    // 2️⃣ Validate schedule
    // -----------------------------------------------------
    const schedule = await TestSchedule.findById(scheduleId);

    if (!schedule) {
      return res.status(404).json({
        success: false,
        message: "Test schedule not found"
      });
    }

    const now = new Date();

    // Test not started yet
    if (now < schedule.startTime) {
      return res.status(403).json({
        success: false,
        message: `Test has not started yet. Starts at ${schedule.startTime.toLocaleString()}`
      });
    }

    // Test ended
    if (schedule.endTime && now > schedule.endTime) {
      return res.status(403).json({
        success: false,
        message: "The test window has closed."
      });
    }

    // -----------------------------------------------------
    // 3️⃣ Fetch USER DETAILS (Profile + Email)
    // -----------------------------------------------------
    const user = await User.findById(userId).lean();
    const profile = await ProfileSettings.findOne({ userId }).lean();

    const email =user.email;
    const firstName = profile?.name || user?.userName || "";
    const lastName = profile?.lastName || "";

    // Determine Final TestId
    const finalTestId = testId || schedule.testId;

    // -----------------------------------------------------
    // 4️⃣ Check if a VALID existing session exists
    // -----------------------------------------------------
    let existingSession = await TestSession.findOne({
      userId,
      testId: finalTestId,
      status: "pending" // means not submitted yet
    });

    // Function to build final exam URL
    const buildTestUrl = (token) => {
      return (
        `https://aptitude.1croreprojects.com/student/student-exam` +
        `?user=${userId}` +
        `&token=${token}` +
        `&testId=${finalTestId}` +
        `&email=${encodeURIComponent(email)}` +
        `&firstName=${encodeURIComponent(firstName)}` +
        `&lastName=${encodeURIComponent(lastName)}`
      );
    };

    // If session already exists → reuse token
    if (existingSession) {
      return res.json({
        success: true,
        reused: true,
        testUrl: buildTestUrl(existingSession.sessionToken),
        userDetails: { email, firstName, lastName },
        message: "Existing test session found."
      });
    }

    // -----------------------------------------------------
    // 5️⃣ No existing session → create new one
    // -----------------------------------------------------
    const sessionToken = crypto.randomBytes(16).toString("hex");

    await TestSession.create({
      userId,
      testId: finalTestId,
      sessionToken,
      status: "pending",
      createdAt: new Date()
    });

    return res.json({
      success: true,
      reused: false,
      testUrl: buildTestUrl(sessionToken),
      userDetails: { email, firstName, lastName },
      message: "New aptitude test session created successfully."
    });

  } catch (error) {
    console.error("Start Test Error:", error);
    return res.status(500).json({
      success: false,
      message: "Unable to start the test",
      details: error.message
    });
  }
};





exports.aptitudeCallback = async (req, res) => {
  try {
    const { 
      userId, 
      sessionToken, 
      score, 
      timeTaken, 
      certificateId,
      testId 
    } = req.body;

    console.log("📥 CALLBACK RECEIVED:", req.body);

    // --------------------------------------------
    // 0️⃣ Validate required fields
    // --------------------------------------------
    if (!userId || !sessionToken || score == null || !certificateId || !testId) {
      return res.status(400).json({
        success: false,
        message: "Missing required fields (userId, sessionToken, testId, score, certificateId)"
      });
    }

    // --------------------------------------------
    // 1️⃣ Validate Session (userId + sessionToken + testId)
    // --------------------------------------------
    const session = await TestSession.findOne({
      userId,
      sessionToken,
      testId
    });

    if (!session) {
      return res.status(401).json({
        success: false,
        message: "Invalid session: session not found for user, token, testId"
      });
    }

    // --------------------------------------------
    // 2️⃣ Prevent duplicate submission
    // --------------------------------------------
    if (session.status === "completed") {
      return res.status(400).json({
        success: false,
        message: "Test already submitted earlier."
      });
    }

    // --------------------------------------------
    // 3️⃣ Invalidate interest immediately
    // --------------------------------------------
    await InterestedUser.updateMany(
      { userId, testId, isValid: true },
      { $set: { isValid: false } }
    );

    console.log("🔒 User interest invalidated after callback");

    // --------------------------------------------
    // 4️⃣ Fetch Test Schedule (Need totalScore)
    // --------------------------------------------
    const schedule = await TestSchedule.findOne({ testId });

    if (!schedule) {
      return res.status(404).json({
        success: false,
        message: "Test schedule not found"
      });
    }

    const testName = schedule.testName;
    const totalScore = schedule.totalScore;

    if (!totalScore || totalScore <= 0) {
      return res.status(500).json({
        success: false,
        message: "Invalid test configuration: totalScore missing"
      });
    }

    // --------------------------------------------
    // 5️⃣ Calculate PASS / FAIL using 60% rule
    // --------------------------------------------
    const requiredScore = totalScore * 0.6; // 60% threshold
    let resultStatus = score >= requiredScore ? "pass" : "fail";

    console.log(`📊 USER SCORE: ${score}`);
    console.log(`📈 REQUIRED SCORE (60%): ${requiredScore}`);
    console.log(`🏁 RESULT: ${resultStatus.toUpperCase()}`);

    // --------------------------------------------
    // 6️⃣ Avoid duplicate result entry
    // --------------------------------------------
    const existingResult = await AptitudeResult.findOne({ userId, testId });

    if (existingResult) {
      return res.status(400).json({
        success: false,
        status: "exists",
        message: "Result already recorded for this test."
      });
    }

    // --------------------------------------------
    // 7️⃣ Save test result
    // --------------------------------------------
    await AptitudeResult.create({
      userId,
      certificateId,
      result: resultStatus,
      testId,
      score,
      totalScore,
      timeTaken,
      testName,
      receivedAt: new Date()
    });

    // --------------------------------------------
    // 8️⃣ Mark session as completed
    // --------------------------------------------
    session.status = "completed";
    session.completedAt = new Date();
    await session.save();

    // --------------------------------------------
    // 9️⃣ Respond back to client
    // --------------------------------------------
    if (resultStatus === "fail") {
      return res.status(200).json({
        success: false,
        status: "fail",
        message: `Better luck next time! You scored ${score}. Required: ${requiredScore} (60% of ${totalScore}).`
      });
    }

    return res.status(200).json({
      success: true,
      status: "pass",
      message: "Congratulations! You passed the test. Certificate will be delivered shortly."
    });

  } catch (error) {
    console.error("Callback Error:", error);
    return res.status(500).json({
      success: false,
      message: "Callback processing failed",
      details: error.message
    });
  }
};




exports.getLatestAptitudeResult = async (req, res) => {
  try {
    const userId = req.Id;

    const latest = await AptitudeResult.findOne({ userId })
      .sort({ receivedAt: -1 });

    // Also fetch all results for history
    const results = await AptitudeResult.find({ userId })
      .sort({ receivedAt: -1 })
      .limit(10);

    return res.status(200).json({
      success: true,
      latest: latest || null,
      results: results || []  // Add this to match frontend
    });

  } catch (error) {
    console.error("Latest Result Error:", error);
    return res.status(500).json({
      success: false,
      message: "Unable to fetch latest result"
    });
  }
};



exports.addInterestedUser = async (req, res) => {
  try {
    const userId = req.Id;
    const { scheduleId, firstName, lastName, testId } = req.body;

    console.log({ scheduleId, firstName, lastName, testId });

    // --------------------------------------------
    // 0️⃣ Basic Validation
    // --------------------------------------------
    if (!scheduleId || !testId || !firstName) {
      return res.status(400).json({
        success: false,
        message: "scheduleId, testId and firstName are required"
      });
    }

    const cleanFirstName = firstName.trim();
    const cleanLastName = lastName?.trim() || "";

    // --------------------------------------------
    // 1️⃣ Fetch schedule using testId
    // Auto status update already happens via schema hooks
    // --------------------------------------------
    const schedule = await TestSchedule.findOne({ testId });

    if (!schedule) {
      return res.status(404).json({
        success: false,
        message: "Test schedule not found for this testId"
      });
    }

    // ---------------------------------------------------
    // 2️⃣ Ensure schedule is UPCOMING only
    // ---------------------------------------------------
    if (schedule.status !== "upcoming") {
      return res.status(400).json({
        success: false,
        message: `You cannot register. Test is currently '${schedule.status}'.`
      });
    }

    // --------------------------------------------
    // 3️⃣ Validate Timing — Interest closes 2 minutes before start
    // --------------------------------------------
    const now = new Date();
    const startTime = new Date(schedule.startTime);

    // Close interest 2 minutes before test start
    const interestCloseTime = new Date(startTime.getTime() - 2 * 60 * 1000);

    // If current time is past the interest closing time → too late
    if (now >= interestCloseTime) {
      return res.status(400).json({
        success: false,
        message: "Interest submission closed. You are too late to show interest."
      });
    }

    const testName = schedule.testName; // Always from DB

    // --------------------------------------------
    // 4️⃣ Prevent duplicate interest for SAME TEST
    // --------------------------------------------
    const existingTestInterest = await InterestedUser.findOne({
      userId,
      testId,
      isValid: true
    });

    if (existingTestInterest) {
      return res.status(400).json({
        success: false,
        message: "You already registered interest for this test."
      });
    }

    // --------------------------------------------
    // 5️⃣ Fetch user email
    // --------------------------------------------
    const user = await User.findById(userId).select("email");
    if (!user || !user.email) {
      return res.status(400).json({
        success: false,
        message: "User email not found"
      });
    }

    // --------------------------------------------
    // 6️⃣ Update Profile Name
    // --------------------------------------------
    await ProfileSettings.findOneAndUpdate(
      { userId },
      {
        name: cleanFirstName,
        lastName: cleanLastName
      },
      { new: true, upsert: false }
    );

    // --------------------------------------------
    // 7️⃣ Save new interest
    // --------------------------------------------
    await InterestedUser.create({
      userId,
      scheduleId,
      testId,
      testName,
      firstName: cleanFirstName,
      lastName: cleanLastName,
      isValid: true,
      interestedAt: new Date()
    });

    // --------------------------------------------
    // 8️⃣ Prepare Email Content
    // --------------------------------------------
    const formattedDate = new Date(schedule.startTime).toLocaleString("en-IN", {
      dateStyle: "full",
      timeStyle: "short",
      hour12: true
    });

    // Google Calendar Event Links
    const startISO = new Date(schedule.startTime)
      .toISOString()
      .replace(/[-:]/g, "")
      .replace(/\.\d+Z$/, "Z");

    const endISO = new Date(schedule.endTime)
      .toISOString()
      .replace(/[-:]/g, "")
      .replace(/\.\d+Z$/, "Z");

    const googleCalendarURL =
      `https://www.google.com/calendar/render?action=TEMPLATE` +
      `&text=${encodeURIComponent(testName)}` +
      `&dates=${startISO}/${endISO}` +
      `&details=${encodeURIComponent("Aptitude Test Scheduled")}` +
      `&location=${encodeURIComponent("Online Test Portal")}`;

    // --------------------------------------------
    // 9️⃣ Send Email
    // --------------------------------------------
    await sendTemplateEmail({
      templateName: "aptitudeReminderMail.html",
      to: user.email,
      subject: `Your Test Interest is Confirmed – ${testName}`,
      embedLogo: true,
      placeholders: {
        firstName: cleanFirstName,
        lastName: cleanLastName,
        testName,
        startTime: formattedDate,
        duration: schedule.testDuration,
        totalQuestions: schedule.totalQuestions,
        passScore: schedule.passScore,
        calendarLink: googleCalendarURL
      }
    });

    return res.status(200).json({
      success: true,
      message: "Interest recorded successfully, profile updated, and email sent."
    });

  } catch (err) {
    console.error("Add interest error:", err);
    return res.status(500).json({
      success: false,
      message: "Unable to save interest",
      details: err.message
    });
  }
};








exports.getTopAptitudePerformers = async (req, res) => {
  try {
    // 📅 Last 7 days
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const topPerformers = await AptitudeResult.aggregate([
      // 1️⃣ Filter last 7 days
      {
        $match: {
          receivedAt: { $gte: sevenDaysAgo }
        }
      },

      // 2️⃣ Sort (best performance first)
      {
        $sort: {
          score: -1,
          timeTaken: 1,
          receivedAt: -1
        }
      },

      // 3️⃣ Limit top 10
      { $limit: 10 },

      // 4️⃣ Join ProfileSettings
      {
        $lookup: {
          from: "ProfileSettings",
          localField: "userId",
          foreignField: "userId",
          as: "profile"
        }
      },

      // 5️⃣ Unwind profile (optional user may not have profile)
      {
        $unwind: {
          path: "$profile",
          preserveNullAndEmptyArrays: true
        }
      },

      // 6️⃣ (Optional) Only published profiles
      {
        $match: {
          $or: [
            { "profile.isPublished": true },
            { profile: { $exists: false } }
          ]
        }
      },

      // 7️⃣ Shape response
      {
        $project: {
          _id: 1,
          testName: 1,
          score: 1,
          timeTaken: 1,
          certificateId: 1,
          certificateUrl: 1,
          receivedAt: 1,

          user: {
            userId: "$userId",
            userName: "$profile.userName",
            name: "$profile.name",
            lastName: "$profile.lastName",
            bio: "$profile.bio",
            city: "$profile.city",
            country: "$profile.country",
            profileAvatar: "$profile.profileAvatar",
            shareableLink: "$profile.shareableLink"
          }
        }
      }
    ]);

    return res.status(200).json({
      success: true,
      count: topPerformers.length,
      data: topPerformers
    });

  } catch (error) {
    console.error("❌ Error fetching top aptitude performers:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch top aptitude performers"
    });
  }
};







exports.getAllUserTestSchedules = async (req, res) => {
  try {
    const userId = req.Id;
    const now = new Date();

    /* -------------------------------------------------
     * 1️⃣ FETCH ALL SCHEDULES
     * ------------------------------------------------- */
    let schedules = await TestSchedule.find().sort({ startTime: 1 }).lean();

    /* -------------------------------------------------
     * 2️⃣ CLEANUP COMPLETED SCHEDULES
     * ------------------------------------------------- */
    const completedScheduleIds = [];

    schedules.forEach(schedule => {
      if (
        schedule.status !== "cancelled" &&
        schedule.endTime &&
        now > schedule.endTime
      ) {
        completedScheduleIds.push(schedule._id);
      }
    });

    if (completedScheduleIds.length) {
      console.log("🧹 Deleting completed schedules:", completedScheduleIds.length);

      // ❌ Delete schedules
      await TestSchedule.deleteMany({
        _id: { $in: completedScheduleIds }
      });

      // ❌ Delete test sessions
      await TestSession.deleteMany({
        testId: { $in: schedules
          .filter(s => completedScheduleIds.includes(s._id))
          .map(s => s.testId)
        }
      });

      // ❌ Delete interested users
      await InterestedUser.deleteMany({
        scheduleId: { $in: completedScheduleIds }
      });

      // Remove deleted schedules from local array
      schedules = schedules.filter(
        s => !completedScheduleIds.includes(s._id)
      );
    }

    /* -------------------------------------------------
     * 3️⃣ USER INTEREST DATA
     * ------------------------------------------------- */
    const userInterests = await InterestedUser.find({
      userId,
      isValid: true
    });

    const interestedScheduleIds = userInterests.map(x =>
      x.scheduleId.toString()
    );

    /* -------------------------------------------------
     * 4️⃣ ALL INTERESTED USERS (ADMIN INFO)
     * ------------------------------------------------- */
    const interestMap = await InterestedUser.find({ isValid: true })
      .populate("userId", "userName profileAvatar")
      .lean();

    const scheduleInterest = {};
    interestMap.forEach(i => {
      const sid = i.scheduleId.toString();
      if (!scheduleInterest[sid]) scheduleInterest[sid] = [];
      scheduleInterest[sid].push({
        userId: i.userId?._id,
        name: i.userId?.userName || "",
        avatar: i.userId?.profileAvatar || ""
      });
    });

    /* -------------------------------------------------
     * 5️⃣ RESULT BUCKETS
     * ------------------------------------------------- */
    const runningInterestedTests = [];
    const upcomingInterestedTests = [];
    const upcomingNotInterestedTests = [];

    /* -------------------------------------------------
     * 6️⃣ PROCESS REMAINING SCHEDULES
     * ------------------------------------------------- */
    schedules.forEach(schedule => {

      if (schedule.status !== "cancelled") {
        if (now < schedule.startTime) schedule.status = "upcoming";
        else if (now >= schedule.startTime && now <= schedule.endTime)
          schedule.status = "running";
      }

      const sid = schedule._id.toString();
      const isUserInterested = interestedScheduleIds.includes(sid);

      const interestedUsers = scheduleInterest[sid] || [];

      const enrichedSchedule = {
        ...schedule,
        interestedUsers,
        interestedCount: interestedUsers.length,
        isInterested: isUserInterested
      };

      // 🔹 UPCOMING
      if (schedule.status === "upcoming") {
        if (isUserInterested) {
          upcomingInterestedTests.push(enrichedSchedule);
        } else {
          upcomingNotInterestedTests.push(enrichedSchedule);
        }
      }

      // 🔹 RUNNING
      if (schedule.status === "running" && isUserInterested) {
        runningInterestedTests.push(enrichedSchedule);
      }
    });

    /* -------------------------------------------------
     * 7️⃣ RESPONSE
     * ------------------------------------------------- */
    return res.json({
      success: true,
      userId,

      runningInterestedCount: runningInterestedTests.length,
      upcomingInterestedCount: upcomingInterestedTests.length,
      upcomingNotInterestedCount: upcomingNotInterestedTests.length,

      runningInterestedTests,
      upcomingInterestedTests,
      upcomingNotInterestedTests
    });

  } catch (err) {
    console.error("❌ Get test schedules error:", err);
    return res.status(500).json({
      success: false,
      message: "Unable to fetch test schedules",
      details: err.message
    });
  }
};










  // Get dashboard statistics
exports.getDashboardStats = async (req, res) => {
  try {
    /* ----------------------------------------------------------
     * Get CURRENT MONTH RANGE
     * ---------------------------------------------------------- */
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();

    const startOfMonth = new Date(year, month, 1);
    const endOfMonth = new Date(year, month + 1, 1);

    /* ----------------------------------------------------------
     * 1️⃣ TOTAL USERS (Registered users)
     * ---------------------------------------------------------- */
    const totalUsers = await User.countDocuments();

    /* ----------------------------------------------------------
     * 2️⃣ USERS WHO COMPLETED AT LEAST 1 TEST (unique test takers)
     * ---------------------------------------------------------- */
    const uniqueCompletedUsers = (await AptitudeResult.distinct("userId")).length;

    /* ----------------------------------------------------------
     * 3️⃣ TOTAL TESTS COMPLETED THIS MONTH (from AptitudeResult)
     * ---------------------------------------------------------- */
    const totalTests = await AptitudeResult.countDocuments({
      receivedAt: { $gte: startOfMonth, $lt: endOfMonth }
    });

    /* ----------------------------------------------------------
     * 4️⃣ ACTIVE/PENDING TEST SESSIONS (based on TestSession)
     * ---------------------------------------------------------- */
    const activeTests = await TestSession.countDocuments({ status: "pending" });

    /* ----------------------------------------------------------
     * 5️⃣ PENDING EVALUATION = pending test sessions
     * ---------------------------------------------------------- */
    const pendingEvaluations = activeTests;

    /* ----------------------------------------------------------
     * 6️⃣ AVERAGE SCORE FOR ALL RESULTS
     * ---------------------------------------------------------- */
    const avgScoreData = await AptitudeResult.aggregate([
      { $group: { _id: null, avgScore: { $avg: "$score" } } }
    ]);

    const avgScore = avgScoreData[0]?.avgScore || 0;

    /* ----------------------------------------------------------
     * 7️⃣ COMPLETION RATE (Users who completed at least 1 test)
     * ---------------------------------------------------------- */
    const completionRate =
      totalUsers > 0 ? (uniqueCompletedUsers / totalUsers) * 100 : 0;

    /* ----------------------------------------------------------
     * 8️⃣ FINAL RESPONSE
     * ---------------------------------------------------------- */
    res.json({
      totalUsers,
      uniqueCompletedUsers,
      totalCandidates: uniqueCompletedUsers,

      totalTests, // ✅ NEW FIELD
      activeTests,
      pendingEvaluations,

      avgScore: Number(avgScore.toFixed(2)),
      completionRate: Number(completionRate.toFixed(1)),

      month: month + 1,
      year: year
    });

  } catch (error) {
    console.error("Dashboard stats error:", error);
    res.status(500).json({
      error: "Failed to fetch dashboard statistics",
      details: error.message
    });
  }
};


  // Get recent tests
exports.getRecentTests = async (req, res) => {
  try {
    // 1️⃣ Fetch 10 recent sessions
    const recentSessions = await TestSession.find()
      .sort({ createdAt: -1 })
      .limit(10)
      .lean();

    if (recentSessions.length === 0) {
      return res.json([]);
    }

    // 2️⃣ Extract userIds
    const userIds = recentSessions.map(s => s.userId);

    // 3️⃣ Fetch latest result per user
    const latestResults = await AptitudeResult.aggregate([
      { $match: { userId: { $in: userIds } } },
      { $sort: { receivedAt: -1 } },
      {
        $group: {
          _id: "$userId",
          testName: { $first: "$testName" },
          score: { $first: "$score" },
          timeTaken: { $first: "$timeTaken" },
          receivedAt: { $first: "$receivedAt" },
        }
      }
    ]);

    const latestResultMap = new Map(
      latestResults.map(r => [String(r._id), r])
    );

    // 4️⃣ Fetch global statistics for all test names found
    const testNames = latestResults.map(r => r.testName);

    const testStats = await AptitudeResult.aggregate([
      { $match: { testName: { $in: testNames } } },
      {
        $group: {
          _id: "$testName",
          avgScore: { $avg: "$score" },
          candidates: { $sum: 1 }
        }
      }
    ]);

    const statsMap = new Map(
      testStats.map(s => [s._id, s])
    );

    // 5️⃣ Build final response
    const finalData = recentSessions.map(session => {
      const userResult = latestResultMap.get(String(session.userId));
      const stats = userResult ? statsMap.get(userResult.testName) : null;

      return {
        _id: session._id,
        name: userResult?.testName || "No Test Submitted",
        date: session.createdAt,
        candidates: stats?.candidates || 0,
        avgScore: stats ? Number(stats.avgScore.toFixed(1)) : 0,
        status: session.status
      };
    });

    res.json(finalData);

  } catch (error) {
    console.error("Error fetching recent tests:", error);
    res.status(500).json({
      error: "Failed to fetch recent tests",
      details: error.message
    });
  }
};


  // Get top performers
exports.getTopPerformers = async (req, res) => {
  try {
    /*
      🧠 Pipeline summary:
      1. Sort by user + testName + latest receivedAt
      2. Group -> pick only latest attempt per test
      3. Group by user -> calculate:
          - totalTests
          - averageScore
          - latestResults array
      4. Sort by averageScore desc
      5. Limit 10
    */

    const topResults = await AptitudeResult.aggregate([
      // Sort so latest attempt comes first
      { $sort: { userId: 1, testName: 1, receivedAt: -1 } },

      // Group by user & test -> keep only latest attempt
      {
        $group: {
          _id: { userId: "$userId", testName: "$testName" },
          latestScore: { $first: "$score" },
          latestTimeTaken: { $first: "$timeTaken" },
          latestReceivedAt: { $first: "$receivedAt" },
        },
      },

      // Group again by user -> aggregate all latest attempts
      {
        $group: {
          _id: "$_id.userId",
          totalTests: { $sum: 1 },
          averageScore: { $avg: "$latestScore" },
          tests: {
            $push: {
              testName: "$_id.testName",
              score: "$latestScore",
              timeTaken: "$latestTimeTaken",
              receivedAt: "$latestReceivedAt",
            },
          },
        },
      },

      // Sort performers by avg score
      { $sort: { averageScore: -1 } },

      // Only top 10
      { $limit: 10 },
    ]);

    if (!topResults.length) {
      return res.json([]);
    }

    const userIds = topResults.map(item => item._id);

    // Fetch user basic info
    const users = await User.find({ _id: { $in: userIds } })
      .select("name email")
      .lean();

    const userMap = new Map(users.map(u => [String(u._id), u]));

    // Fetch user profile info
    const profiles = await ProfileSettings.find({ userId: { $in: userIds } })
      .select("userId userName name lastName profileAvatar")
      .lean();

    const profileMap = new Map(
      profiles.map(p => [String(p.userId), p])
    );

    // Final formatted performers list
    const performers = topResults.map((item, index) => {
      const user = userMap.get(String(item._id)) || {};
      const profile = profileMap.get(String(item._id)) || {};

      return {
        userId: item._id,

        // Profile details
        name: profile.name || user.name || "Unknown User",
        lastName: profile.lastName || "",
        email: user.email || "No Email",
        userName: profile.userName || "",
        profileAvatar: profile.profileAvatar || null,

        // Performance metrics
        totalTests: item.totalTests,
        averageScore: Number(item.averageScore.toFixed(2)),
        latestTests: item.tests, // all latest attempts

        // Rank
        rank: index + 1,
      };
    });

    res.json(performers);

  } catch (error) {
    console.error("❌ Error fetching top performers:", error);
    res.status(500).json({
      error: "Failed to fetch top performers",
      details: error.message,
    });
  }
};


  // Get upcoming tests
  exports.getUpcomingTests=async(req, res)=> {
    try {
      // In a real app, you would have a TestSchedule model
      // For now, we'll simulate upcoming tests
      const upcomingTests = [
        {
          _id: "1",
          name: "Backend Developer",
          date: new Date(),
          time: "14:00",
          candidates: 24
        },
        {
          _id: "2",
          name: "Data Analyst Test",
          date: new Date(Date.now() + 86400000), // Tomorrow
          time: "10:00",
          candidates: 18
        },
        {
          _id: "3",
          name: "Product Manager",
          date: new Date(Date.now() + 2 * 86400000), // Day after tomorrow
          time: "15:30",
          candidates: 15
        }
      ];

      res.json(upcomingTests);
    } catch (error) {
      console.error("Error fetching upcoming tests:", error);
      res.status(500).json({ 
        error: "Failed to fetch upcoming tests",
        details: error.message 
      });
    }
  }

  // Get system status
exports.getSystemStatus = async (req, res) => {
  try {
    const startTime = Date.now();

    /* ------------------------------------------------------------------
     * 1️⃣ CHECK prithuDB DATABASE HEALTH
     * ------------------------------------------------------------------ */
    let dbStatus = "unknown";
    let dbLatency = null;

    try {
      const dbCheckStart = Date.now();

      await prithuDB.db.command({ ping: 1 }); // ✅ FIXED FOR MULTIPLE DBs

      dbLatency = Date.now() - dbCheckStart;

      if (prithuDB.readyState === 1) dbStatus = "connected";
      else if (prithuDB.readyState === 2) dbStatus = "connecting";
      else dbStatus = "disconnected";

    } catch (err) {
      dbStatus = "disconnected";
      dbLatency = null;
    }

    /* ------------------------------------------------------------------
     * 2️⃣ CHECK TEST ACTIVITY & RESULT DATA
     * ------------------------------------------------------------------ */
    const testSessionCount = await TestSession.countDocuments();
    const resultCount = await AptitudeResult.countDocuments();

    /* ------------------------------------------------------------------
     * 3️⃣ SERVER UPTIME
     * ------------------------------------------------------------------ */
    const serverUptime = process.uptime();

    /* ------------------------------------------------------------------
     * 4️⃣ API INTERNAL LATENCY
     * ------------------------------------------------------------------ */
    const apiLatency = Date.now() - startTime;

    /* ------------------------------------------------------------------
     * 5️⃣ CHECK EXTERNAL EXAM SERVER STATUS
     * ------------------------------------------------------------------ */
    const externalServerURL = "http://aptitude.1croreprojects.com";

    let externalServerStatus = "unknown";
    let externalLatency = null;

    try {
      const pingStart = Date.now();

      await axios.get(externalServerURL, { timeout: 3000 });

      externalLatency = Date.now() - pingStart;
      externalServerStatus = "online";

    } catch (err) {
      externalServerStatus = "offline";
      externalLatency = null;
    }

    /* ------------------------------------------------------------------
     * 6️⃣ FINAL STATUS RESPONSE
     * ------------------------------------------------------------------ */
    const systemStatus = {
      database: {
        status: dbStatus,
        latencyMs: dbLatency,
        connected: dbStatus === "connected",
        dbName: prithuDB.name
      },

      testEngine: {
        status: testSessionCount > 0 ? "operational" : "idle",
        activeSessions: testSessionCount,
      },

      resultProcessing: {
        status: "operational",
        totalResults: resultCount,
      },

      externalExamServer: {
        url: externalServerURL,
        status: externalServerStatus,
        latencyMs: externalLatency,
      },

      server: {
        uptimeSeconds: Number(serverUptime.toFixed(0)),
        apiLatencyMs: apiLatency,
      },

      overallSystem: {
        status:
          dbStatus === "connected" &&
          externalServerStatus === "online" &&
          apiLatency < 300
            ? "healthy"
            : "degraded",
      },
    };

    res.json(systemStatus);

  } catch (error) {
    console.error("❌ Error checking system status:", error);

    res.status(500).json({
      error: "Failed to check system status",
      details: error.message,
      systemStatus: {
        overallSystem: "down",
      },
    });
  }
};

  // Export test results
exports.exportTestResults = async (req, res) => {
  try {
    const results = await AptitudeResult.find().lean();

    if (!results.length) {
      return res.status(200).send("No results found.");
    }

    // Extract all userIds from results
    const userIds = results.map(r => r.userId);

    // Fetch User basic info
    const users = await User.find({ _id: { $in: userIds } })
      .select("email")
      .lean();

    const userMap = new Map(users.map(u => [String(u._id), u]));

    // Fetch Profile Settings
    const profiles = await ProfileSettings.find({ userId: { $in: userIds } })
      .select("userId name lastName userName profileAvatar")
      .lean();

    const profileMap = new Map(profiles.map(p => [String(p.userId), p]));

    // Build CSV data
    const csvData = results.map(result => {
      const userId = String(result.userId);

      const profile = profileMap.get(userId) || {};
      const user = userMap.get(userId) || {};

      return {
        Name: profile.name || "Unknown",
        LastName: profile.lastName || "",
        Email: profile.email || user.email || "No email",
        Test: result.testName || "Unknown Test",
        Score: result.score,
        TimeTaken: result.timeTaken ? `${result.timeTaken}s` : "N/A",
        Date: new Date(result.receivedAt).toLocaleDateString(),
      };
    });

    // Generate CSV content
    const csvHeaders = Object.keys(csvData[0]).join(",");
    const csvRows = csvData.map(row => Object.values(row).join(","));
    const csvContent = [csvHeaders, ...csvRows].join("\n");

    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", "attachment; filename=test-results.csv");
    res.send(csvContent);

  } catch (error) {
    console.error("Error exporting results:", error);
    res.status(500).json({
      error: "Failed to export test results",
      details: error.message
    });
  }
};














exports.getInterestedUsers = async (req, res) => {
  try {
    const { scheduleId } = req.params; // optional filter

    let filter = {};
    if (scheduleId) filter.scheduleId = scheduleId;

    const list = await InterestedUser.find(filter)
      .sort({ interestedAt: -1 })
      .lean();

    if (list.length === 0) {
      return res.json({ success: true, count: 0, users: [] });
    }

    // Collect userIds + scheduleIds
    const userIds = list.map(u => u.userId);
    const scheduleIds = list.map(u => u.scheduleId);

    // Populate profile data
    const profiles = await ProfileSettings.find({ userId: { $in: userIds } })
      .select("userId name lastName email profileAvatar phoneNumber")
      .lean();

    const profileMap = new Map(
      profiles.map(p => [String(p.userId), p])
    );

    // Populate schedule data
    const schedules = await TestSchedule.find({ _id: { $in: scheduleIds } })
      .select("testName startTime status")
      .lean();

    const scheduleMap = new Map(
      schedules.map(s => [String(s._id), s])
    );

    // Prepare final response
    const final = list.map(item => {
      const profile = profileMap.get(String(item.userId)) || {};
      const schedule = scheduleMap.get(String(item.scheduleId)) || {};

      return {
        userId: item.userId,
        scheduleId: item.scheduleId,
        testName: item.testName,

        name: profile.name || "Unknown",
        lastName: profile.lastName || "",
        email: profile.email || "",
        avatar: profile.profileAvatar || null,
        phone: profile.phoneNumber || null,

        schedule: {
          startTime: schedule.startTime,
          status: schedule.status,
        },

        interestedAt: item.interestedAt
      };
    });

    res.json({
      success: true,
      count: final.length,
      users: final
    });

  } catch (err) {
    console.error("Fetch interested users error:", err);
    res.status(500).json({
      success: false,
      message: "Unable to fetch interested users",
      details: err.message
    });
  }
};













exports.createTestSchedule = async (req, res) => {
  try {
    const {
      testName,
      testId,
      description,
      startTime,
      endTime,
      testDuration,
      totalQuestions,
      passScore,
    } = req.body;

    // Validation
    if (!testName || !testId || !startTime || !testDuration || !totalQuestions || !passScore) {
      return res.status(400).json({
        success: false,
        message:
          "Missing required fields: testId, testName, startTime, testDuration, totalQuestions, passScore",
      });
    }

    const duplicate = await TestSchedule.findOne({ testId, testName });
    if (duplicate) {
      return res.status(400).json({
        success: false,
        message: "A test with this testId already exists",
      });
    }

    /* --------------------------------------------------
     * ✅ CORRECT: Let JS handle timezone (IST → UTC)
     * -------------------------------------------------- */


    const totalScore = passScore;

    const schedule = await TestSchedule.create({
      testName,
      testId,
      description,
      startTime,
      endTime,
      testDuration,
      totalQuestions,
      totalScore,
      createdBy: req.adminId || null,
    });

    res.status(200).json({
      success: true,
      message: "Test schedule created successfully",
      schedule,
    });

  } catch (err) {
    console.error("Create schedule error:", err);
    res.status(500).json({
      success: false,
      message: "Unable to create test schedule",
      details: err.message,
    });
  }
};







exports.updateTestSchedule = async (req, res) => {
  try {
    const { scheduleId } = req.params;

    const {
      testName,
      testId,
      description,
      startTime,
      endTime,
      testDuration,
      totalQuestions,
      passScore,
      status,
      isActive
    } = req.body;

    const schedule = await TestSchedule.findById(scheduleId);

    if (!schedule) {
      return res.status(404).json({
        success: false,
        message: "Test schedule not found"
      });
    }

    // -------------------------------
    // CHECK & APPLY UPDATES
    // -------------------------------
    let changesHappened = false;

    const checkUpdate = (field, value) => {
      if (value !== undefined && schedule[field] !== value) {
        schedule[field] = value;
        changesHappened = true;
      }
    };

    // prevent duplicate testId
    if (testId !== undefined) {
      const exists = await TestSchedule.findOne({
        testId,
        _id: { $ne: scheduleId }
      });

      if (exists) {
        return res.status(400).json({
          success: false,
          message: "Another test is already using this testId"
        });
      }
      checkUpdate("testId", testId);
    }

    checkUpdate("testName", testName);
    checkUpdate("description", description);
    checkUpdate("totalQuestions", totalQuestions);
    checkUpdate("passScore", passScore);
    checkUpdate("status", status);
    checkUpdate("isActive", isActive);

    if (startTime !== undefined) checkUpdate("startTime", startTime);
    if (testDuration !== undefined) checkUpdate("testDuration", testDuration);

    // Recalculate endTime automatically
    if (startTime !== undefined || testDuration !== undefined) {
      const newEndTime = new Date(
        new Date(schedule.startTime).getTime() + schedule.testDuration * 60000
      );

      if (schedule.endTime !== newEndTime) {
        schedule.endTime = newEndTime;
        changesHappened = true;
      }
    }

    if (endTime !== undefined) checkUpdate("endTime", endTime);

    await schedule.save();

    // -------------------------------------------------------
    // 🔔 SEND NOTIFICATIONS IF ANY CHANGE HAPPENED
    // -------------------------------------------------------
    if (changesHappened) {
      const interestedCandidates = await InterestedUser.find({ scheduleId });

      const aptitudeUrl = `https://yourdomain.com/aptitude/${scheduleId}`;

      const googleCalendarUrl = makeGoogleCalendarUrl({
        title: schedule.testName,
        description: schedule.description,
        start: schedule.startTime,
        end: schedule.endTime
      });

      for (const user of interestedCandidates) {
        await sendTemplateEmail({
          templateName: "aptitudeScheduleUpdate.html",
          to: user.email, // ensure email stored in InterestedUser or User model
          subject: `Update: "${schedule.testName}" Test Schedule Changed`,
          placeholders: {
            firstName: user.firstName,
            testName: schedule.testName,
            startTime: schedule.startTime,
            endTime: schedule.endTime,
            aptitudeUrl,
            googleUrl: googleCalendarUrl
          },
          embedLogo: true
        });
      }
    }

    res.json({
      success: true,
      message: "Test schedule updated successfully",
      schedule
    });

  } catch (err) {
    console.error("Update schedule error:", err);
    res.status(500).json({
      success: false,
      message: "Unable to update test schedule",
      details: err.message
    });
  }
};






exports.deleteTestSchedule = async (req, res) => {
  try {
    const { scheduleId } = req.params;

    const schedule = await TestSchedule.findById(scheduleId);

    if (!schedule) {
      return res.status(404).json({
        success: false,
        message: "Test schedule not found"
      });
    }

    const deletedTestName = schedule.testName; // for email placeholders

    // ------------------------------------
    // 1️⃣ DELETE THE TEST SCHEDULE
    // ------------------------------------
    await TestSchedule.findByIdAndDelete(scheduleId);

    // ------------------------------------
    // 2️⃣ MAKE ALL INTERESTED USERS INVALID
    // ------------------------------------
    const interestedUsers = await InterestedUser.find({ scheduleId });

    await InterestedUser.updateMany(
      { scheduleId },
      { $set: { isValid: false } }
    );

    // ------------------------------------
    // 3️⃣ SEND EMAIL NOTIFICATION
    // ------------------------------------
    const redirectUrl = "https://yourdomain.com/dashboard"; // CHANGE THIS URL

    for (const user of interestedUsers) {
      await sendTemplateEmail({
        templateName: "aptitudeScheduleDelete.html",
        to: user.email, // ensure you have user email stored
        subject: `Test Cancelled: ${deletedTestName}`,
        placeholders: {
          firstName: user.firstName,
          testName: deletedTestName,
          redirectUrl
        },
        embedLogo: true
      });
    }

    // ------------------------------------
    // 4️⃣ SEND RESPONSE
    // ------------------------------------
    res.json({
      success: true,
      message: "Test schedule deleted successfully and users notified"
    });

  } catch (err) {
    console.error("Delete schedule error:", err);
    res.status(500).json({
      success: false,
      message: "Unable to delete test schedule",
      details: err.message
    });
  }
};




exports.getAllTestSchedules = async (req, res) => {
  try {
    const now = new Date();

    let schedules = await TestSchedule.find().sort({ startTime: 1 }).lean();

    schedules = schedules.map(s => {
      if (s.status !== "cancelled") {
        if (now < s.startTime) s.status = "upcoming";
        else if (now >= s.startTime && now <= s.endTime) s.status = "running";
        else if (now > s.endTime) s.status = "completed";
      }
      return s;
    });

    res.json({
      success: true,
      count: schedules.length,
      schedules
    });

  } catch (err) {
    console.error("Get test schedules error:", err);
    res.status(500).json({
      success: false,
      message: "Unable to fetch test schedules",
      details: err.message
    });
  }
};







exports.getSingleTestSchedule = async (req, res) => {
  try {
    const { scheduleId } = req.params;

    const schedule = await TestSchedule.findById(scheduleId).lean();

    if (!schedule) {
      return res.status(404).json({
        success: false,
        message: "Test schedule not found"
      });
    }

    const now = new Date();

    // Auto-detect status for response
    if (schedule.status !== "cancelled") {
      if (now < schedule.startTime) schedule.status = "upcoming";
      else if (now >= schedule.startTime && now <= schedule.endTime) schedule.status = "running";
      else schedule.status = "completed";
    }

    res.json({
      success: true,
      schedule
    });

  } catch (err) {
    console.error("Get single schedule error:", err);
    res.status(500).json({
      success: false,
      message: "Unable to fetch test schedule",
      details: err.message
    });
  }
};






exports.getUpcomingTestInterestedCandidates = async (req, res) => {
  try {
    const { scheduleId } = req.params;

    if (!scheduleId) {
      return res.status(400).json({
        success: false,
        message: "scheduleId is required"
      });
    }

    // 1️⃣ Fetch test schedule
    const test = await TestSchedule.findById(scheduleId).lean();
    if (!test) {
      return res.status(404).json({
        success: false,
        message: "Test schedule not found"
      });
    }

    // =====================================================================
    // CASE 1️⃣ : UPCOMING → Return Interested Users
    // =====================================================================
    if (test.status === "upcoming") {
      const interests = await InterestedUser.find({
        scheduleId,
        isValid: true
      })
        .populate("userId", "userName profileAvatar email")
        .lean();

      const interestedUsers = interests.map(i => ({
        userId: i.userId?._id,
        name: i.userId?.userName,
        email: i.userId?.email,
        avatar: i.userId?.profileAvatar,
        firstName: i.firstName,
        lastName: i.lastName,
        interestedAt: i.interestedAt
      }));

      return res.json({
        success: true,
        status: "upcoming",
        scheduleId,
        testDetails: test,
        interestedCount: interestedUsers.length,
        interestedUsers
      });
    }

    // =====================================================================
    // CASE 2️⃣ : RUNNING → Get Test Sessions & Categorize
    // =====================================================================
    if (test.status === "running") {

      // Fetch sessions for running test (testId is NUMBER)
      const sessions = await TestSession.find({ testId: test.testId })
        .populate("userId", "userName profileAvatar email")
        .lean();

      const pendingUsers = [];
      const completedUsers = [];

      // Process each session
      for (const s of sessions) {
        const userBase = {
          userId: s.userId?._id,
          name: s.userId?.userName,
          email: s.userId?.email,
          avatar: s.userId?.profileAvatar,
          sessionToken: s.sessionToken,
          startedAt: s.createdAt
        };

        if (s.status === "pending") {
          // PENDING → Only session + user info
          pendingUsers.push(userBase);
        }

        else if (s.status === "completed") {
          
          // COMPLETED → Fetch result from AptitudeResult
          const result = await AptitudeResult.findOne({
            userId: s.userId?._id,
            testName: test.testName
          }).lean();

          completedUsers.push({
            ...userBase,
            score: result?.score || null,
            result: result?.result || null,
            timeTaken: result?.timeTaken || null,
            receivedAt: result?.receivedAt || null,
            certificateId: result?.certificateId || null
          });
        }
      }

      return res.json({
        success: true,
        status: "running",
        scheduleId,
        testDetails: test,
        totalSessions: sessions.length,

        pendingCount: pendingUsers.length,
        completedCount: completedUsers.length,

        pendingUsers,
        completedUsers
      });
    }

    // =====================================================================
    // CASE 3️⃣ : COMPLETED → Ranked Candidates
    // =====================================================================
    if (test.status === "completed") {
      const results = await AptitudeResult.find({ testName: test.testName })
        .populate("userId", "userName profileAvatar email")
        .lean();

      if (!results.length) {
        return res.json({
          success: true,
          status: "completed",
          rankedCandidates: []
        });
      }

      results.sort((a, b) => b.score - a.score);

      const rankedCandidates = results.map(r => ({
        userId: r.userId?._id,
        name: r.userId?.userName,
        email: r.userId?.email,
        avatar: r.userId?.profileAvatar,
        score: r.score,
        result: r.result,
        certificateId: r.certificateId,
        timeTaken: r.timeTaken,
        receivedAt: r.receivedAt
      }));

      return res.json({
        success: true,
        status: "completed",
        scheduleId,
        testDetails: test,
        totalCandidates: rankedCandidates.length,
        rankedCandidates
      });
    }

    // =====================================================================
    // CASE 4️⃣ : CANCELLED or UNKNOWN
    // =====================================================================
    return res.status(400).json({
      success: false,
      message: `Cannot fetch candidates. Test is in status: ${test.status}`
    });

  } catch (error) {
    console.error("Fetch interested candidates error:", error);
    return res.status(500).json({
      success: false,
      message: "Unable to fetch interested candidates",
      details: error.message
    });
  }
};




