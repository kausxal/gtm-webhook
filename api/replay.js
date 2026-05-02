const { getLeads, updateLeadStatus, getFailedLeads } = require("../lib/replay");
const { tasks } = require("@trigger.dev/sdk");

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
        return await handleReplay(req, res);
      default:
        return res.status(405).json({ error: "Method not allowed" });
    }
  } catch (error) {
    console.error("Replay API Error:", error);
    return res.status(500).json({ error: "Internal Server Error" });
  }
}

async function handleList(req, res) {
  const { status, limit = 50, offset = 0 } = req.query;

  const leads = await getLeads({
    status,
    limit: parseInt(limit),
    offset: parseInt(offset),
  });

  return res.status(200).json({ leads, count: leads.length });
}

async function handleReplay(req, res) {
  const { leadIds, replayAllFailed } = req.body;

  let leadsToReplay = [];

  if (replayAllFailed) {
    leadsToReplay = await getFailedLeads(100);
  } else if (leadIds && Array.isArray(leadIds)) {
    leadsToReplay = await getLeads({ status: "failed" });
    leadsToReplay = leadsToReplay.filter(l => leadIds.includes(l.id));
  }

  if (leadsToReplay.length === 0) {
    return res.status(400).json({ error: "No leads to replay" });
  }

  for (const lead of leadsToReplay) {
    const payload = lead.raw_payload;
    await updateLeadStatus(lead.id, "pending");
    await tasks.trigger("process-lead", payload);
  }

  return res.status(200).json({
    status: "queued",
    count: leadsToReplay.length,
    leadIds: leadsToReplay.map(l => l.id)
  });
}