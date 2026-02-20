const axios = require('axios');

exports.sendVerificationEmail = async (email, token) => {
  const verificationUrl = `https://footmaster-backend.onrender.com/api/auth/verify-email?token=${token}`;

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
        <h2>Welcome to FootMaster ⚽</h2>
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