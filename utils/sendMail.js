const nodemailer = require('nodemailer');

// Create transporter using environment variables
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.MAIL_USER,
    pass: process.env.MAIL_PASS, 
  },
});

console.log("Mail sender:", process.env.MAIL_USER);

const sendMail = async ({ to, subject, html }) => {
   
  const info = await transporter.sendMail({
    from: process.env.MAIL_USER,
    to,
    subject,
    html,
  });
  console.log('Email sent:', info.messageId);
  return info;
};

// ✅ Safe wrapper to prevent "No recipients defined"
const sendMailSafeSafe= async ({ to, subject, html }) => {
  if (!to) {
    console.warn("Email not sent: 'to' address is missing");
    return;
  }
  console.log({to,subject,html})
  try {
    return await sendMail({ to, subject, html });
  } catch (err) {
    console.error("Failed to send email:", err);
  }
};

module.exports = {sendMail , sendMailSafeSafe };
