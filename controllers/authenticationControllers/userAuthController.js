const User = require('../../models/userModels/userModel');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');
require('dotenv').config();
const bcrypt = require('bcrypt');
const crypto = require("crypto"); 
if (!global.otpStore) global.otpStore = new Map();
const {startUpProcessCheck}=require('../../middlewares/services/User Services/userStartUpProcessHelper');
const Device = require("../../models/userModels/userSession-Device/deviceModel");
const Session = require("../../models/userModels/userSession-Device/sessionModel");
const UserReferral=require('../../models/userModels/userReferralModel');
const { v4: uuidv4 } = require("uuid");
const {sendMailSafeSafe} = require('../../utils/sendMail');
const fs = require("fs");
const path = require("path");
const { sendTemplateEmail } = require("../../utils/templateMailer"); 




exports.createNewUser = async (req, res) => {
  try {
    const { username, email, password, referralCode } = req.body;

    if (!username || !email || !password) {
      return res.status(400).json({ message: "All fields required" });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const base = username.replace(/\s+/g, "").slice(0, 3).toUpperCase() || "XXX";
    const generatedCode = `${base}${crypto.randomBytes(2).toString("hex")}`;

    const user = new User({
      userName: username,
      email,
      passwordHash,
      referralCode: generatedCode,
      referralCodeIsValid: false,
    });

    if (referralCode) {
      const parent = await User.findOne({ referralCode, referralCodeIsValid: true });
      if (!parent) return res.status(400).json({ message: "Referral code invalid or used up" });

      user.referredByUserId = parent._id;
      await user.save();

      await UserReferral.updateOne(
        { parentId: parent._id },
        { $addToSet: { childIds: user._id } },
        { upsert: true }
      );
    } else {
      await user.save();
    }

    // ✅ Send beautiful registration confirmation email
    try {
      await sendTemplateEmail({
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
      });
      console.log("✅ Registration confirmation email sent to:", email);
    } catch (err) {
      console.error("❌ Failed to send registration email:", err);
    }

    res.status(201).json({
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
    const { identifier, password, role, roleRef, deviceId, deviceType } = req.body;
 
    // 1️⃣ Find user
    const user = await User.findOne({
      $or: [{ userName: identifier }, { email: identifier }],
    });
    if (!user) {
      return res.status(400).json({ error: "Invalid username/email or password" });
    }
 
    // 2️⃣ Validate password
    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      return res.status(400).json({ error: "Invalid username/email or password" });
    }
 
    if(user.isBlocked){
      return res.status(403).json ({error:"User credentials are blocked. Please contact admin."});
    }
 
    // 3️⃣ Run startup checks
    const userStart = await startUpProcessCheck(user._id);
 
    // 4️⃣ Generate tokens
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
 
    // 5️⃣ Handle device
    const deviceIdentifier = deviceId || uuidv4();
    let device = await Device.findOne({ deviceId: deviceIdentifier, userId: user._id });
 
    if (!device) {
      device = await Device.create({
        userId: user._id,
        deviceId: deviceIdentifier,
        deviceType: deviceType || "web",
        ipAddress: req.ip,
        lastActiveAt: new Date(),
      });
    } else {
      device.ipAddress = req.ip;
      device.lastActiveAt = new Date();
      await device.save();
    }
 
    // 6️⃣ Create or update session
    let session = await Session.findOne({ userId: user._id, deviceId: device._id });
 
    if (!session) {
      session = await Session.create({
        userId: user._id,
        deviceId: device._id,
        role: "user",
        refreshToken,
        isOnline: true,
        lastSeenAt: null,
      });
    } else {
      session.refreshToken = refreshToken;
      session.isOnline = true;
      session.lastSeenAt = null;
      await session.save();
    }
 
    // 7️⃣ Update user global online status
    user.isOnline = true;
    user.lastSeenAt = null;
    await user.save();
 
    // 8️⃣ Send "Welcome Back" email
    const emailTemplatePath = path.join(__dirname, "../../utils/templates/login.html");
    let emailHtml = fs.readFileSync(emailTemplatePath, "utf-8");
 
    // Replace placeholders
    emailHtml = emailHtml.replace("{username}", user.userName);
    emailHtml = emailHtml.replace("[Insert Dashboard Link]", `${process.env.FRONTEND_URL}/dashboard`);
 
    // Send mail
    sendMailSafeSafe({
      to: user.email,
      subject: "Welcome Back to Prithu!",
      html: emailHtml
    });
 
    // 9️⃣ Return tokens + session info
    res.json({
      accessToken,
      refreshToken,
      sessionId: session._id,
      deviceId: device.deviceId,
      appLanguage: userStart.appLanguage,
      feedLanguage: userStart.feedLanguage,
      gender: userStart.gender,
      category: userStart.hasInterestedCategory,
      role:"user",
    });
 
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ error: error.message });
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

/**
 * Verify OTP for new (unregistered) users
 */
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

/**
 * Verify OTP for existing users (Password Reset)
 */
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

/**
 * Reset Password after OTP verification
 */
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
    const { userId, deviceId, sessionId } = req.body;

    if (!userId) {
      return res.status(400).json({ error: "userId required" });
    }

    let userStatusChanged = false;

    // 1️⃣ If sessionId provided → handle session-based logout
    if (sessionId) {
      const session = await Session.findById(sessionId);
      if (!session) return res.status(404).json({ error: "Session not found" });

      session.isOnline = false;
      session.lastSeenAt = new Date();
      await session.save();

      // Check other active sessions
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

    // 2️⃣ If deviceId provided → handle device-based logout
    if (deviceId) {
      await Device.findOneAndUpdate(
        { userId, deviceId },
        { lastActiveAt: new Date() },
        { new: true }
      );

      // Check other active devices
      const activeDevices = await Device.find({ userId });
      const hasActiveDevice = activeDevices.some(
        (d) => Date.now() - new Date(d.lastActiveAt).getTime() < 5 * 60 * 1000 // 5 mins
      );

      if (!hasActiveDevice) {
        await User.findByIdAndUpdate(userId, {
          isOnline: false,
          lastSeenAt: new Date(),
          refreshToken: null, // only clear if no devices left
        });
        userStatusChanged = true;
      } else {
        await User.findByIdAndUpdate(userId, { isOnline: true });
      }
    }

    if (!sessionId && !deviceId) {
      return res.status(400).json({ error: "Either sessionId or deviceId required" });
    }

    res.json({
      message: "Logged out successfully",
      userStatusChanged,
    });
  } catch (error) {
    console.error("Logout error:", error);
    res.status(500).json({ error: error.message });
  }
};












