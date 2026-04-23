const axios = require("axios");

async function checkHubspot(email) {
  try {
    const res = await axios.post(
      "https://api.hubapi.com/crm/v3/objects/contacts/search",
      {
        filterGroups: [{
          filters: [{
            propertyName: "email",
            operator: "EQ",
            value: email
          }]
        }],
        properties: ["email", "lifecyclestage", "hs_lead_status", "firstname", "lastname", "company"]
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.HUBSPOT_API_KEY}`,
          "Content-Type": "application/json"
        }
      }
    );

    const results = res.data.results;
    if (results && results.length > 0) {
      const contact = results[0].properties;
      const blockedStages = ["customer", "opportunity", "salesqualifiedlead", "sql"];
      const isBlocked = blockedStages.includes(
        (contact.lifecyclestage || "").toLowerCase()
      );
      return { exists: true, isBlocked, contact };
    }
    return { exists: false, isBlocked: false, contact: null };
  } catch (e) {
    console.error("HubSpot check failed:", e.message);
    return { exists: false, isBlocked: false, contact: null };
  }
}

async function createContact(data) {
  try {
    await axios.post(
      "https://api.hubapi.com/crm/v3/objects/contacts",
      {
        properties: {
          email: data.email,
          firstname: data.firstName,
          lastname: data.lastName,
          company: data.company,
          jobtitle: data.title,
          lifecyclestage: "marketingqualifiedlead",
          lead_source: "Website",
          hs_lead_status: "NEW",
          icp_score: data.icpScore,
          pages_visited: data.pagesVisited
        }
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.HUBSPOT_API_KEY}`,
          "Content-Type": "application/json"
        }
      }
    );
    return true;
  } catch (e) {
    console.error("HubSpot create failed:", e.message);
    return false;
  }
}

module.exports = { checkHubspot, createContact };
