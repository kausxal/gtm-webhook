const axios = require("axios");

async function addToHeyReach(data) {
  try {
    const res = await axios.post(
      "https://api.heyreach.io/api/public/lead/AddLeadsToCampaign",
      {
        campaignId: process.env.HEYREACH_CAMPAIGN_ID,
        leads: [{
          linkedInProfileUrl: data.linkedinUrl,
          firstName: data.firstName,
          lastName: data.lastName,
          customVariables: {
            company: data.company,
            title: data.title,
            pages_visited: data.pagesVisited,
            ice_breaker: buildIceBreaker(data)
          }
        }]
      },
      {
        headers: {
          "X-API-KEY": process.env.HEYREACH_API_KEY,
          "Content-Type": "application/json"
        }
      }
    );
    return { success: true, data: res.data };
  } catch (e) {
    console.error("HeyReach failed:", e.message);
    return { success: false, error: e.message };
  }
}

function buildIceBreaker(data) {
  const page = data.pagesVisited || "your site";
  const company = data.company || "your company";
  return `Noticed you checked out our ${page} page — we help ${company}-type teams build automated GTM systems. Worth a quick chat?`;
}

module.exports = { addToHeyReach };
