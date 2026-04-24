const PORT = process.env.PORT || 5000;
const CLIENT_URL = process.env.CLIENT_URL || '*'; // Update in production to specific frontend URL

module.exports = {
  PORT,
  CLIENT_URL
};
