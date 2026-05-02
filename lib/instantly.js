const axios = require("axios");

async function addToInstantly(data) {
  try {
    const res = await axios.post(
      "https://api.instantly.ai/api/v1/lead/add",
      {
        api_key: process.env.INSTANTLY_API_KEY,
        campaign_id: process.env.INSTANTLY_CAMPAIGN_ID,
        skip_if_in_workspace: true,
        leads: [{
          email: data.email,
          first_name: data.firstName,
          last_name: data.lastName,
          company_name: data.company,
          personalization: data.icebreaker,
          website: data.companyDomain,
          custom_variables: {
            title: data.title,
            pages_visited: data.pagesVisited,
            icp_score: String(data.icpScore),
            lead_tier: data.leadTier,
            linkedin: data.linkedinUrl
          }
        }]
      },
      {
        headers: { "Content-Type": "application/json" }
      }
    );
    return { success: true, data: res.data };
  } catch (e) {
    console.error("Instantly failed:", e.message);
    return { success: false, error: e.message };
  }
}

module.exports = { addToInstantly };