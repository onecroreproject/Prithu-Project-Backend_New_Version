const crypto = require("crypto");
const TestSession = require("../models/userTestSchema");
const AptitudeResult = require("../models/userAptitudeResult");

exports.startAptitudeTest = async (req, res) => {
  try {
    const userId = req.Id;

    const sessionToken = crypto.randomBytes(16).toString("hex");

    await TestSession.create({
      userId,
      sessionToken,
      status: "pending"
    });

    const testUrl = `http://aptitude.1croreprojects.com/student/student-exam?user=${userId}&token=${sessionToken}`;

    return res.status(200).json({
      success: true,
      testUrl,
    });

  } catch (error) {
    console.error("Start Test Error:", error);
    return res.status(500).json({ success: false, message: "Unable to start test" });
  }
};







exports.aptitudeCallback = async (req, res) => {
  try {
    const { userId, sessionToken, score, timeTaken, testName } = req.body;

    console.log("📥 CALLBACK RECEIVED:", req.body);

    if (!userId || !sessionToken || !score || !testName) {
      return res.status(400).json({ success: false, message: "Missing required fields" });
    }

    // 🔥 Clean version ONLY FOR COMPARISON
    const cleanCompareName = testName.trim().toLowerCase().replace(/\s+/g, "");

    const session = await TestSession.findOne({ userId, sessionToken });

    if (!session) {
      return res.status(401).json({ success: false, message: "Invalid session token" });
    }

    if (session.status === "completed") {
      return res.status(400).json({ success: false, message: "Test already submitted" });
    }

    // 🔥 Find existing test result using cleaned name (comparison only)
    const existingResults = await AptitudeResult.find({ userId });

    const matchedResult = existingResults.find(
      (x) => x.testName.trim().toLowerCase().replace(/\s+/g, "") === cleanCompareName
    );

    if (matchedResult) {
      // 🔥 Update existing record
      matchedResult.score = score;
      matchedResult.timeTaken = timeTaken;
      matchedResult.receivedAt = new Date();
      await matchedResult.save();

      session.status = "completed";
      await session.save();

      return res.status(200).json({
        success: true,
        message: "Aptitude score updated (existing test)",
      });
    }

    // 🔥 Save NEW result (testName EXACTLY as received)
    await AptitudeResult.create({
      userId,
      score,
      timeTaken,
      testName,  // ❗ Save exactly what came from API
      receivedAt: new Date(),
    });

    session.status = "completed";
    await session.save();

    return res.status(200).json({
      success: true,
      message: "Aptitude score saved",
    });

  } catch (error) {
    console.error("Callback Error:", error);
    return res.status(500).json({ success: false, message: "Callback processing failed" });
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


