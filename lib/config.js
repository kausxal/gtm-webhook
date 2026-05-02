module.exports = {
  ICP_MIN_SCORE: parseInt(process.env.ICP_MIN_SCORE || "60"),
  ICP_MIN_EMPLOYEES: parseInt(process.env.ICP_MIN_EMPLOYEES || "10"),
  ICP_MAX_EMPLOYEES: parseInt(process.env.ICP_MAX_EMPLOYEES || "500"),
  ICP_INDUSTRIES: (process.env.ICP_INDUSTRIES || "").split(",").map(i => i.trim().toLowerCase()),
  ICP_TITLES: (process.env.ICP_TITLES || "").split(",").map(t => t.trim().toLowerCase()),

  DEDUP_WINDOW_DAYS: parseInt(process.env.DEDUP_WINDOW_DAYS || "7"),
  HOT_SPIKE_THRESHOLD: 3,
  HOT_SPIKE_BONUS: 25,

  RATE_LIMIT_MAX_REQUESTS: 100,
  RATE_LIMIT_WINDOW_MS: 60000,

  HUBSPOT_TIMEOUT: 10000,
  OPENAI_TIMEOUT: 30000,
  INSTANTLY_TIMEOUT: 10000,

  COMPANY_CACHE_TTL: 86400,
  CONTACT_CACHE_TTL: 3600,

  BLOCKED_LIFECYCLE_STAGES: ["customer", "opportunity", "salesqualifiedlead", "sql"],
};