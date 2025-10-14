// utils/sendMail.js
const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.MAIL_USER,
    pass: process.env.MAIL_PASS,
  },
});

/**
 * Send mail. Accepts attachments array in same shape as Nodemailer.
 * @param {{to:string, subject:string, html:string, attachments?:Array}} opts
 */
const sendMail = async ({ to, subject, html, attachments = [] }) => {
  const mailOptions = {
    from: `"Prithu" <${process.env.MAIL_USER}>`,
    to,
    subject,
    html,
    attachments,
  };

  const info = await transporter.sendMail(mailOptions);
  console.log("Email sent:", info.messageId);
  return info;
};

const sendMailSafeSafe = async ({ to, subject, html, attachments = [] }) => {
  if (!to) {
    console.warn("Email not sent: 'to' address is missing");
    return;
  }
  try {
    return await sendMail({ to, subject, html, attachments });
  } catch (err) {
    console.error("Failed to send email:", err);
  }
};

module.exports = { sendMail, sendMailSafeSafe };
