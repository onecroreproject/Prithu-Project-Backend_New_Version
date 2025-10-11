module.exports = (userName, planName, endDate) => `
  <p>Hi <b>${userName}</b>,</p>
  <p>Your subscription for <b>${planName}</b> is now active.</p>
  <p>It will expire on <b>${endDate}</b>.</p>
  <p>Thank you for subscribing 🎉</p>
`;
