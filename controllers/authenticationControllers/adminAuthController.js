const Admin = require('../../models/adminModels/adminModel');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');
require('dotenv').config();
const bcrypt = require('bcrypt');
const otpStore=new Map();
const ChildAdmin=require('../../models/childAdminModel');
const ProfileSettings=require("../../models/profileSettingModel");


// Create nodemailer transporter
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.MAIL_USER,
    pass: process.env.MAIL_PASS,
  },
});

// Register New Admin
exports.newAdmin = async (req, res) => {
  try {
    const { username, email, password, adminType } = req.body;
    const parentAdminId = req.Id || null;

    if (!username || !email || !password || !adminType) {
      return res.status(400).json({ error: "All fields are required" });
    }

    // ✅ 1. Check for existing user (both Admin & ChildAdmin)
    const [existingAdmin, existingChild] = await Promise.all([
      Admin.findOne({ $or: [{ userName: username }, { email }] }).lean(),
      ChildAdmin.findOne({ $or: [{ userName: username }, { email }] }).lean(),
    ]);

    if (existingAdmin || existingChild) {
      const duplicate = existingAdmin || existingChild;
      return res.status(400).json({
        error:
          duplicate.userName === username
            ? "Username already exists"
            : "Email already registered",
      });
    }

    // ✅ 2. Hash password once (avoid repeating bcrypt)
    const passwordHash = await bcrypt.hash(password, 10);

    let createdAdmin, profilePayload;

    // ✅ 3. Handle Child_Admin creation
    if (adminType === "Child_Admin") {
      const lastChild = await ChildAdmin.findOne({}, { childAdminId: 1 })
        .sort({ createdAt: -1 })
        .lean();

      const newIdNumber = lastChild?.childAdminId
        ? parseInt(lastChild.childAdminId.replace("CA", "")) + 1
        : 1;
      const childAdminId = "CA" + String(newIdNumber).padStart(4, "0");

      createdAdmin = await ChildAdmin.create({
        childAdminId,
        userName: username,
        email,
        passwordHash,
        adminType,
        parentAdminId,
        createdBy: parentAdminId,
      });

      profilePayload = { childAdminId: createdAdmin._id };
    } else {
      // ✅ 4. Handle Master/Super Admin creation
      createdAdmin = await Admin.create({
        userName: username,
        email,
        passwordHash,
        adminType,
      });

      profilePayload = { adminId: createdAdmin._id };
    }

    // ✅ 5. Create ProfileSettings (no need for await if not required immediately)
    ProfileSettings.create({
      ...profilePayload,
      userName: username,
      displayName: username,
    }).catch((err) => console.error("Profile creation failed:", err));

    // ✅ 6. Return clean response
    return res.status(201).json({
      message: `${adminType} registered successfully`,
      admin: {
        id: createdAdmin._id,
        username: createdAdmin.userName,
        email: createdAdmin.email,
        adminType: createdAdmin.adminType,
        ...(createdAdmin.childAdminId && {
          childAdminId: createdAdmin.childAdminId,
        }),
      },
    });
  } catch (error) {
    console.error("❌ Error creating new admin:", error);
    return res.status(500).json({ error: "Internal Server Error" });
  }
};


