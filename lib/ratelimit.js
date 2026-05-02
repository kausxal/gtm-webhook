const crypto = require("crypto");

/**
 * Verify webhook signature (HMAC-SHA256)
 * @param {string} payload - Raw request body
 * @param {string} signature - Header value
 * @param {string} secret - Webhook secret
 * @returns {boolean}
 */
function verifySignature(payload, signature, secret) {
  if (!signature || !secret) return false;

  const hmac = crypto.createHmac("sha256", secret);
  const digest = hmac.update(payload, "utf8").digest("hex");

  return `sha256=${digest}` === signature;
}

/**
 * Simple in-memory rate limiter
 */
const rateLimitStore = new Map();

/**
 * @param {string} key - Identifier (IP, email, etc)
 * @param {number} maxRequests - Max requests allowed
 * @param {number} windowMs - Time window in milliseconds
 * @returns {{allowed: boolean, remaining: number, resetAt: number}}
 */
function checkRateLimit(key, maxRequests = 100, windowMs = 60000) {
  const now = Date.now();
  const record = rateLimitStore.get(key);

  if (!record || now > record.resetAt) {
    rateLimitStore.set(key, {
      count: 1,
      resetAt: now + windowMs,
    });
    return { allowed: true, remaining: maxRequests - 1, resetAt: now + windowMs };
  }

  if (record.count >= maxRequests) {
    return { allowed: false, remaining: 0, resetAt: record.resetAt };
  }

  record.count++;
  return { allowed: true, remaining: maxRequests - record.count, resetAt: record.resetAt };
}

setInterval(() => {
  const now = Date.now();
  for (const [key, value] of rateLimitStore.entries()) {
    if (now > value.resetAt) {
      rateLimitStore.delete(key);
    }
  }
}, 5 * 60 * 1000);

module.exports = {
  verifySignature,
  checkRateLimit,
};