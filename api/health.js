const { sql } = require("@vercel/postgres");
const { kv } = require("@vercel/kv");

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const health = {
    status: "healthy",
    timestamp: new Date().toISOString(),
    checks: {},
  };

  try {
    await sql`SELECT 1`;
    health.checks.postgres = "ok";
  } catch (error) {
    health.checks.postgres = `error: ${error.message}`;
    health.status = "unhealthy";
  }

  try {
    await kv.get("health-check");
    health.checks.redis = "ok";
  } catch (error) {
    health.checks.redis = `error: ${error.message}`;
    health.status = "unhealthy";
  }

  const statusCode = health.status === "healthy" ? 200 : 503;
  return res.status(statusCode).json(health);
}