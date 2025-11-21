const User = require('../../models/userModels/userModel');
const jwt = require('jsonwebtoken');
require('dotenv').config();
const bcrypt = require('bcrypt');
if (!global.otpStore) global.otpStore = new Map();
const {startUpProcessCheck}=require('../../middlewares/services/User Services/userStartUpProcessHelper');
const Device = require("../../models/userModels/userSession-Device/deviceModel");
const Session = require("../../models/userModels/userSession-Device/sessionModel");
const UserReferral=require('../../models/userModels/userReferralModel');
const ProfileSettings=require("../../models/profileSettingModel");
const fs = require("fs");
const path = require("path");
const { sendTemplateEmail } = require("../../utils/templateMailer"); 
const {checkAndClearDeactivatedUser}=require("../../controllers/userControllers/userDeleteController");





exports.createNewUser = async (req, res) => {
  try {
    const { username, email, password, referralCode, phone, whatsapp, accountType } = req.body;

    // ✅ Validate inputs
    if (!username || !email || !password || !accountType) {
      return res.status(400).json({ message: "All required fields must be provided" });
    }

   

    // ✅ Check for existing user
    const existingUser = await User.findOne({
      $or: [{ email }, { userName: username }],
    }).lean();

    if (existingUser) {
      return res.status(400).json({
        message:
          existingUser.email === email
            ? "Email already registered"
            : "Username already taken",
      });
    }

    // ✅ Hash password
    const passwordHash = await bcrypt.hash(password, 10);

    // ✅ Generate referral code (e.g., ARU234)
    const letters = username.replace(/\s+/g, "").slice(0, 3).toUpperCase() || "USR";
    const digits = Math.floor(100 + Math.random() * 900);
    const generatedCode = `${letters}${digits}`;

    // ✅ Create new user
    const user = new User({
      userName: username.replace(/\s+/g, "").trim(),
      email,
      passwordHash,
      referralCode: generatedCode,
      referralCodeIsValid: true,
      accountType, // ✅ store account type (Personal / Company)
    });

    // ✅ If referral code provided
    if (referralCode) {
      const parent = await User.findOne({
        referralCode,
        referralCodeIsValid: true,
      });

      if (!parent) {
        return res.status(400).json({ message: "Referral code invalid or inactive" });
      }

      user.referredByUserId = parent._id;

      await Promise.all([
        user.save(),
        UserReferral.updateOne(
          { parentId: parent._id },
          { $addToSet: { childIds: user._id } },
          { upsert: true }
        ),
      ]);
    } else {
      await user.save();
    }

    // ✅ Create profile settings
    ProfileSettings.create({
      userId: user._id,
      userName: username.replace(/\s+/g, "").trim(),
      displayName: username,
      phoneNumber: phone,
      whatsAppNumber: whatsapp,
      accountType, // ✅ also store here if you want to show in user profile
    }).catch((err) => console.error("❌ Failed to create ProfileSettings:", err));

    // ✅ Send welcome email
    sendTemplateEmail({
      templateName: "registration-confirmation.html",
      to: email,
      subject: "🎉 Welcome to Prithu - Registration Confirmed!",
      placeholders: {
        username,
        email,
        password,
        referralCode: generatedCode,
        accountType, // optional, if template includes account type
      },
      embedLogo: true,
    }).catch((err) => console.error("❌ Email sending failed:", err));

    // ✅ Final response
    res.status(201).json({
      success: true,
      message: "User registered successfully",
      referralCode: generatedCode,
      accountType,
    });
  } catch (err) {
    console.error("❌ Error creating user:", err);
    res.status(500).json({ message: "Server error" });
  }
};









