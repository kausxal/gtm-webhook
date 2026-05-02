const { sql } = require("@vercel/postgres");

async function saveToDataLake(visitor) {
  try {
    await sql`
      CREATE TABLE IF NOT EXISTS raw_leads_lake (
        id SERIAL PRIMARY KEY,
        email VARCHAR(255),
        company_domain VARCHAR(255),
        raw_payload JSONB,
        status VARCHAR(20) DEFAULT 'pending',
        error_message TEXT,
        updated_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `;

    await sql`
      INSERT INTO raw_leads_lake (email, company_domain, raw_payload)
      VALUES (${visitor.email}, ${visitor.companyDomain}, ${JSON.stringify(visitor)})
    `;

    console.log(`[DATA LAKE] Saved ${visitor.email} to PostgreSQL`);
    return true;
  } catch (error) {
    console.error("Failed to save to Data Lake:", error.message);
    return false;
  }
}

async function saveFailedLead(visitor, errorMessage) {
  try {
    await sql`
      CREATE TABLE IF NOT EXISTS failed_leads (
        id SERIAL PRIMARY KEY,
        email VARCHAR(255),
        company_domain VARCHAR(255),
        raw_payload JSONB,
        error_message TEXT,
        retry_count INTEGER DEFAULT 0,
        last_retry_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `;

    await sql`
      INSERT INTO failed_leads (email, company_domain, raw_payload, error_message)
      VALUES (${visitor.email}, ${visitor.companyDomain}, ${JSON.stringify(visitor)}, ${errorMessage})
    `;

    console.log(`[DLQ] Saved failed lead: ${visitor.email}`);
    return true;
  } catch (error) {
    console.error("Failed to save to DLQ:", error.message);
    return false;
  }
}

module.exports = { saveToDataLake, saveFailedLead };