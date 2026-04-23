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

  const secret = req.headers["x-webhook-secret"];
  if (secret !== process.env.RB2B_SECRET) {
    return res.status(401).json({ error: "Unauthorized" });
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

  if (!visitor.email) {
    return res.status(400).json({ error: "No email in payload" });
  }

  // Gate 1: Dedup
  const duplicate = isDuplicate(visitor.email);
  if (duplicate) {
    await notify("duplicate", visitor);
    return res.status(200).json({ status: "skipped", reason: "duplicate" });
  }

  // Gate 2: HubSpot check
  const { isBlocked, contact } = await checkHubspot(visitor.email);
  if (isBlocked) {
    await notify("existing_client", {
      ...visitor,
      lifecyclestage: contact?.lifecyclestage || "unknown"
    });
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

  return res.status(200).json({
    status: "actioned",
    score,
    tier,
    heyreach: heyreachResult.success,
    instantly: instantlyResult.success,
    hubspot: hubspotResult
  });
}
