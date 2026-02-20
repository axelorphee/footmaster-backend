const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 587,
  secure: false, // important pour 587
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
  tls: {
    rejectUnauthorized: false,
  },
});

exports.sendVerificationEmail = async (email, token) => {
  console.log("📧 Sending verification email to:", email);

  const verificationUrl = `https://footmaster-backend.onrender.com/api/auth/verify-email?token=${token}`;

  const mailOptions = {
    from: `"FootMaster ⚽" <${process.env.EMAIL_USER}>`,
    to: email,
    subject: 'Verify your email address',
    html: `
      <h2>Welcome to FootMaster ⚽</h2>
      <p>Please verify your email by clicking below:</p>
      <a href="${verificationUrl}">Verify Email</a>
      <p>This link expires in 1 hour.</p>
    `,
  };

  const info = await transporter.sendMail(mailOptions);

  console.log("📨 Email sent:", info.response);
};