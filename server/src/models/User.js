/**
 * In-Memory User Store
 * NOTE: Data is lost when the server restarts (no database).
 */
const { v4: uuidv4 } = require('uuid');

// In-memory array acting as our "database"
const users = [];

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
