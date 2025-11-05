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
const { v4: uuidv4 } = require("uuid");
const fs = require("fs");
const path = require("path");
const { sendTemplateEmail } = require("../../utils/templateMailer"); 





exports.createNewUser = async (req, res) => {
  try {
    const { username, email, password, referralCode } = req.body;

    // Validate inputs
    if (!username || !email || !password) {
      return res.status(400).json({ message: "All fields required" });
    }

    // Check for existing user
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

    // Hash password
    const passwordHash = await bcrypt.hash(password, 10);

    //  Generate referral code like ARU234 (3 letters + 3 digits)
    const letters =
      username.replace(/\s+/g, "").slice(0, 3).toUpperCase() || "USR";
    const digits = Math.floor(100 + Math.random() * 900); 
    const generatedCode = `${letters}${digits}`;

    // Create user instance
    const user = new User({
      userName: username,
      email,
      passwordHash,
      referralCode: generatedCode,
      referralCodeIsValid: true,
    });

    // If user signed up with a referral
    if (referralCode) {
      const parent = await User.findOne({
        referralCode,
        referralCodeIsValid: true,
      });

      if (!parent) {
        return res
          .status(400)
          .json({ message: "Referral code invalid or inactive" });
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

    //Create ProfileSettings for this user
    ProfileSettings.create({
      userId: user._id,
      userName: username,
      displayName: username,
    }).catch((err) =>
      console.error("❌ Failed to create ProfileSettings:", err)
    );

    // Send confirmation email (non-blocking)
    sendTemplateEmail({
      templateName: "registration-confirmation.html",
      to: email,
      subject: "🎉 Welcome to Prithu - Registration Confirmed!",
      placeholders: {
        username,
        email,
        password, 
        referralCode: generatedCode,
      },
      embedLogo: true,
    }).catch((err) => console.error("❌ Email sending failed:", err));

    // Respond success
    res.status(201).json({
      success:true,
      message: "User registered successfully",
      referralCode: generatedCode,
    });
  } catch (err) {
    console.error("❌ Error creating user:", err);
    res.status(500).json({ message: "Server error" });
  }
};








 
exports.userLogin = async (req, res) => {
  try {
    const {
      identifier,
      password,
      deviceId,
      deviceType,
      os,
      browser,
    } = req.body;

    // 1️⃣ Validate inputs
    if (!identifier || !password) {
      return res
        .status(400)
        .json({ error: "Username/Email and password are required" });
    }

    // 2️⃣ Find user by username or email
    const user = await User.findOne({
      $or: [{ userName: identifier }, { email: identifier }],
    });
    if (!user) {
      return res
        .status(400)
        .json({ error: "Invalid username/email or password" });
    }

    // 3️⃣ Validate password
    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      return res
        .status(400)
        .json({ error: "Invalid username/email or password" });
    }

    // 4️⃣ Check if blocked
    if (user.isBlocked) {
      return res
        .status(403)
        .json({ error: "User credentials are blocked. Please contact admin." });
    }

    // 5️⃣ Run startup process checks
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

    // 7️⃣ Prepare Device Info
    const deviceIdentifier = deviceId || uuidv4();
    const deviceName = `${os || "Unknown OS"} - ${browser || "Unknown Browser"}`;

    // 8️⃣ Find or create device entry
    let device = await Device.findOne({
      userId: user._id,
      deviceId: deviceIdentifier,
    });

    if (!device) {
      device = await Device.create({
        userId: user._id,
        deviceId: deviceIdentifier,
        deviceType: deviceType || "web",
        os: os || "Unknown OS",
        browser: browser || "Unknown Browser",
        deviceName,
        ipAddress: req.ip,
        isOnline: true,
        lastActiveAt: new Date(),
      });
    } else {
      device.os = os || device.os;
      device.browser = browser || device.browser;
      device.deviceName = deviceName;
      device.deviceType = deviceType || device.deviceType;
      device.ipAddress = req.ip;
      device.lastActiveAt = new Date();
      device.isOnline = true;
      await device.save();
    }

    // 9️⃣ Manage user session
    let session = await Session.findOne({
      userId: user._id,
      deviceId: device._id,
    });

    if (!session) {
      session = await Session.create({
        userId: user._id,
        deviceId: device._id,
        role: "user",
        refreshToken,
        isOnline: true,
        lastSeenAt: new Date(),
      });
    } else {
      session.refreshToken = refreshToken;
      session.isOnline = true;
      session.lastSeenAt = new Date();
      await session.save();
    }

    // 🔟 Update user’s online status
    await User.findByIdAndUpdate(user._id, {
      isOnline: true,
      lastSeenAt: new Date(),
    });

    // 1️⃣1️⃣ Send “Welcome Back” Email (non-blocking)
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

    // 1️⃣2️⃣ Return login response
    return res.json({
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
    return res.status(500).json({ error: error.message });
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
    const userId = req.Id || req.userId; // 🔹 Extract userId from token
    const { deviceId, sessionId } = req.body;

    if (!userId) {
      return res.status(401).json({ error: "Unauthorized: Invalid or missing token" });
    }

    let userStatusChanged = false;

    // 🔹 Handle session-based logout
    if (sessionId) {
      const session = await Session.findById(sessionId);
      if (!session) return res.status(404).json({ error: "Session not found" });

      session.isOnline = false;
      session.lastSeenAt = new Date();
      await session.save();

      // Check if user has any other active sessions
      const activeSessions = await Session.find({
        userId: session.userId,
        isOnline: true,
      });

      if (activeSessions.length === 0) {
        await User.findByIdAndUpdate(session.userId, {
          isOnline: false,
          lastSeenAt: new Date(),
        });
        userStatusChanged = true;
      }
    }

    // 🔹 Handle device-based logout
    if (deviceId) {
      await Device.findOneAndUpdate(
        { userId, deviceId },
        { lastActiveAt: new Date() },
        { new: true }
      );

      // Check for any recently active devices (within 5 mins)
      const activeDevices = await Device.find({ userId });
      const hasActiveDevice = activeDevices.some(
        (d) => Date.now() - new Date(d.lastActiveAt).getTime() < 5 * 60 * 1000
      );

      if (!hasActiveDevice) {
        await User.findByIdAndUpdate(userId, {
          isOnline: false,
          lastSeenAt: new Date(),
          refreshToken: null,
        });
        userStatusChanged = true;
      } else {
        await User.findByIdAndUpdate(userId, { isOnline: true });
      }
    }

    // 🔹 If neither provided
    if (!sessionId && !deviceId) {
      return res.status(400).json({ error: "Either sessionId or deviceId required" });
    }

    res.json({
      success: true,
      message: "Logged out successfully",
      userStatusChanged,
    });
  } catch (error) {
    console.error("Logout error:", error);
    res.status(500).json({ error: error.message });
  }
};













