const { z } = require("zod");
const { saveToDataLake } = require("../lib/db");
const { tasks } = require("@trigger.dev/sdk");
const { normalizeVisitor } = require("../lib/visitor");
const { verifySignature, checkRateLimit } = require("../lib/ratelimit");

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
  if (secret !== process.env.RB2B_SECRET) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const signature = req.headers["x-webhook-signature"];
  if (signature && process.env.WEBHOOK_SIGNING_SECRET) {
    const rawBody = JSON.stringify(req.body);
    if (!verifySignature(rawBody, signature, process.env.WEBHOOK_SIGNING_SECRET)) {
      return res.status(401).json({ error: "Invalid signature" });
    }
  }

  const clientIp = req.headers["x-forwarded-for"] || req.socket.remoteAddress;
  const rateCheck = checkRateLimit(clientIp, 100, 60000);

  if (!rateCheck.allowed) {
    res.set("X-RateLimit-Remaining", "0");
    res.set("X-RateLimit-Reset", rateCheck.resetAt.toString());
    return res.status(429).json({ error: "Too many requests" });
  }

  res.set("X-RateLimit-Remaining", rateCheck.remaining.toString());

  try {
    const validatedData = rb2bSchema.parse(req.body);
    const visitor = normalizeVisitor(validatedData);

    await saveToDataLake(visitor);

    const handle = await tasks.trigger("process-lead", visitor);

    return res.status(200).json({ status: "queued", trigger_id: handle.id });

  } catch (error) {
    console.error("Webhook Error:", error);
    return res.status(500).json({ error: "Internal Server Error" });
  }
}