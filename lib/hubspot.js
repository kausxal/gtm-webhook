const axios = require("axios");
const { kv } = require("@vercel/kv");

async function searchCompany(domain) {
  if (!domain) return null;
  const cacheKey = `hubspot:company:${domain.toLowerCase().trim()}`;

  // 1. Redis Cache Check (Throttling)
  try {
    const cachedId = await kv.get(cacheKey);
    if (cachedId) {
      console.log(`[CACHE HIT] HubSpot Company ID for ${domain}`);
      return cachedId;
    }
  } catch (e) {
    console.error("KV Cache read failed:", e.message);
  }

  // 2. Fetch from HubSpot
  try {
    const res = await axios.post(
      "https://api.hubapi.com/crm/v3/objects/companies/search",
      {
        filterGroups: [{ filters: [{ propertyName: "domain", operator: "EQ", value: domain }] }],
        properties: ["domain", "name"]
      },
      { headers: { Authorization: `Bearer ${process.env.HUBSPOT_API_KEY}` } }
    );
    
    if (res.data.results && res.data.results.length > 0) {
      const id = res.data.results[0].id;
      // 3. Cache the ID for 24 hours to protect API limits
      try { await kv.set(cacheKey, id, { ex: 86400 }); } catch (e) {}
      return id;
    }
    return null;
  } catch (e) {
    console.error("HubSpot company search failed:", e.message);
    return null;
  }
}

async function createCompany(domain, name) {
  if (!domain) return null;
  try {
    const res = await axios.post(
      "https://api.hubapi.com/crm/v3/objects/companies",
      { properties: { domain: domain, name: name || domain } },
      { headers: { Authorization: `Bearer ${process.env.HUBSPOT_API_KEY}` } }
    );
    return res.data.id;
  } catch (e) {
    console.error("HubSpot company create failed:", e.message);
    return null;
  }
}

async function checkHubspot(email) {
  try {
    const res = await axios.post(
      "https://api.hubapi.com/crm/v3/objects/contacts/search",
      {
        filterGroups: [{ filters: [{ propertyName: "email", operator: "EQ", value: email }] }],
        properties: ["email", "lifecyclestage", "hs_lead_status", "firstname", "lastname", "company"]
      },
      { headers: { Authorization: `Bearer ${process.env.HUBSPOT_API_KEY}` } }
    );

    const results = res.data.results;
    if (results && results.length > 0) {
      const contact = results[0].properties;
      const blockedStages = ["customer", "opportunity", "salesqualifiedlead", "sql"];
      const isBlocked = blockedStages.includes((contact.lifecyclestage || "").toLowerCase());
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
    // 1. Handle Company Association
    let companyId = null;
    if (data.companyDomain) {
      companyId = await searchCompany(data.companyDomain);
      if (!companyId) {
        companyId = await createCompany(data.companyDomain, data.company);
      }
    }

    const properties = {
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
    };

    const payload = { properties };
    
    // Associate with company if found/created
    if (companyId) {
      payload.associations = [
        {
          to: { id: companyId },
          types: [{ associationCategory: "HUBSPOT_DEFINED", associationTypeId: 1 }] // Contact to Company association
        }
      ];
    }

    await axios.post("https://api.hubapi.com/crm/v3/objects/contacts", payload, {
      headers: { Authorization: `Bearer ${process.env.HUBSPOT_API_KEY}` }
    });
    return true;
  } catch (e) {
    console.error("HubSpot create failed:", e.message);
    return false;
  }
}

module.exports = { checkHubspot, createContact };
