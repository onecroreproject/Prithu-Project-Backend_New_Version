const fs = require("fs");
const path = require("path");
const { sendMailSafeSafe } = require("./sendMail"); 

/**
 * Sends an email using a HTML template
 * @param {string} templateName - name of the template file (e.g., 'welcome-back.html')
 * @param {string} to - recipient email
 * @param {string} subject - email subject
 * @param {object} placeholders - key-value pairs to replace in template
 */
const sendTemplateEmail = async ({ templateName, to, subject, placeholders = {} }) => {
  try {
    // 1️⃣ Load template
    const templatePath = path.join(__dirname, "../templates", templateName);
    let html = fs.readFileSync(templatePath, "utf-8");

    // 2️⃣ Replace placeholders
    for (const key in placeholders) {
      const regex = new RegExp(`{${key}}`, "g"); // e.g., {username}
      html = html.replace(regex, placeholders[key]);
    }

    // 3️⃣ Send mail
    await sendMailSafeSafe({ to, subject, html });
    console.log(`Template email "${templateName}" sent to ${to}`);
  } catch (err) {
    console.error(`Failed to send template email "${templateName}" to ${to}:`, err);
  }
};

module.exports = { sendTemplateEmail };