// Admin Login
exports.adminLogin = async (req, res) => {
  try {
    const { identifier, password } = req.body;
    if (!identifier || !password)
      return res.status(400).json({ error: "Identifier and password required" });

    let payload = {};
    let grantedPermissions = [];

    // 1️⃣ Check Admin collection
    const admin = await Admin.findOne({
      $or: [{ userName: identifier }, { email: identifier }],
    });

    if (admin) {
      const isMatch = await bcrypt.compare(password, admin.passwordHash);
      if (!isMatch) return res.status(400).json({ error: "Invalid password" });

      payload = {
        role: "Admin",
        userName: admin.userName,
        userId: admin._id.toString(),
      };
      // Admins have all permissions
      grantedPermissions = ["ALL"];
    } else {
      // 2️⃣ Check Child Admin collection
      const child = await ChildAdmin.findOne({ email: identifier }).lean();
      if (!child) return res.status(400).json({ error: "Invalid credentials" });

      const isMatch = await bcrypt.compare(password, child.passwordHash);
      if (!isMatch) return res.status(400).json({ error: "Invalid password" });

      payload = {
        role: "Child_Admin",
        userName: child.userName,
        userId: child._id.toString(),
        adminCode:child.childAdminId,
      };

      // Get granted permissions from child admin
      grantedPermissions = child.grantedPermissions || [];
    }

    // 3️⃣ Generate JWT
    const token = jwt.sign(
      { ...payload, grantedPermissions },
      process.env.JWT_SECRET,
      { expiresIn: "1d" }
    );

    res.json({
      token,
      admin: payload,
      grantedPermissions, // send granted permissions to frontend
    });
  } catch (error) {
    console.error("Admin login error:", error);
    res.status(500).json({ error: error.message });
  }
};


// Request Password Reset OTP
exports.adminSendOtp = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    let tempOtp = Math.floor(1000 + Math.random() * 9000).toString();
    let otpExpires;

    const admin = await Admin.findOne({ email:email });

    if (admin) {
      otpExpires = new Date(Date.now() + 5 * 60 * 1000);
      // Save OTP and expiry on user document
      admin.otpCode = tempOtp;
      admin.otpExpiresAt = otpExpires;
      await admin.save();
    } else {
      otpExpires = Date.now() + 5 * 60 * 1000;
      // Store OTP and expiration for this email in otpStore
      otpStore.set(email, { tempOtp, expires: otpExpires });
    }

    // Send OTP email
    const mailOptions = {
      from: process.env.MAIL_USER,
      to: email,
      subject: 'Prithu Password Reset OTP',
      text: `Your OTP for password reset is: ${tempOtp}. It is valid for 15 minutes.`,
    };

    console.log(tempOtp)

    transporter.sendMailSafe(mailOptions, (error, info) => {
      if (error) {
        console.error('Error sending OTP email:', error);
        return res.status(500).json({ error: 'Failed to send OTP email' });
      } else {
        console.log('OTP email sent:', info.response);
        return res.json({ message: 'OTP sent to email' });
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};


exports.newAdminVerifyOtp = async (req, res) => {
    const { otp,email } = req.body;

  if (!otp||!email) {
    return res.status(400).json({ error: 'Email and OTP are required' });
  }

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

// Verify OTP
exports.existAdminVerifyOtp = async (req, res) => {
  try {
    
    const { otp } = req.body;
    console.log(otp)
   
    const admin = await Admin.findOne({ otpCode:otp });
    if (!admin) {
      return res.status(400).json({ error: 'Invalid email or OTP' });
    }

    if (!admin.otpCode || !admin.otpExpiresAt || admin.otpCode !== otp || admin.otpExpiresAt < new Date()) {
      return res.status(400).json({ error: 'Invalid or expired OTP' });
    }

    res.json({ message: 'OTP verified successfully',email:admin.email });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};



// Reset Password with OTP
exports.adminPasswordReset = async (req, res) => {
  try {
    const { email, newPassword } = req.body;
    const admin = await Admin.findOne({ email:email });
    if (!admin) {
      return res.status(400).json({ error: 'Invalid email' });
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);
    admin.passwordHash = passwordHash;

    // Clear OTP fields after successful reset
    admin.otpCode = undefined;
    admin.otpExpiresAt = undefined;

    await admin.save();

    res.json({ message: 'Password reset successful' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};




// controllers/adminAuthController.js
exports.verifyToken = async (req, res) => {
  try {
    // values set by your auth middleware
    const role = req.role;
    const id = req.Id;
    const userName = req.userName;

    if (!id || !role || !userName) {
      return res.status(401).json({ error: "Admin not found or token invalid" });
    }

    return res.status(200).json({
      message: "Token verified successfully",
      admin: {
        id,
        role,
        userName,
      },
    });
  } catch (err) {
    console.error("Verify token error:", err);
    return res.status(401).json({ error: "Invalid or expired token" });
  }
};

