/**
 * Utility functions for consistent error handling across the application
 */

/**
 * Creates a standardized error handler function
 * @param {Response} res - Express response object
 * @param {string} operation - Description of the operation that failed
 * @returns {Function} Error handler function
 */
const handleError = (res, operation) => (error) => {
  console.error(`Error al ${operation}:`, error);
  res.status(500).json({ error: `Error al ${operation}` });
};

/**
 * Handles errors with custom status codes and messages
 * @param {Response} res - Express response object
 * @param {Error} error - The error object
 * @param {string} message - Error message to return to client
 * @param {number} statusCode - HTTP status code (default: 500)
 */
const handleCustomError = (res, error, message, statusCode = 500) => {
  console.error(`${message}:`, error);
  return res.status(statusCode).json({ error: message });
};

module.exports = {
  handleError,
  handleCustomError
};
