const User = require('../../models/userModels/userModel');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');
require('dotenv').config();
const bcrypt = require('bcrypt');
const crypto = require("crypto"); 
const { generateReferralCode } = require('../../middlewares/generateReferralCode');
const otpStore=new Map();
const {processReferral}=require('../../middlewares/referralMiddleware/referralCount');
const {startUpProcessCheck}=require('../../middlewares/services/User Services/userStartUpProcessHelper');
const Device = require("../../models/userModels/userSession-Device/deviceModel");
const Session = require("../../models/userModels/userSession-Device/sessionModel");
const UserReferral=require('../../models/userModels/userRefferalModels/userReferralModel');
const { v4: uuidv4 } = require("uuid");
const mongoose =require("mongoose")

// const sessionService = makeSessionService(User,StoreUserDevice);


// Create nodemailer transporter
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.MAIL_USER,
    pass: process.env.MAIL_PASS,
  },
});



/**
 * createNewUser(req, res)
 * - creates user
 * - assigns a unique referral code
 * - atomically increments referrer's usage if referralCode provided (max 2)
 * - places referral via placeReferral (idempotent)
 */

exports.createNewUser = async (req,res) => {
  try {
    const { username, email, password, referralCode } = req.body;
    if (!username || !email || !password) return res.status(400).json({ message: "All fields required" });

    const passwordHash = await bcrypt.hash(password, 10);
    const base = (username.replace(/\s+/g,"").slice(0,3).toUpperCase() || "XXX");
    let generatedCode = `${base}${crypto.randomBytes(2).toString("hex")}`;

    const user = new User({ userName: username, email, passwordHash, referralCode: generatedCode, referralCodeIsValid: false });

    if (referralCode) {
      const parent = await User.findOne({ referralCode, referralCodeIsValid: true });
      if (!parent) return res.status(400).json({ message: "Referral code invalid or used up" });

      user.referredByUserId = parent._id;
      await user.save();

      await UserReferral.updateOne({ parentId: parent._id }, { $addToSet: { childIds: user._id } }, { upsert: true });
    } else {
      await user.save();
    }

    res.status(201).json({ message: "User registered", referralCode: generatedCode });
  } catch(err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};

// On subscription payment success
exports.activateSubscription = async (userId) => {
  await User.findByIdAndUpdate(userId, { $set: { "subscription.isActive": true, referralCodeIsValid: true } });
  await processReferral(userId);
};






// User Login
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
      return res.status(403).json ({error:"User Credencialts are Blocked Please Contact Admin"})
    }

    // 3️⃣ Run startup checks (custom business logic)
    const userStart = await startUpProcessCheck(user._id);

    // 4️⃣ Generate tokens
    const accessToken = jwt.sign(
      {
        userName: user.userName,
        userId: user._id,
        role: user.role,
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

    // 5️⃣ Handle device (create or update)
    const deviceIdentifier = deviceId || uuidv4(); // generate one if not provided
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

    // 8️⃣ Return tokens + session info
    res.json({
      accessToken,
      refreshToken,
      sessionId: session._id,
      deviceId: device.deviceId,
      appLanguage: userStart.appLanguage,
      feedLanguage:userStart.feedLanguage,
      gender:userStart.gender,
    });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ error: error.message });
  }
};


// Request Password Reset OTP
exports.userSendOtp = async (req, res) => {
  
    const email  = req.body.email;

if (!email) {
  return res.status(400).json({ error: 'Email is required' });
}

try {
  let tempOtp = Math.floor(1000 + Math.random() * 9000).toString();
  let otpExpires;
  
  // Find user by email
  const user = await User.findOne({ email });
  
  if (user) {
    // OTP valid for 15 minutes for existing users
    otpExpires = new Date(Date.now() + 5 * 60 * 1000);
    user.otpCode = tempOtp;
    user.otpExpiresAt = otpExpires;
    await user.save();
  } else {
    // For non-registered
    //  users, store in temporary OTP store with 5 minutes expiration
    console.log('non-register user')
    otpExpires = Date.now() + 5 * 60 * 1000;
    otpStore.set(email, { tempOtp, expires: otpExpires });
  }

  // Prepare email options
  const mailOptions = {
    from: process.env.MAIL_USER,
    to: email,
    subject: 'Prithu Password Reset OTP',
    text: `Your OTP for password reset is: ${tempOtp}. It is valid for 15 minutes.`,
  };

  console.log(tempOtp)
  
  // Send email
  transporter.sendMail(mailOptions, (error, info) => {
    if (error) {
      console.error('Error sending OTP email:', error);
      return res.status(500).json({ error: 'Failed to send OTP email' });
    }
    console.log('OTP email sent:', info.response);
    return res.json({ message: 'OTP sent to email' });
  });
} catch (error) {
  res.status(500).json({ error: error.message });
}
}



