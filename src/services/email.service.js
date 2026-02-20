const { Resend } = require('resend');

const resend = new Resend(process.env.RESEND_API_KEY);

exports.sendVerificationEmail = async (email, token) => {
  const verificationUrl = `https://footmaster-backend.onrender.com/api/auth/verify-email?token=${token}`;

  await resend.emails.send({
    from: 'FootMaster <onboarding@resend.dev>',
    to: email,
    subject: 'Verify your email address',
    html: `
      <h2>Welcome to FootMaster ⚽</h2>
      <p>Please verify your email by clicking the button below:</p>
      <a href="${verificationUrl}" style="
        display:inline-block;
        padding:10px 20px;
        background-color:#28a745;
        color:white;
        text-decoration:none;
        border-radius:5px;
      ">Verify Email</a>
      <p>This link expires in 1 hour.</p>
    `,
  });
};