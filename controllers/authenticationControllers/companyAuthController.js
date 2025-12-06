const Company = require("../../models/Job/CompanyModel/companyLoginSchema");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
// Temporary OTP store (new registrations)
const tempOtpStore = {}; 



// Helper: Generate 4-digit OTP
const generateOTP = () => Math.floor(1000 + Math.random() * 9000).toString();

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
    const { email, password, name, position, phone, companyName, companyEmail,whatsAppNumber } = req.body;

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
      whatsAppNumber,
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



exports.sendOtp = async (req, res) => {
  try {
    const { email } = req.body;

    const otp = generateOTP();
    const expiry = Date.now() + 5 * 60 * 1000; // 5 minutes

    // --------------- CHECK DB FIRST (EXISTING COMPANY) ---------------
    const company = await Company.findOne({ email });

    if (company) {
      // Save OTP inside company login document
      company.otp = otp;
      company.otpExpiry = expiry;
      await company.save();

      console.log("📨 OTP (Existing User):", otp);

      return res.json({
        success: true,
        message: "OTP sent successfully.",
        otp // remove in production
      });
    }

    // --------------- NEW USER → STORE OTP IN TEMP ---------------
    tempOtpStore[email] = {
      otp,
      expiry
    };

    console.log("📨 OTP (New Registration):", otp);

    return res.json({
      success: true,
      message: "OTP sent successfully.",
      otp // remove in production
    });

  } catch (error) {
    console.error("❌ Send OTP Error:", error);
    return res.status(500).json({
      success: false,
      error: "Error sending OTP"
    });
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

    // --------------- CHECK DB FIRST ---------------
    const company = await Company.findOne({ email });

    if (company) {
      // Compare OTP
      if (company.otp !== otp) {
        return res.status(400).json({
          success: false,
          message: "Invalid OTP"
        });
      }

      if (company.otpExpiry < Date.now()) {
        return res.status(400).json({
          success: false,
          message: "OTP Expired"
        });
      }

      // Mark Verified
      company.isVerified = true;
      company.otp = null;
      company.otpExpiry = null;
      await company.save();

      return res.json({
        success: true,
        message: "OTP verified successfully (existing user)."
      });
    }

    // --------------- CHECK TEMP OTP (NEW USER) ---------------
    const tempOtpData = tempOtpStore[email];

    if (!tempOtpData) {
      return res.status(404).json({
        success: false,
        message: "No OTP found for this email"
      });
    }

    // Validate OTP
    if (tempOtpData.otp !== otp) {
      return res.status(400).json({
        success: false,
        message: "Invalid OTP"
      });
    }

    if (tempOtpData.expiry < Date.now()) {
      delete tempOtpStore[email];
      return res.status(400).json({
        success: false,
        message: "OTP expired"
      });
    }

    // OTP correct → allow registration to continue
    delete tempOtpStore[email];

    return res.json({
      success: true,
      message: "OTP verified successfully (new user)."
    });

  } catch (error) {
    console.error("❌ Verify OTP Error:", error);
    return res.status(500).json({
      success: false,
      error: "Error verifying OTP"
    });
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
    const allowedFields = ["email", "companyEmail","companyName", "name", "phone"];

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
