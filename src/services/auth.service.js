const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const pool = require('../config/database');
const crypto = require('crypto');
const emailService = require('./email.service');


const JWT_SECRET = process.env.JWT_SECRET || 'supersecretkey';

exports.register = async (email, password, username) => {
  // Vérifier si l'utilisateur existe déjà
  const existingUser = await pool.query(
    'SELECT * FROM users WHERE email = $1',
    [email]
  );

  if (existingUser.rows.length > 0) {
    throw new Error('User already exists');
  }

  // Hash password
  const hashedPassword = await bcrypt.hash(password, 10);

  // Generate email verification token
const verificationToken = crypto.randomBytes(32).toString('hex');
const verificationExpires = new Date(Date.now() + 1000 * 60 * 60); // 1 hour

  // Insert user
  const newUser = await pool.query(
  `INSERT INTO users 
   (email, password, username, email_verification_token, email_verification_expires)
   VALUES ($1, $2, $3, $4, $5)
   RETURNING id, email, username, role, email_verified`,
  [email, hashedPassword, username, verificationToken, verificationExpires]
);

  const user = newUser.rows[0];
  await emailService.sendVerificationEmail(email, verificationToken);

  // Generate JWT
  const token = jwt.sign(
    { id: user.id, role: user.role },
    JWT_SECRET,
    { expiresIn: '7d' }
  );

  return {
    user,
    token,
  };
};

exports.login = async (email, password) => {
  const userResult = await pool.query(
    'SELECT * FROM users WHERE email = $1',
    [email]
  );

  if (userResult.rows.length === 0) {
    throw new Error('Invalid credentials');
  }

  const user = userResult.rows[0];

  const isMatch = await bcrypt.compare(password, user.password);

  if (!isMatch) {
    throw new Error('Invalid credentials');
  }

  const token = jwt.sign(
    {
      id: user.id,
      role: user.role,
      email_verified: user.email_verified,
    },
    JWT_SECRET,
    { expiresIn: '7d' }
  );

  return {
    user: {
      id: user.id,
      email: user.email,
      username: user.username,
      role: user.role,
      email_verified: user.email_verified,
    },
    token,
  };
};

exports.verifyEmail = async (token) => {
  const userResult = await pool.query(
    'SELECT * FROM users WHERE email_verification_token = $1',
    [token]
  );

  if (userResult.rows.length === 0) {
    throw new Error('Invalid verification token');
  }

  const user = userResult.rows[0];

  if (!user.email_verification_expires || new Date() > user.email_verification_expires) {
    throw new Error('Verification token expired');
  }

  await pool.query(
    `UPDATE users 
     SET email_verified = true,
         email_verification_token = NULL,
         email_verification_expires = NULL
     WHERE id = $1`,
    [user.id]
  );

  return 'Email verified successfully';
};