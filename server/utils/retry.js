/**
 * Retry utility for handling transient failures
 */

/**
 * Retries an async function with exponential backoff
 * @param {Function} fn - Async function to retry
 * @param {Object} options - Retry options
 * @param {number} options.maxRetries - Maximum number of retries (default: 3)
 * @param {number} options.initialDelay - Initial delay in ms (default: 1000)
 * @param {number} options.maxDelay - Maximum delay in ms (default: 10000)
 * @param {Function} options.shouldRetry - Function to determine if error should be retried
 * @returns {Promise} Result of the function
 */
const retryWithBackoff = async (fn, options = {}) => {
  const {
    maxRetries = 3,
    initialDelay = 1000,
    maxDelay = 10000,
    shouldRetry = () => true,
  } = options;

  let lastError;
  let delay = initialDelay;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      // Don't retry if we've exhausted attempts or if shouldRetry returns false
      if (attempt === maxRetries || !shouldRetry(error)) {
        throw error;
      }

      // Wait before retrying with exponential backoff
      if (attempt < maxRetries) {
        await new Promise((resolve) => setTimeout(resolve, delay));
        delay = Math.min(delay * 2, maxDelay);
      }
    }
  }

  throw lastError;
};

/**
 * Creates a rate limiter that ensures operations don't exceed a certain rate
 */
const createRateLimiter = (maxOperations, timeWindow) => {
  const operations = [];
  const timeWindowMs = timeWindow * 1000;

  return async () => {
    const now = Date.now();

    // Remove operations outside the time window
    while (operations.length > 0 && operations[0] < now - timeWindowMs) {
      operations.shift();
    }

    // If we've hit the limit, wait until the oldest operation expires
    if (operations.length >= maxOperations) {
      const waitTime = operations[0] + timeWindowMs - now;
      if (waitTime > 0) {
        await new Promise((resolve) => setTimeout(resolve, waitTime));
        return createRateLimiter(maxOperations, timeWindow)();
      }
    }

    // Record this operation
    operations.push(Date.now());
  };
};

module.exports = {
  retryWithBackoff,
  createRateLimiter,
};
