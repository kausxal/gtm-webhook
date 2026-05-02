const { sql } = require("@vercel/postgres");

const STATUS_PENDING = "pending";
const STATUS_PROCESSED = "processed";
const STATUS_FAILED = "failed";

async function getLeads(options = {}) {
  const { limit = 50, offset = 0, status, fromDate } = options;

  let query = "SELECT * FROM raw_leads_lake WHERE 1=1";
  const params = [];
  let paramIndex = 1;

  if (status) {
    query += ` AND status = $${paramIndex++}`;
    params.push(status);
  }

  if (fromDate) {
    query += ` AND created_at >= $${paramIndex++}`;
    params.push(fromDate);
  }

  query += ` ORDER BY created_at DESC LIMIT $${paramIndex++} OFFSET $${paramIndex++}`;
  params.push(limit, offset);

  const result = await sql.unsafe(query, ...params);
  return result.rows;
}

async function updateLeadStatus(id, status, errorMessage = null) {
  await sql`
    UPDATE raw_leads_lake
    SET status = ${status},
        error_message = ${errorMessage},
        updated_at = CURRENT_TIMESTAMP
    WHERE id = ${id}
  `;
}

async function getFailedLeads(limit = 100) {
  const result = await sql`
    SELECT * FROM raw_leads_lake
    WHERE status = 'failed'
    ORDER BY created_at DESC
    LIMIT ${limit}
  `;
  return result.rows;
}

module.exports = {
  getLeads,
  updateLeadStatus,
  getFailedLeads,
  STATUS_PENDING,
  STATUS_PROCESSED,
  STATUS_FAILED,
};