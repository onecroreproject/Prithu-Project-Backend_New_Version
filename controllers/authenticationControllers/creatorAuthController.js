const Creator = require('../../models/creatorModel');
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

// Register New Creator
exports.createNewCreator = async (req, res) => {
  try {
    const { username, email, password,} = req.body;

    // Check if username or email already exists
    if (await Creator.findOne({ userName:username })) {
      return res.status(400).json({ error: 'Username already exists' });
    }
    if (await Creator.findOne({ creatorEmail:email })) {
      return res.status(400).json({ error: 'Email already registered' });
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 10);

    // Create new creator
    const creator = new Creator({
        userName:username,
      creatorEmail:email,
        creatorPasswordHash:passwordHash,

    });

    await creator.save();

    res.status(201).json({
      message: 'Creator registered successfully',
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Creator Login
exports.creatorLogin = async (req, res) => {
  try {
    const { identifier, password } = req.body;
  

    // Find creator by username or email
    const creator = await Creator.findOne({
      $or: [{ userName: identifier }, { creatorEmail: identifier }],
    });
    if (!creator.userName) {
      return res.status(400).json({ error: 'Invalid userName' });
    }



    if(!creator.creatorEmail)
    {
        res.status(400).json({error:'Invalid Email'})
    }

    const isMatch = await bcrypt.compare(password, creator.creatorPasswordHash);

    if (!isMatch) {
      return res.status(400).json({ error: 'Invalid password' });
    }

    const userToken = jwt.sign(
      { userId:creator._id ,userName: creator.userName, role: creator.role },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );

    res.json({
      token: userToken,
      creator: {
        creatorId: creator._id,
        userName: creator.userName,
        role: creator.role,
      },
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};



exports.creatorSendOtp = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    let tempOtp = Math.floor(1000 + Math.random() * 9000).toString();
    let otpExpires;

    const creator = await Creator.findOne({ creatorEmail:email });

    if (creator) {
      otpExpires = new Date(Date.now() + 5 * 60 * 1000);
      // Save OTP and expiry on user document
      user.otpCode = tempOtp;
      user.otpExpiresAt = otpExpires;
      await creator.save();
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
exports.existCreatorVerifyOtp = async (req, res) => {
  try {
  
      const { otp } = req.body;
      
      const creator = await Creator.findOne({ otpCode:otp });
  
     
      if (!creator) {
        return res.status(400).json({ error: 'Invalid email or OTP' });
      }
  
      if (!creator.otpCode || !creator.otpExpiresAt || creator.otpCode !== otp || creator.otpExpiresAt < new Date()) {
        return res.status(400).json({ error: 'Invalid or expired OTP' });
      }
  
      res.json({ message: 'OTP verified successfully',
        email:creator.creatorEmail });
  
      tempOtp='';
      otpExpires='';
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  };

exports.newCreatorVerifyOtp = async (req, res) => {
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


// Reset Password with OTP
exports.creatorPasswordReset = async (req, res) => {
  try {
    const { email,newPassword } = req.body;
    const creator = await Creator.findOne({ creatorEmail:email });
    if (!creator) {
      return res.status(400).json({ error: 'Resend the Otp' });
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);
    creator.creatorPasswordHash = passwordHash;

    // Clear OTP fields after successful reset
    creator.otpCode = undefined;
    creator.otpExpiresAt = undefined;

    await creator.save();

    res.json({ message: 'Password reset successful' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
