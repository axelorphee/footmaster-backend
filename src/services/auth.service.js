const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const pool = require('../config/database');


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

  // Insert user
  const newUser = await pool.query(
    `INSERT INTO users (email, password, username)
     VALUES ($1, $2, $3)
     RETURNING id, email, username, role, email_verified`,
    [email, hashedPassword, username]
  );

  const user = newUser.rows[0];

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
