const axios = require('axios');

exports.sendVerificationEmail = async (email, token, type = 'register') => {
  let verificationUrl;

  if (type === 'email-change') {
    verificationUrl = `https://footmaster-backend.onrender.com/api/account/confirm-email-change?token=${token}`;
  } else {
    verificationUrl = `https://footmaster-backend.onrender.com/api/auth/verify-email?token=${token}`;
  }

  await axios.post(
    'https://api.mailersend.com/v1/email',
    {
      from: {
        email: "no-reply@test-86org8ede00gew13.mlsender.net",
        name: "FootMaster"
      },
      to: [
        {
          email: email
        }
      ],
      subject: "Verify your email",
      html: `
        <h2>FootMaster ⚽</h2>
        <p>Click below to verify:</p>
        <a href="${verificationUrl}">Verify Email</a>
        <p>This link expires in 1 hour.</p>
      `
    },
    {
      headers: {
        Authorization: `Bearer ${process.env.MAILERSEND_API_KEY}`,
        'Content-Type': 'application/json'
      }
    }
  );
};

exports.sendCustomEmail = async (email, subject, html) => {
  await axios.post(
    'https://api.mailersend.com/v1/email',
    {
      from: {
        email: "no-reply@test-86org8ede00gew13.mlsender.net",
        name: "FootMaster"
      },
      to: [{ email }],
      subject,
      html
    },
    {
      headers: {
        Authorization: `Bearer ${process.env.MAILERSEND_API_KEY}`,
        'Content-Type': 'application/json'
      }
    }
  );
};