// Verify OTP
exports.newUserVerifyOtp = async (req, res) => {
  const { otp ,email} = req.body;

  const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      return res.status(400).json({ message: "Email already exists" });
    }

  if (!otp||!email) {
    return res.status(400).json({ error: 'Email and OTP are required' });

  }
   const record = otpStore.get(email);

  if (Date.now() > record.expires) {
    otpStore.delete(email);
    return res.status(400).json({ error: 'OTP has expired' });
  }

  if (record.tempOtp === otp) {
    otpStore.delete(email);
    return res.status(200).json({
      verified: true,
      message: 'OTP verified successfully. You can now register.',
    });
  } else {
    return res.status(400).json({ error: 'Invalid OTP' });
  }
};


exports.existUserVerifyOtp = async (req, res) => {
  try {

    const { otp } = req.body;
    
    const user = await User.findOne({ otpCode:otp });

   
    if (!user) {
      return res.status(400).json({ error: 'Invalid email or OTP' });
    }

    if (!user.otpCode || !user.otpExpiresAt || user.otpCode !== otp || user.otpExpiresAt < new Date()) {
      return res.status(400).json({ error: 'Invalid or expired OTP' });
    }

    res.json({ message: 'OTP verified successfully',
      email:user.email });

    tempOtp='';
    otpExpires='';
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Reset Password with OTP
exports.userPasswordReset = async (req, res) => {
  try {
    const { email,newPassword } = req.body;

    if (!email || !newPassword) {
      return res.status(400).json({ error: 'Email,and New assword are required' });
    }

    const user = await User.findOne({ email });
    // Hash new password securely
    const passwordHash = await bcrypt.hash(newPassword, 10);
    user.passwordHash = passwordHash;

    // Clear OTP fields after successful reset
    user.otpCode = undefined;
    user.otpExpiresAt = undefined;

    await user.save();

    res.json({ message: 'Password reset successful' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};


exports.userLogOut = async (req, res) => {
  try {
    const { userId, deviceId } = req.body;
    if (!userId || !deviceId) {
      return res.status(400).json({ message: "userId and deviceId required" });
    }

    // 1️⃣ Mark the device as logged out
    await Device.findOneAndUpdate(
      { userId, deviceId },
      { lastActiveAt: new Date() },
      { new: true }
    );

    // 2️⃣ Check if user has any active devices
    const activeDevices = await Device.find({ userId });
    const hasActive = activeDevices.some((d) => {
      // Example rule: consider device "active" if lastActiveAt within 5 min
      return Date.now() - new Date(d.lastActiveAt).getTime() < 5 * 60 * 1000;
    });

    // 3️⃣ Update user status
    await User.findByIdAndUpdate(userId, {
      isOnline: hasActive,
      lastSeenAt: hasActive ? null : new Date(),
      ...(hasActive ? {} : { refreshToken: null }), // clear only if no devices left
    });

    res.json({ message: "Logged out successfully" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};



exports.logout = async (req, res) => {
  try {
    const { sessionId } = req.body;
    if (!sessionId) return res.status(400).json({ error: "Session ID required" });

    const session = await Session.findById(sessionId);
    if (!session) return res.status(404).json({ error: "Session not found" });

    // Mark session offline
    session.isOnline = false;
    session.lastSeenAt = new Date();
    await session.save();

    // Check if user has other active sessions
    const activeSessions = await Session.find({ userId: session.userId, isOnline: true });
    if (activeSessions.length === 0) {
      await User.findByIdAndUpdate(session.userId, {
        isOnline: false,
        lastSeenAt: new Date(),
      });
    }

    res.json({ message: "Logged out successfully" });
  } catch (error) {
    console.error("Logout error:", error);
    res.status(500).json({ error: error.message });
  }
};







