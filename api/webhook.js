const { waitUntil } = require("@vercel/functions");
const { z } = require("zod");
const { isDuplicate } = require("../lib/dedup");
const { checkHubspot, createContact } = require("../lib/hubspot");
const { scoreICP } = require("../lib/icp");
const { addToHeyReach } = require("../lib/heyreach");
const { addToInstantly } = require("../lib/instantly");
const { notify } = require("../lib/slack");

const MIN_SCORE = parseInt(process.env.ICP_MIN_SCORE || "60");

// 1. Zod Schema: Strict Validation for RB2B Payload
const rb2bSchema = z.object({
  email: z.string().email("Invalid email format"),
  first_name: z.string().optional().catch(""),
  firstName: z.string().optional().catch(""),
  last_name: z.string().optional().catch(""),
  lastName: z.string().optional().catch(""),
  company: z.string().optional().catch(""),
  company_domain: z.string().optional().catch(""),
  job_title: z.string().optional().catch(""),
  title: z.string().optional().catch(""),
  industry: z.string().optional().catch(""),
  employee_count: z.union([z.number(), z.string()]).optional().catch(0),
  employees: z.union([z.number(), z.string()]).optional().catch(0),
  linkedin_url: z.string().url().optional().or(z.literal("")).catch(""),
  linkedinUrl: z.string().url().optional().or(z.literal("")).catch(""),
  page_url: z.string().optional().catch(""),
  pages_visited: z.string().optional().catch(""),
}).passthrough();

// The background processing function
async function processWebhook(visitor) {
  try {
    // Gate 1: Dedup (Using Vercel KV)
    const duplicate = await isDuplicate(visitor.email);
    if (duplicate) {
      await notify("duplicate", visitor);
      console.log(JSON.stringify({ event: "duplicate_skipped", email: visitor.email }));
      return;
    }

    // Gate 2: HubSpot check
    const { isBlocked, contact } = await checkHubspot(visitor.email);
    if (isBlocked) {
      await notify("existing_client", {
        ...visitor,
        lifecyclestage: contact?.lifecyclestage || "unknown"
      });
      console.log(JSON.stringify({ event: "hubspot_blocked", email: visitor.email }));
      return;
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
      return;
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

  } catch (error) {
    console.error(JSON.stringify({ event: "processing_error", error: error.message }));
  }
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const secret = req.headers["x-webhook-secret"];
  if (secret !== process.env.RB2B_SECRET) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    // A. Strict Data Validation (Zod)
    const validatedData = rb2bSchema.parse(req.body);

    // B. Format the visitor object
    const visitor = {
      email: validatedData.email,
      firstName: validatedData.first_name || validatedData.firstName || "",
      lastName: validatedData.last_name || validatedData.lastName || "",
      name: `${validatedData.first_name || validatedData.firstName || ""} ${validatedData.last_name || validatedData.lastName || ""}`.trim(),
      company: validatedData.company || "",
      companyDomain: validatedData.company_domain || "",
      title: validatedData.job_title || validatedData.title || "",
      industry: validatedData.industry || "",
      employees: validatedData.employee_count || validatedData.employees || 0,
      linkedinUrl: validatedData.linkedin_url || validatedData.linkedinUrl || "",
      pagesVisited: validatedData.page_url || validatedData.pages_visited || "",
    };

    console.log(JSON.stringify({
      event: "webhook_received",
      email: visitor.email,
      timestamp: new Date().toISOString()
    }));

    // C. Tell Vercel to run this in the background using waitUntil
    waitUntil(processWebhook(visitor));

    // D. Return 200 OK instantly to RB2B
    return res.status(200).json({ status: "queued", email: visitor.email });
    
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error(JSON.stringify({ event: "validation_error", errors: error.errors }));
      return res.status(400).json({ error: "Invalid data format", details: error.errors });
    }
    
    console.error(JSON.stringify({ event: "internal_error", error: error.message }));
    return res.status(500).json({ error: "Internal Server Error" });
  }
}
