// ✅ When referrer earns reward
exports.referralRewardReferrerMail = (referrerName, referredUserName, newBalance) => `
  <p>Hi ${referrerName},</p>
  <p>Congratulations! 🎉 You just earned <b>₹25</b> because your referred user <b>${referredUserName}</b> successfully subscribed.</p>
  <p>Your new balance is <b>₹${newBalance}</b>.</p>
  <br/>
  <p>Keep referring and earning rewards!</p>
  <p>— The Team</p>
`;

// ✅ When referred user subscribes
exports.referralRewardUserMail = (userName, referrerName) => `
  <p>Hi ${userName},</p>
  <p>Thank you for subscribing! 🎉 Your referrer <b>${referrerName}</b> has earned <b>₹25</b> because of your subscription.</p>
  <p>Enjoy your benefits and keep supporting each other!</p>
  <br/>
  <p>— The Team</p>
`;

// ✅ When referrer’s subscription expired
exports.referralExpiredReferrerMail = (referrerName, referredUserName, referralCode) => `
  <p>Hello ${referrerName},</p>
  <p>Your referred user <b>${referredUserName}</b> (code: <b>${referralCode}</b>)’s subscription has ended.</p>
  <p>Please remind them to subscribe again to continue earning referral rewards.</p>
  <br/>
  <p>— The Team</p>
`;

// ✅ When referred user’s referral link is reset
exports.referralExpiredUserMail = (userName, referrerName = "your sponsor") => `
  <p>Hello ${userName},</p>
  <p>Your referrer <b>${referrerName}</b>’s subscription has expired.</p>
  <p>Because of this, your referral link has been reset. You can now enter a new referral code to stay connected.</p>
  <br/>
  <p>— The Team</p>
`;


module.exports = (userName, planName, endDate) => `
  <p>Hi <b>${userName}</b>,</p>
  <p>Your subscription for <b>${planName}</b> is now active.</p>
  <p>It will expire on <b>${endDate}</b>.</p>
  <p>Thank you for subscribing 🎉</p>
`;

