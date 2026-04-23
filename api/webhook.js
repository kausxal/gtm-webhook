const { z } = require("zod");
const { Client } = require("@upstash/qstash");

// Initialize QStash
const qstash = new Client({
  token: process.env.QSTASH_TOKEN || "dummy-token",
});

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

    // B. Axiom Logging 
    // Axiom will automatically capture this console log and turn it into searchable JSON!
    console.log(JSON.stringify({
      event: "webhook_received",
      email: validatedData.email,
      timestamp: new Date().toISOString()
    }));

    // C. Forward to QStash Background Worker
    // We pass our secret so the worker knows the request is legit
    const protocol = req.headers["x-forwarded-proto"] || "http";
    const host = req.headers.host;
    const workerUrl = `${protocol}://${host}/api/process?secret=${process.env.RB2B_SECRET}`;

    if (process.env.QSTASH_TOKEN && process.env.QSTASH_TOKEN !== "dummy-token") {
      await qstash.publishJSON({
        url: workerUrl,
        body: validatedData,
      });
    } else {
      console.warn("⚠️ QSTASH_TOKEN not found - please configure Upstash QStash");
    }

    // D. Return 200 OK instantly to RB2B
    return res.status(200).json({ status: "queued", email: validatedData.email });
    
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error(JSON.stringify({ event: "validation_error", errors: error.errors }));
      return res.status(400).json({ error: "Invalid data format", details: error.errors });
    }
    
    console.error(JSON.stringify({ event: "internal_error", error: error.message }));
    return res.status(500).json({ error: "Internal Server Error" });
  }
}