exports.userLogin = async (req, res) => {
  try {
    const { identifier, password, deviceId, deviceType, os, browser, sessionId } = req.body;

    // 1️⃣ Validate inputs
    if (!identifier || !password) {
      return res.status(400).json({ error: "Username/Email and password are required" });
    }



    // 2️⃣ Find user
    const user = await User.findOne({
    email: identifier ,
    });
    if (!user) {
      return res.status(400).json({ error: "Invalid username" });
    }


    await checkAndClearDeactivatedUser(user._id);

    // 3️⃣ Validate password
    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      return res.status(400).json({ error: "Invalid password" });
    }

    // 4️⃣ Check if blocked
    if (user.isBlocked) {
      return res
        .status(403)
        .json({ error: "User credentials are blocked. Please contact admin." });
    }

    // 5️⃣ Run startup process
    const userStart = await startUpProcessCheck(user._id);

    // 6️⃣ Generate JWT tokens
    const accessToken = jwt.sign(
      {
        userName: user.userName,
        userId: user._id,
        role: "User",
        referralCode: user.referralCode,
      },
      process.env.JWT_SECRET,
      { expiresIn: "1h" }
    );

    const refreshToken = jwt.sign(
      { userId: user._id },
      process.env.JWT_REFRESH_SECRET,
      { expiresIn: "30d" }
    );

    // 7️⃣ Device Handling
    const currentDeviceId = deviceId 
    const deviceName = `${os || "Unknown OS"} - ${browser || "Unknown Browser"}`;

    // Find or create the device record
    let device = await Device.findOne({ userId: user._id, deviceId: currentDeviceId });

    if (!device) {
      device = await Device.create({
        userId: user._id,
        deviceId: currentDeviceId,
        deviceType: deviceType || "web",
        os: os || "Unknown OS",
        browser: browser || "Unknown Browser",
        deviceName,
        ipAddress: req.ip,
        isOnline: true,
        lastActiveAt: new Date(),
      });
      console.log("🆕 New device registered:", device.deviceName);
    } else {
      device.deviceType = deviceType || device.deviceType;
      device.os = os || device.os;
      device.browser = browser || device.browser;
      device.deviceName = deviceName;
      device.ipAddress = req.ip;
      device.isOnline = true;
      device.lastActiveAt = new Date();
      await device.save();
      console.log("♻️ Existing device login detected:", device.deviceName);
    }

    // 8️⃣ Session Handling
    let session = null;

    // First try to find an existing active session for this device
    session = await Session.findOne({
      userId: user._id,
      deviceId: device._id,
      isOnline: true,
    }).populate("deviceId", "deviceType os browser deviceName ipAddress");

    // If frontend sent a sessionId and it matches existing record, reuse it
    if (!session && sessionId) {
      const existingSession = await Session.findById(sessionId).populate(
        "deviceId",
        "deviceType os browser deviceName ipAddress"
      );
      if (existingSession && existingSession.userId.toString() === user._id.toString()) {
        session = existingSession;
        console.log("🔁 Reusing existing session:", session._id);
      }
    }

    // Otherwise, create a new session for this device
    if (!session) {
      session = await Session.create({
        userId: user._id,
        deviceId: device._id,
        refreshToken,
        isOnline: true,
        lastSeenAt: new Date(),
      });
      console.log("🆕 New session created:", session._id);

      // Link session to device
      device.sessionId = session._id;
      await device.save();
    } else {
      // Reactivate old session
      session.refreshToken = refreshToken;
      session.isOnline = true;
      session.lastSeenAt = new Date();
      await session.save();

      // Sync to device
      device.sessionId = session._id;
      await device.save();
    }

    // 🔟 Update user status
    await User.findByIdAndUpdate(user._id, {
      isOnline: true,
      lastSeenAt: new Date(),
    });

    // 1️⃣1️⃣ Send login notification (non-blocking)
    sendTemplateEmail({
      templateName: "login.html",
      to: user.email,
      subject: "👋 Welcome Back to Prithu!",
      placeholders: {
        username: user.userName,
        dashboardLink: `${process.env.FRONTEND_URL}/dashboard`,
      },
      embedLogo: true,
    }).catch((err) => console.error("❌ Failed to send login email:", err));

    // ✅ 1️⃣2️⃣ Return final response
    return res.status(200).json({
      success: true,
      message: "Login successful",
      accessToken,
      refreshToken,
      userId: user._id,
      sessionId: session._id,
      deviceId: device.deviceId,
      deviceType: device.deviceType,
      os: device.os,
      browser: device.browser,
      deviceName: device.deviceName,
      appLanguage: userStart.appLanguage,
      feedLanguage: userStart.feedLanguage,
      gender: userStart.gender,
      category: userStart.hasInterestedCategory,
      role: "user",
    });
  } catch (error) {
    console.error("❌ Login error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
};



 
 







exports.userSendOtp = async (req, res) => {
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({ error: "Email is required" });
  }

  try {
    // Generate 6-digit OTP and expiry (10 mins)
    const tempOtp = Math.floor(100000 + Math.random() * 900000).toString();
    const otpExpires = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    let username = "User";
    let templateName = "otp-verification.html";
    let subject = "Prithu - OTP Verification Code";

    const user = await User.findOne({ email: email.toLowerCase() });

    if (user) {
      // Existing user → Reset Password OTP
      username = user.userName || "User";
      user.otpCode = tempOtp;
      user.otpExpiresAt = otpExpires;
      await user.save();

      templateName = "reset-password-otp.html";
      subject = "Prithu - Password Reset OTP";
    } else {
      // New user → Store OTP temporarily
      otpStore.set(email, { tempOtp, expires: otpExpires });
      console.log("Temporary OTP saved for unregistered user:", email);
    }

    // Send OTP email
    await sendTemplateEmail({
      templateName,
      to: email,
      subject,
      placeholders: { username, otp: tempOtp },
    });

    console.log(`✅ OTP sent to ${email} | OTP: ${tempOtp}`);
    res.json({ message: "OTP sent successfully to email" });
  } catch (error) {
    console.error("❌ Error in userSendOtp:", error);
    res.status(500).json({ error: error.message });
  }
};


