const { sql } = require("@vercel/postgres");

async function saveToDataLake(visitor) {
  try {
    // Lazy table creation (Runs once when the first lead arrives)
    await sql`
      CREATE TABLE IF NOT EXISTS raw_leads_lake (
        id SERIAL PRIMARY KEY,
        email VARCHAR(255),
        company_domain VARCHAR(255),
        raw_payload JSONB,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `;

    // Insert payload
    await sql`
      INSERT INTO raw_leads_lake (email, company_domain, raw_payload)
      VALUES (${visitor.email}, ${visitor.companyDomain}, ${JSON.stringify(visitor)})
    `;
    console.log(`[DATA LAKE] Saved ${visitor.email} to PostgreSQL`);
    return true;
  } catch (error) {
    console.error("Failed to save to Data Lake:", error.message);
    return false; // We don't want the webhook to crash if logging fails
  }
}

module.exports = { saveToDataLake };
