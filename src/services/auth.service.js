const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const pool = require('../config/database');
const crypto = require('crypto');
const emailService = require('./email.service');
const createError = require('http-errors');

const JWT_SECRET = process.env.JWT_SECRET || 'supersecretkey';

function getExpectedAdminCode() {
  const expectedCode = process.env.APP_ADMIN_BOOTSTRAP_CODE;

  if (!expectedCode) {
    throw createError(500, 'Admin bootstrap code is not configured');
  }

  return expectedCode;
}

function isValidAdminCode(adminCode) {
  if (!adminCode) return false;

  const expectedCode = getExpectedAdminCode();
  return adminCode === expectedCode;
}

exports.register = async (email, password, username, adminCode = null) => {
  const existingUser = await pool.query(
    'SELECT * FROM users WHERE email = $1',
    [email]
  );

  if (existingUser.rows.length > 0) {
    throw createError(400, 'User already exists');
  }

  const hashedPassword = await bcrypt.hash(password, 10);

  const verificationToken = crypto.randomBytes(32).toString('hex');
  const verificationExpires = new Date(Date.now() + 1000 * 60 * 60);

  const isAppAdmin = adminCode ? isValidAdminCode(adminCode) : false;

  if (adminCode && !isAppAdmin) {
    throw createError(403, 'Invalid admin code');
  }

  const newUser = await pool.query(
    `
    INSERT INTO users 
      (
        email,
        password,
        username,
        email_verification_token,
        email_verification_expires,
        is_app_admin
      )
    VALUES ($1, $2, $3, $4, $5, $6)
    RETURNING id, email, username, role, email_verified, is_app_admin
    `,
    [
      email,
      hashedPassword,
      username,
      verificationToken,
      verificationExpires,
      isAppAdmin,
    ]
  );

  const user = newUser.rows[0];

  await emailService.sendVerificationEmail(email, verificationToken);

  const token = jwt.sign(
    {
      id: user.id,
      role: user.role,
    },
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
    throw createError(401, 'Invalid credentials');
  }

  const user = userResult.rows[0];

  const isMatch = await bcrypt.compare(password, user.password);

  if (!isMatch) {
    throw createError(401, 'Invalid credentials');
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
      is_app_admin: user.is_app_admin,
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

  if (
    !user.email_verification_expires ||
    new Date() > user.email_verification_expires
  ) {
    throw new Error('Verification token expired');
  }

  await pool.query(
    `
    UPDATE users 
    SET email_verified = true,
        email_verification_token = NULL,
        email_verification_expires = NULL
    WHERE id = $1
    `,
    [user.id]
  );

  return 'Email verified successfully';
};

exports.claimAppAdmin = async (email, password, adminCode) => {
  const expectedCode = getExpectedAdminCode();

  if (!adminCode || adminCode !== expectedCode) {
    throw createError(403, 'Invalid admin code');
  }

  const userResult = await pool.query(
    'SELECT * FROM users WHERE email = $1',
    [email]
  );

  if (userResult.rows.length === 0) {
    throw createError(401, 'Invalid credentials');
  }

  const user = userResult.rows[0];

  const isMatch = await bcrypt.compare(password, user.password);

  if (!isMatch) {
    throw createError(401, 'Invalid credentials');
  }

  const updatedResult = await pool.query(
    `
    UPDATE users
    SET is_app_admin = true,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = $1
    RETURNING id, email, username, role, email_verified, is_app_admin
    `,
    [user.id]
  );

  return updatedResult.rows[0];
};