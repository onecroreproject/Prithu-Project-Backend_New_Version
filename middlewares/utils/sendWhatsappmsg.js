const axios = require("axios");

exports.sendWhatsAppJobImage = async ({ number, imageName, jobTitle, jobUrl }) => {

  const phoneId = process.env.WHATSAPP_PHONE_ID;
  const token = process.env.WHATSAPP_ACCESS_TOKEN;

  const url = `https://graph.facebook.com/v20.0/${phoneId}/messages`;

  return axios.post(
    url,
    {
      messaging_product: "whatsapp",
      to: number,
      type: "image",
      image: {
        link: `${process.env.BASE_URL}/uploads/jobs/${imageName}`,
        caption: `🎉 *Your Job is Approved!* 🎉

*${jobTitle}* is now live.

🔗 Apply Here:
${jobUrl}

Thank you for posting with us!`
      }
    },
    {
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      }
    }
  );
};
