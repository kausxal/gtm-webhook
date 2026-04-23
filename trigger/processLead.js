const { task } = require("@trigger.dev/sdk/v3");
const { checkVisitorStatus } = require("../lib/dedup");
const { checkHubspot, createContact } = require("../lib/hubspot");
const { scoreICP } = require("../lib/icp");
const { addToHeyReach } = require("../lib/heyreach");
const { addToInstantly } = require("../lib/instantly");
const { notify } = require("../lib/slack");
const { generateIcebreaker } = require("../lib/ai");

const MIN_SCORE = parseInt(process.env.ICP_MIN_SCORE || "60");

export const processLeadTask = task({
  id: "process-lead",
  retry: {
    maxAttempts: 5,         // The Circuit Breaker: Retries up to 5 times if an API fails
    minTimeoutInMs: 30000,  // Wait 30 seconds before first retry
    maxTimeoutInMs: 3600000, // Max wait time 1 hour between retries
    factor: 2,              // Exponential backoff (30s -> 60s -> 120s)
  },
  run: async (visitor, { ctx }) => {
    console.log(`Starting Workflow for ${visitor.email}`);

    // Gate 1: Dedup
    const { isDuplicate, domainVisits } = await checkVisitorStatus(visitor.email, visitor.companyDomain);
    if (isDuplicate) return { status: "duplicate", email: visitor.email };

    // Gate 2: Hubspot
    const { isBlocked, contact } = await checkHubspot(visitor.email);
    if (isBlocked) return { status: "hubspot_blocked", email: visitor.email };

    // Gate 3: Score
    const { score, tier, reasons } = scoreICP(visitor);
    visitor.isHotSpike = domainVisits >= 3;
    if (visitor.isHotSpike) {
       visitor.icpScore = score + 25;
       visitor.leadTier = "hot";
    } else {
       visitor.icpScore = score;
       visitor.leadTier = tier;
    }

    if (visitor.icpScore < MIN_SCORE) return { status: "low_icp", score };

    // Generate AI Icebreaker
    visitor.icebreaker = await generateIcebreaker(visitor);

    // Execute API calls. If ANY of these fail (e.g. rate limit),
    // Trigger.dev catches the error and automatically schedules a retry!
    const [heyreachResult, instantlyResult, hubspotResult] = await Promise.all([
      visitor.linkedinUrl ? addToHeyReach(visitor) : Promise.resolve({ success: false }),
      addToInstantly(visitor),
      createContact(visitor)
    ]);

    await notify("hot_lead", visitor);

    return { 
      success: true, 
      actions: { heyreach: heyreachResult, instantly: instantlyResult, hubspot: hubspotResult }
    };
  }
});
