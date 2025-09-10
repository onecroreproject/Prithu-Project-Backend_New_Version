const Business = require('../../models/businessModel');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');
require('dotenv').config();
const bcrypt = require('bcrypt');
const otpStore=new Map();


// Create nodemailer transporter
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.MAIL_USER,
    pass: process.env.MAIL_PASS,
  },
});



// Register New Business
exports.createNewBusinessUser = async (req, res) => {
  try {
    const { username, email, password,} = req.body;

    // Check if userName or email already exists
    if (await Business.findOne({ userName:username })) {
      return res.status(400).json({ error: 'User Name already exists' });
    }
    if (await Business.findOne({ businessEmail:email })) {
      return res.status(400).json({ error: 'Email already registered' });
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 10);

    // Create new business
    const business = new Business({
        userName:username,
      businessEmail:email,
        businessPasswordHash:passwordHash,

    });

    await business.save();

    res.status(201).json({
      message: 'Business registered successfully',
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Business Login
exports.businessLogin = async (req, res) => {
  try {
    const { identifier, password } = req.body;

    // Find business by userName or email
    const business = await Business.findOne({
      $or: [{ userName: identifier }, { businessEmail: identifier }],
    });
    if (!business.userName) {
      return res.status(400).json({ error: 'Invalid userName' });
    }



    if(!business.businessEmail)
    {
        res.status(400).json({error:'Invalid Email'})
    }

    const isMatch = await bcrypt.compare(password, business.businessPasswordHash);

    if (!isMatch) {
      return res.status(400).json({ error: 'Invalid password' });
    }

    const userToken = jwt.sign(
      { userName: business.userName, role: business.role },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );

    res.json({
      token: userToken,
      business: {
        businessId: business._id,
        userName: business.userName,
        role: business.role,
      },
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Request Password Reset OTP
exports.businessSendOtp = async (req, res) => {
    try {
      const { email } = req.body;
  
      if (!email) {
        return res.status(400).json({ error: 'Email is required' });
      }
  
      let tempOtp = Math.floor(100000 + Math.random() * 900000).toString();
      let otpExpires;
  
      const business = await Business.findOne({ businessEmail:email });
  
      if (business) {
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
  

// Verify OTP


exports.newBusinessVerifyOtp = async (req, res) => {
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

exports.existBusinessVerifyOtp= async (req, res) => {
  try {
    
    const {  otp } = req.body;
   
    const business = await Business.findOne({ otpCode:otp });
    if (!business) {
      return res.status(400).json({ error: 'Invalid email or OTP' });
    }

    if (!business.otpCode || !business.otpExpiresAt || business.otpCode !== otp || business.otpExpiresAt < new Date()) {
      return res.status(400).json({ error: 'Invalid or expired OTP' });
    }

    res.json({ message: 'OTP verified successfully',email:business.businessEmail });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Reset Password with OTP
exports.businessPasswordReset = async (req, res) => {
  try {
    const { email,newPassword } = req.body;
    const business = await Business.findOne({ businessEmail:email });
    if (!business) {
      return res.status(400).json({ error: 'Invalid email or OTP' });
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);
    business.businessPasswordHash = passwordHash;

    // Clear OTP fields after successful reset
    business.otpCode = undefined;
    business.otpExpiresAt = undefined;

    await business.save();

    res.json({ message: 'Password reset successful' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
