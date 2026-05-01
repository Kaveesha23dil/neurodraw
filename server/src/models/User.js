/**
 * File-based User Store
 * Persists data to a local JSON file.
 */
const { v4: uuidv4 } = require('uuid');
const fs = require('fs');
const path = require('path');

const DATA_FILE = path.join(__dirname, '../../data/users.json');

// In-memory array acting as our "database"
let users = [];

const loadUsers = () => {
  try {
    if (fs.existsSync(DATA_FILE)) {
      const data = fs.readFileSync(DATA_FILE, 'utf8');
      users = JSON.parse(data);
    } else {
      const dir = path.dirname(DATA_FILE);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(DATA_FILE, JSON.stringify([]));
    }
  } catch (err) {
    console.error('Error loading users:', err);
  }
};

const saveUsers = () => {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(users, null, 2));
  } catch (err) {
    console.error('Error saving users:', err);
  }
};

loadUsers();

/**
 * Create a new user and add to the store.
 * @param {object} userData - { username, email, password (hashed) }
 * @returns {object} The created user (without password)
 */
const createUser = ({ username, email, password }) => {
  const user = {
    id: uuidv4(),
    username,
    email: email.toLowerCase().trim(),
    password, // already hashed before calling this
    createdAt: Date.now(),
  };
  users.push(user);
  saveUsers();
  return sanitizeUser(user);
};

/**
 * Find a user by their email address.
 * @param {string} email
 * @returns {object|undefined}
 */
const findUserByEmail = (email) => {
  return users.find((u) => u.email === email.toLowerCase().trim());
};

/**
 * Find a user by their ID.
 * @param {string} id
 * @returns {object|undefined}
 */
const findUserById = (id) => {
  return users.find((u) => u.id === id);
};

/**
 * Strip the password field before returning user data.
 * @param {object} user
 * @returns {object}
 */
const sanitizeUser = (user) => {
  const { password, ...safe } = user;
  return safe;
};

module.exports = { createUser, findUserByEmail, findUserById, sanitizeUser };
