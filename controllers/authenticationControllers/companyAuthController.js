const Company = require("../../models/Job/CompanyModel/companyLoginSchema");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");


// Helper: Generate 6-digit OTP
const generateOTP = () => Math.floor(100000 + Math.random() * 900000).toString();

// Helper: Generate JWT
const generateToken = (companyId) => {
  return jwt.sign({ companyId }, process.env.JWT_SECRET, { expiresIn: "7d" });
};

/**
 * =====================================
 *              REGISTER
 * =====================================
 */
exports.registerCompany = async (req, res) => {
  try {
    const { email, password, name, position, phone, companyName, companyEmail } = req.body;

    // Check existing account
    const existing = await Company.findOne({ email });
    if (existing) {
      return res.status(400).json({ success: false, message: "Email already exists" });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 12);

    // Create OTP
    const otp = generateOTP();

    const newCompany = await Company.create({
      email,
      password: hashedPassword,
      name,
      position,
      phone,
      companyName,
      companyEmail,
      otp,
      otpExpiry: Date.now() + 5 * 60 * 1000 // 5 minutes
    });

    res.status(201).json({
      success: true,
      message: "Company registered. OTP sent for verification.",
      otp, // ⚠️ In production, don't send OTP directly—send via SMS/email
      companyId: newCompany._id
    });

  } catch (error) {
    console.error("❌ Register Error:", error);
    res.status(500).json({ success: false, error: "Server error during registration" });
  }
};

/**
 * =====================================
 *              SEND OTP AGAIN
 * =====================================
 */
exports.sendOtpAgain = async (req, res) => {
  try {
    const { email } = req.body;

    const company = await Company.findOne({ email });
    if (!company) {
      return res.status(404).json({ success: false, message: "Company not found" });
    }

    const otp = generateOTP();
    company.otp = otp;
    company.otpExpiry = Date.now() + 5 * 60 * 1000;
    await company.save();

    res.json({
      success: true,
      message: "OTP sent again.",
      otp // send via SMS/Email in production
    });
  } catch (error) {
    console.error("❌ Send OTP Error:", error);
    res.status(500).json({ success: false, error: "Error sending OTP" });
  }
};

/**
 * =====================================
 *              VERIFY OTP
 * =====================================
 */
exports.verifyOtp = async (req, res) => {
  try {
    const { email, otp } = req.body;

    const company = await Company.findOne({ email });
    if (!company) {
      return res.status(404).json({ success: false, message: "Company not found" });
    }

    if (company.otp !== otp) {
      return res.status(400).json({ success: false, message: "Invalid OTP" });
    }

    if (company.otpExpiry < Date.now()) {
      return res.status(400).json({ success: false, message: "OTP expired" });
    }

    company.isVerified = true;
    company.otp = null;
    company.otpExpiry = null;
    await company.save();

    res.json({
      success: true,
      message: "OTP verified successfully."
    });

  } catch (error) {
    console.error("❌ Verify OTP Error:", error);
    res.status(500).json({ success: false, error: "Error verifying OTP" });
  }
};

/**
 * =====================================
 *              LOGIN
 * =====================================
 */
exports.loginCompany = async (req, res) => {
  try {
    const { email, password } = req.body;

    const company = await Company.findOne({ email });
    if (!company) {
      return res.status(404).json({ success: false, message: "Invalid email" });
    }

    if (!company.isVerified) {
      return res.status(403).json({ success: false, message: "Account not verified. Please verify OTP." });
    }

    const isMatch = await bcrypt.compare(password, company.password);
    if (!isMatch) {
      return res.status(400).json({ success: false, message: "Invalid  password" });
    }

    const token = generateToken(company._id);

    res.json({
      success: true,
      message: "Login successful",
      token,
      company: {
        id: company._id,
        email: company.email,
        name: company.name,
        position: company.position,
        companyName: company.companyName
      }
    });

  } catch (error) {
    console.error("❌ Login Error:", error);
    res.status(500).json({ success: false, error: "Login error" });
  }
};

/**
 * =====================================
 *           RESET PASSWORD
 * =====================================
 */
exports.resetPassword = async (req, res) => {
  try {
    const { email, newPassword } = req.body;

    const company = await Company.findOne({ email });
    if (!company) {
      return res.status(404).json({ success: false, message: "Company not found" });
    }

    // Check if password is same as old one
    const isSame = await bcrypt.compare(newPassword, company.password);
    if (isSame) {
      return res.status(400).json({
        success: false,
        message: "New password cannot be same as old password"
      });
    }

    // Hash new password
    const hashed = await bcrypt.hash(newPassword, 12);
    company.password = hashed;

    await company.save();

    res.json({
      success: true,
      message: "Password reset successfully"
    });

  } catch (error) {
    console.error("❌ Reset Password Error:", error);
    res.status(500).json({ success: false, error: "Error resetting password" });
  }
};




exports.checkAvailability = async (req, res) => {
  try {
    const { field, value } = req.query;

    if (!field || !value) {
      return res.status(400).json({
        success: false,
        message: "field and value are required",
      });
    }

    // allowed fields
    const allowedFields = ["email", "companyName", "name", "phone"];

    if (!allowedFields.includes(field)) {
      return res.status(400).json({
        success: false,
        message: "Invalid field type",
      });
    }

    // dynamic query
    const query = {};
    query[field] = value;

    const exists = await Company.findOne(query).lean();

    res.json({
      success: true,
      field,
      value,
      available: !exists, // true → available, false → already taken
    });

  } catch (error) {
    console.error("❌ Availability Check Error:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};
