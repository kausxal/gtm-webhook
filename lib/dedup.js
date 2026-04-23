const { kv } = require("@vercel/kv");

const WINDOW_DAYS = parseInt(process.env.DEDUP_WINDOW_DAYS || "7");

async function isDuplicate(email) {
  const key = `dedup:${email.toLowerCase().trim()}`;
  const windowSeconds = WINDOW_DAYS * 24 * 60 * 60;

  try {
    // Try to set the key. If it exists (NX), return true.
    // Using SET command with NX (only set if not exists) and EX (expire in seconds)
    const result = await kv.set(key, Date.now(), { nx: true, ex: windowSeconds });
    
    if (result === null) {
      // Key already exists -> Duplicate
      return true;
    }
    
    // Key was newly set -> Not a duplicate
    return false;
  } catch (error) {
    console.error(JSON.stringify({ event: "kv_dedup_error", error: error.message }));
    // If KV fails, default to false so we don't lose the lead
    return false;
  }
}

module.exports = { isDuplicate };
