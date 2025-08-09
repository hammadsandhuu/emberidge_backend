/**
 * Wraps an async function to catch errors and pass them to Express error handler
 * @param {Function} fn - Async function to wrap
 * @returns {Function} - Wrapped function with error handling
 */
module.exports = (fn) => {
  return (req, res, next) => {
    fn(req, res, next).catch((err) => next(err));
  };
};
