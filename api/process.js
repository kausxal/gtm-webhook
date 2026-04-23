const { isDuplicate } = require("../lib/dedup");
const { checkHubspot, createContact } = require("../lib/hubspot");
const { scoreICP } = require("../lib/icp");
const { addToHeyReach } = require("../lib/heyreach");
const { addToInstantly } = require("../lib/instantly");
const { notify } = require("../lib/slack");

const MIN_SCORE = parseInt(process.env.ICP_MIN_SCORE || "60");

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  // Security: Verify the secret passed by our main webhook via QStash
  const secret = req.query.secret;
  if (secret !== process.env.RB2B_SECRET) {
    return res.status(401).json({ error: "Unauthorized worker call" });
  }

  const body = req.body;
  const visitor = {
    email: body.email || "",
    firstName: body.first_name || body.firstName || "",
    lastName: body.last_name || body.lastName || "",
    name: `${body.first_name || ""} ${body.last_name || ""}`.trim(),
    company: body.company || "",
    companyDomain: body.company_domain || "",
    title: body.job_title || body.title || "",
    industry: body.industry || "",
    employees: body.employee_count || body.employees || 0,
    linkedinUrl: body.linkedin_url || body.linkedinUrl || "",
    pagesVisited: body.page_url || body.pages_visited || "",
  };

  try {
    // Gate 1: Dedup (Using Vercel KV)
    const duplicate = await isDuplicate(visitor.email);
    if (duplicate) {
      await notify("duplicate", visitor);
      console.log(JSON.stringify({ event: "duplicate_skipped", email: visitor.email }));
      return res.status(200).json({ status: "skipped", reason: "duplicate" });
    }

    // Gate 2: HubSpot check
    const { isBlocked, contact } = await checkHubspot(visitor.email);
    if (isBlocked) {
      await notify("existing_client", {
        ...visitor,
        lifecyclestage: contact?.lifecyclestage || "unknown"
      });
      console.log(JSON.stringify({ event: "hubspot_blocked", email: visitor.email }));
      return res.status(200).json({ status: "skipped", reason: "existing_contact" });
    }

    // Gate 3: ICP score
    const { score, tier, reasons } = scoreICP(visitor);
    visitor.icpScore = score;
    visitor.leadTier = tier;

    if (score < MIN_SCORE) {
      await notify("low_icp", {
        ...visitor,
        reasons: reasons.join(", ") || "no matches"
      });
      console.log(JSON.stringify({ event: "low_icp", email: visitor.email, score }));
      return res.status(200).json({ status: "skipped", reason: "low_icp", score });
    }

    // All gates passed - fire everything in parallel
    const [heyreachResult, instantlyResult, hubspotResult] = await Promise.all([
      visitor.linkedinUrl ? addToHeyReach(visitor) : Promise.resolve({ success: false, error: "no linkedin" }),
      addToInstantly(visitor),
      createContact(visitor)
    ]);

    // Slack hot lead alert
    await notify("hot_lead", visitor);
    console.log(JSON.stringify({ 
      event: "hot_lead_actioned", 
      email: visitor.email, 
      heyreach: heyreachResult.success, 
      instantly: instantlyResult.success 
    }));

    return res.status(200).json({
      status: "actioned",
      score,
      tier,
      heyreach: heyreachResult.success,
      instantly: instantlyResult.success,
      hubspot: hubspotResult
    });
  } catch (error) {
    console.error(JSON.stringify({ event: "processing_error", error: error.message }));
    
    // Returning 500 triggers QStash to automatically retry the process later!
    return res.status(500).json({ error: error.message });
  }
}
