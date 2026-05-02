const axios = require("axios");
const { kv } = require("@vercel/kv");

const COMPANY_CACHE_TTL = 86400;
const CONTACT_CACHE_TTL = 3600;

async function searchCompany(domain) {
  if (!domain) return null;
  const cacheKey = `hubspot:company:${domain.toLowerCase().trim()}`;

  try {
    const cachedId = await kv.get(cacheKey);
    if (cachedId) {
      console.log(`[CACHE HIT] HubSpot Company ID for ${domain}`);
      return cachedId;
    }
  } catch (e) {
    console.error("KV Cache read failed:", e.message);
  }

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
      try { await kv.set(cacheKey, id, { ex: COMPANY_CACHE_TTL }); } catch (e) {}
      return id;
    }
    return null;
  } catch (e) {
    console.error("HubSpot company search failed:", e.message);
    return null;
  }
}

async function checkHubspot(email) {
  if (!email) return { exists: false, isBlocked: false, contact: null };

  const cacheKey = `hubspot:contact:${email.toLowerCase().trim()}`;

  try {
    const cached = await kv.get(cacheKey);
    if (cached) {
      console.log(`[CACHE HIT] HubSpot contact for ${email}`);
      return JSON.parse(cached);
    }
  } catch (e) {
    console.error("KV Cache read failed:", e.message);
  }

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
    let result = { exists: false, isBlocked: false, contact: null };

    if (results && results.length > 0) {
      const contact = results[0].properties;
      const blockedStages = ["customer", "opportunity", "salesqualifiedlead", "sql"];
      const isBlocked = blockedStages.includes((contact.lifecyclestage || "").toLowerCase());
      result = { exists: true, isBlocked, contact };
    }

    try {
      await kv.set(cacheKey, JSON.stringify(result), { ex: CONTACT_CACHE_TTL });
    } catch (e) {}

    return result;
  } catch (e) {
    console.error("HubSpot check failed:", e.message);
    return { exists: false, isBlocked: false, contact: null };
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

async function createContact(data) {
  try {
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

    if (companyId) {
      payload.associations = [
        {
          to: { id: companyId },
          types: [{ associationCategory: "HUBSPOT_DEFINED", associationTypeId: 1 }]
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