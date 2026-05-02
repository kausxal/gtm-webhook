/**
 * @typedef {Object} RawVisitorData
 * @property {string} [email]
 * @property {string} [first_name]
 * @property {string} [firstName]
 * @property {string} [last_name]
 * @property {string} [lastName]
 * @property {string} [company]
 * @property {string} [company_domain]
 * @property {string} [job_title]
 * @property {string} [title]
 * @property {string} [industry]
 * @property {number|string} [employee_count]
 * @property {number|string} [employees]
 * @property {string} [linkedin_url]
 * @property {string} [linkedinUrl]
 * @property {string} [page_url]
 * @property {string} [pages_visited]
 */

/**
 * @typedef {Object} NormalizedVisitor
 * @property {string} email
 * @property {string} firstName
 * @property {string} lastName
 * @property {string} name
 * @property {string} company
 * @property {string} companyDomain
 * @property {string} title
 * @property {string} industry
 * @property {number} employees
 * @property {string} linkedinUrl
 * @property {string} pagesVisited
 * @property {number} [icpScore]
 * @property {string} [leadTier]
 * @property {string} [icebreaker]
 * @property {boolean} [isHotSpike]
 */

/**
 * Normalize raw webhook payload to standard visitor object
 * @param {RawVisitorData} data - Raw input from webhook
 * @returns {NormalizedVisitor}
 */
function normalizeVisitor(data) {
  const firstName = data.first_name || data.firstName || "";
  const lastName = data.last_name || data.lastName || "";

  return {
    email: data.email || "",
    firstName,
    lastName,
    name: `${firstName} ${lastName}`.trim(),
    company: data.company || "",
    companyDomain: data.company_domain || "",
    title: data.job_title || data.title || "",
    industry: data.industry || "",
    employees: parseInt(data.employee_count || data.employees || 0, 10),
    linkedinUrl: data.linkedin_url || data.linkedinUrl || "",
    pagesVisited: data.page_url || data.pages_visited || "",
  };
}

/**
 * Add ICP scoring metadata to visitor
 * @param {NormalizedVisitor} visitor
 * @param {Object} icpResult - Result from scoreICP()
 * @returns {NormalizedVisitor}
 */
function enrichWithICP(visitor, icpResult) {
  return {
    ...visitor,
    icpScore: icpResult.score,
    leadTier: icpResult.tier,
  };
}

/**
 * Add hot spike modifier to visitor
 * @param {NormalizedVisitor} visitor
 * @param {number} domainVisits
 * @param {number} baseScore
 * @returns {NormalizedVisitor}
 */
function applyHotSpike(visitor, domainVisits, baseScore) {
  const isHotSpike = domainVisits >= 3;
  const bonusScore = isHotSpike ? 25 : 0;

  return {
    ...visitor,
    isHotSpike,
    icpScore: baseScore + bonusScore,
    leadTier: isHotSpike ? "hot" : visitor.leadTier,
  };
}

module.exports = {
  normalizeVisitor,
  enrichWithICP,
  applyHotSpike,
};