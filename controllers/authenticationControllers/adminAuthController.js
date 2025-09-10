const Admin = require('../../models/adminModels/adminModel');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');
require('dotenv').config();
const bcrypt = require('bcrypt');
const otpStore=new Map();
const ChildAdmin=require('../../models/childAdminModel')


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
    const parentAdminId = req.Id||null; // from auth middleware (always available)

    // ✅ Check if username or email already exists
    const existingUser = await Admin.findOne({
      $or: [{ userName: username }, { email }]
    });
    if (existingUser) {
      return res.status(400).json({
        error:
          existingUser.userName === username
            ? "Username already exists"
            : "Email already registered"
      });
    }

    // ✅ Hash password
    const passwordHash = await bcrypt.hash(password, 10);

    // ✅ Handle Child Admin case
    if (adminType === "Child_Admin") {
      // Generate unique ChildAdminId
      const lastChild = await ChildAdmin.findOne().sort({ createdAt: -1 });
      let newIdNumber = 1;

      if (lastChild?.childAdminId) {
        newIdNumber = parseInt(lastChild.childAdminId.replace("CA", "")) + 1;
      }

      const childAdminId = "CA" + String(newIdNumber).padStart(4, "0"); // e.g. CA0001

      const childAdmin = new ChildAdmin({
        childAdminId,
        inheritedPermissions: [], // default empty permissions
        parentAdminId: parentAdminId || null
      });
      await childAdmin.save()

    // ✅ For Master/Other Admin
    return res.status(201).json({
      message: "Admin registered successfully",
      adminId: childAdmin._id,
      username: childAdmin.userName,
      email: childAdmin.email,
      adminType: childAdmin.adminType
    });
  }
  } catch (error) {
    console.error("Error creating new admin:", error);
    return res.status(500).json({ error: error.message });
  }
};


// Admin Login
exports.adminLogin = async (req, res) => {
  try {
    const { identifier, password } = req.body;
    if (!identifier || !password) {
      return res.status(400).json({ error: "Identifier and password required" });
    }

    // 1️⃣ Try to find in Admin
    let admin = await Admin.findOne({
      $or: [{ userName: identifier }, { email: identifier }]
    });

    let payload = {};

    if (admin) {
      // Validate password
      const isMatch = await bcrypt.compare(password, admin.passwordHash);
      if (!isMatch) return res.status(400).json({ error: "Invalid password" });

      payload = {
        role: admin.adminType,
        userName: admin.userName,
        userId: admin._id
      };

    } else {
      // 2️⃣ Try to find in Child_Admin
      const child = await ChildAdmin.findOne({ email: identifier }).lean();
      if (!child) return res.status(400).json({ error: "Invalid credentials" });

      // Validate password
      const isMatch = await bcrypt.compare(password, child.passwordHash);
      if (!isMatch) return res.status(400).json({ error: "Invalid password" });

      payload = {
        role: "Child_Admin",
        userName: child.userName,
        userId: child.childAdminId
      };
    }

    // 3️⃣ Generate JWT
    const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: "1h" });

    res.json({ token, admin: payload ,role:"Child_Admin"});

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

    const admin = await Admin.findOne({ businessEmail:email });

    if (admin) {
      otpExpires = new Date(Date.now() + 5 * 60 * 1000);
      // Save OTP and expiry on user document
      user.otpCode = tempOtp;
      user.otpExpiresAt = otpExpires;
      await user.save();
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

    transporter.sendMail(mailOptions, (error, info) => {
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
    
    const {  otp } = req.body;
   
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
