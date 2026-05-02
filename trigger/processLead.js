const { task } = require("@trigger.dev/sdk");
const { checkVisitorStatus } = require("../lib/dedup");
const { checkHubspot, createContact } = require("../lib/hubspot");
const { scoreICP } = require("../lib/icp");
const { addToHeyReach } = require("../lib/heyreach");
const { addToInstantly } = require("../lib/instantly");
const { notify } = require("../lib/slack");
const { generateIcebreaker } = require("../lib/ai");
const { applyHotSpike } = require("../lib/visitor");
const { saveFailedLead } = require("../lib/db");

const MIN_SCORE = parseInt(process.env.ICP_MIN_SCORE || "60");

export const processLeadTask = task({
  id: "process-lead",
  retry: {
    maxAttempts: 5,
    minTimeoutInMs: 30000,
    maxTimeoutInMs: 3600000,
    factor: 2,
  },
  run: async (visitor, { ctx }) => {
    console.log(`Starting Workflow for ${visitor.email}`);

    try {
      const { isDuplicate, domainVisits } = await checkVisitorStatus(visitor.email, visitor.companyDomain);
      if (isDuplicate) return { status: "duplicate", email: visitor.email };

      const { isBlocked, contact } = await checkHubspot(visitor.email);
      if (isBlocked) return { status: "hubspot_blocked", email: visitor.email };

      const { score, tier, reasons } = scoreICP(visitor);
      const enrichedVisitor = applyHotSpike(visitor, domainVisits, score);

      if (enrichedVisitor.icpScore < MIN_SCORE) return { status: "low_icp", score: enrichedVisitor.icpScore };

      const icebreaker = await generateIcebreaker(enrichedVisitor);
      enrichedVisitor.icebreaker = icebreaker;

      const [heyreachResult, instantlyResult, hubspotResult] = await Promise.all([
        enrichedVisitor.linkedinUrl ? addToHeyReach(enrichedVisitor) : Promise.resolve({ success: false }),
        addToInstantly(enrichedVisitor),
        createContact(enrichedVisitor)
      ]);

      await notify("hot_lead", enrichedVisitor);

      return {
        success: true,
        actions: { heyreach: heyreachResult, instantly: instantlyResult, hubspot: hubspotResult }
      };

    } catch (error) {
      console.error(`[ERROR] Process lead failed: ${error.message}`);
      await saveFailedLead(visitor, error.message);
      throw error;
    }
  }
});