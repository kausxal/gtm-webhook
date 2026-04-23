const { z } = require("zod");
const { saveToDataLake } = require("../lib/db");
const { tasks } = require("@trigger.dev/sdk/v3");

// Zod Schema
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

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const secret = req.headers["x-webhook-secret"];
  if (secret !== process.env.RB2B_SECRET) return res.status(401).json({ error: "Unauthorized" });

  try {
    const validatedData = rb2bSchema.parse(req.body);

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

    // 1. DATA LAKE: Save raw payload to Postgres immediately
    await saveToDataLake(visitor);

    // 2. WORKFLOW ENGINE: Trigger the robust background task
    const handle = await tasks.trigger("process-lead", visitor);

    // 3. Return 200 OK instantly to RB2B
    return res.status(200).json({ status: "queued", trigger_id: handle.id });
    
  } catch (error) {
    console.error("Webhook Error:", error);
    return res.status(500).json({ error: "Internal Server Error" });
  }
}