// Verify OTP for new (unregistered) users
 
exports.newUserVerifyOtp = async (req, res) => {
  try {
    const { otp, email } = req.body;

    if (!otp || !email) {
      return res.status(400).json({ error: "Email and OTP are required" });
    }

    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      return res.status(400).json({ message: "Email already exists" });
    }

    const record = otpStore.get(email);
    if (!record) {
      return res.status(400).json({ error: "No OTP found. Please request a new one." });
    }

    if (Date.now() > record.expires) {
      otpStore.delete(email);
      return res.status(400).json({ error: "OTP has expired" });
    }

    if (record.tempOtp !== otp) {
      return res.status(400).json({ error: "Invalid OTP" });
    }

    // Success
    otpStore.delete(email);
    res.status(200).json({
      verified: true,
      message: "OTP verified successfully. You can now register.",
    });
  } catch (error) {
    console.error("❌ Error in newUserVerifyOtp:", error);
    res.status(500).json({ error: error.message });
  }
};


exports.existUserVerifyOtp = async (req, res) => {
  try {
    const { otp } = req.body;

    if (!otp) {
      return res.status(400).json({ error: "OTP is required" });
    }

    const user = await User.findOne({ otpCode: otp });
    if (!user) {
      return res.status(400).json({ error: "Invalid OTP" });
    }

    if (!user.otpCode || !user.otpExpiresAt || user.otpExpiresAt < new Date()) {
      return res.status(400).json({ error: "Invalid or expired OTP" });
    }

    res.json({
      message: "OTP verified successfully",
      email: user.email,
    });
  } catch (error) {
    console.error("❌ Error in existUserVerifyOtp:", error);
    res.status(500).json({ error: error.message });
  }
};


exports.userPasswordReset = async (req, res) => {
  try {
    const { email, newPassword } = req.body;

    if (!email || !newPassword) {
      return res.status(400).json({ error: "Email and new password are required" });
    }

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);
    user.passwordHash = passwordHash;

    // Clear OTP after successful reset
    user.otpCode = undefined;
    user.otpExpiresAt = undefined;

    await user.save();

    // Send password reset success email
    await sendTemplateEmail({
      templateName: "password-reset-sucessfull.html",
      to: user.email,
      subject: "Your Prithu Password Has Been Reset",
      placeholders: { username: user.userName || "User" },
      embedLogo: true,
    });

    res.json({ message: "Password reset successful" });
  } catch (error) {
    console.error("❌ Error in userPasswordReset:", error);
    res.status(500).json({ error: error.message });
  }
};

exports.userLogOut = async (req, res) => {
  try {
    const userId = req.Id || req.userId; // Extracted from JWT middleware
    const { deviceId } = req.body; // ✅ Now only deviceId is sent from frontend

    if (!userId) {
      return res.status(401).json({ error: "Unauthorized: Invalid or missing token" });
    }

    if (!deviceId) {
      return res.status(400).json({ error: "deviceId is required for logout" });
    }

    // 1️⃣ Find the device by userId + deviceId
    const device = await Device.findOne({ userId, deviceId });
    if (!device) {
      return res.status(404).json({ error: "Device not found" });
    }

    // 2️⃣ Find and delete all sessions linked to this device
    const sessions = await Session.find({ userId, deviceId: device._id });

    if (sessions.length > 0) {
      // Delete all sessions for this device (clean logout)
      await Session.deleteMany({ userId, deviceId: device._id });
      console.log(`🧹 Deleted ${sessions.length} session(s) for device ${deviceId}`);
    } else {
      console.log("ℹ️ No active sessions found for this device.");
    }

    // 3️⃣ Mark device as offline
    device.isOnline = false;
    device.lastActiveAt = new Date();
    device.sessionId = null;
    await device.save();

    // 4️⃣ Check for other active sessions
    const activeSessions = await Session.find({ userId, isOnline: true });
    const userStillOnline = activeSessions.length > 0;

    // 5️⃣ Update user status accordingly
    await User.findByIdAndUpdate(userId, {
      isOnline: userStillOnline,
      lastSeenAt: new Date(),
      ...(userStillOnline ? {} : { refreshToken: null }),
    });

    return res.status(200).json({
      success: true,
      message: "Logout successful",
      deviceStatus: "Device marked offline",
      sessionDeleted: sessions.length,
      userStatusChanged: !userStillOnline,
    });
  } catch (error) {
    console.error("❌ Logout error:", error);
    return res.status(500).json({ error: error.message });
  }
};















