const { kv } = require("@vercel/kv");

const WINDOW_DAYS = parseInt(process.env.DEDUP_WINDOW_DAYS || "7");

async function checkVisitorStatus(email, domain) {
  const windowSeconds = WINDOW_DAYS * 24 * 60 * 60;
  
  try {
    // 1. Standard Deduplication by Email
    const dedupKey = `dedup:${email.toLowerCase().trim()}`;
    const isNew = await kv.set(dedupKey, Date.now(), { nx: true, ex: windowSeconds });
    
    // 2. Track "Hot Spikes" by Company Domain
    let domainVisits = 0;
    if (domain) {
      const domainKey = `visits:${domain.toLowerCase().trim()}`;
      // Increment the domain visit count
      domainVisits = await kv.incr(domainKey);
      
      // If it's the very first visit, set an expiration (reset counts every 30 days)
      if (domainVisits === 1) {
        await kv.expire(domainKey, 30 * 24 * 60 * 60); // 30 days
      }
    }

    return {
      isDuplicate: isNew === null,
      domainVisits: domainVisits
    };
  } catch (error) {
    console.error(JSON.stringify({ event: "kv_error", error: error.message }));
    // If KV fails, default to false so we don't lose the lead
    return { isDuplicate: false, domainVisits: 1 };
  }
}

module.exports = { checkVisitorStatus };
