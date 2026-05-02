const { sql } = require("@vercel/postgres");

export default async function handler(req, res) {
  const { method } = req;

  const adminSecret = req.headers["x-admin-secret"];
  if (adminSecret !== process.env.ADMIN_SECRET) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    switch (method) {
      case "GET":
        return await handleList(req, res);
      case "POST":
        return await handleRetry(req, res);
      case "DELETE":
        return await handleClear(req, res);
      default:
        return res.status(405).json({ error: "Method not allowed" });
    }
  } catch (error) {
    console.error("DLQ API Error:", error);
    return res.status(500).json({ error: "Internal Server Error" });
  }
}

async function handleList(req, res) {
  const { limit = 50, offset = 0 } = req.query;

  const result = await sql`
    SELECT * FROM failed_leads
    ORDER BY created_at DESC
    LIMIT ${parseInt(limit)} OFFSET ${parseInt(offset)}
  `;

  const countResult = await sql`SELECT COUNT(*) as total FROM failed_leads`;

  return res.status(200).json({
    leads: result.rows,
    total: countResult.rows[0].total,
  });
}

async function handleRetry(req, res) {
  const { leadIds, retryAll } = req.body;

  let leadsToRetry = [];

  if (retryAll) {
    const result = await sql`
      SELECT * FROM failed_leads
      WHERE retry_count < 3
      ORDER BY created_at ASC
      LIMIT 100
    `;
    leadsToRetry = result.rows;
  } else if (leadIds && Array.isArray(leadIds)) {
    const placeholders = leadIds.map(() => "?").join(",");
    const result = await sql.unsafe(
      `SELECT * FROM failed_leads WHERE id IN (${placeholders})`,
      ...leadIds
    );
    leadsToRetry = result.rows;
  }

  if (leadsToRetry.length === 0) {
    return res.status(400).json({ error: "No leads to retry" });
  }

  const { tasks } = require("@trigger.dev/sdk");
  const processed = [];

  for (const lead of leadsToRetry) {
    try {
      await sql`
        UPDATE failed_leads
        SET retry_count = retry_count + 1,
            last_retry_at = CURRENT_TIMESTAMP
        WHERE id = ${lead.id}
      `;

      await tasks.trigger("process-lead", lead.raw_payload);
      processed.push(lead.id);
    } catch (error) {
      console.error(`Failed to retry lead ${lead.id}:`, error.message);
    }
  }

  return res.status(200).json({
    status: "queued",
    count: processed.length,
    leadIds: processed,
  });
}

async function handleClear(req, res) {
  const { confirm } = req.body;

  if (confirm !== "yes") {
    return res.status(400).json({
      error: "Provide { confirm: 'yes' } to clear all failed leads"
    });
  }

  await sql`DELETE FROM failed_leads`;

  return res.status(200).json({ status: "cleared" });
}