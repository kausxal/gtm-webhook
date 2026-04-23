function scoreICP(data) {
  let score = 0;
  const reasons = [];

  const industries = (process.env.ICP_INDUSTRIES || "").split(",").map(i => i.trim().toLowerCase());
  const titles = (process.env.ICP_TITLES || "").split(",").map(t => t.trim().toLowerCase());
  const minEmp = parseInt(process.env.ICP_MIN_EMPLOYEES || "10");
  const maxEmp = parseInt(process.env.ICP_MAX_EMPLOYEES || "500");

  const industry = (data.industry || "").toLowerCase();
  const title = (data.title || "").toLowerCase();
  const employees = parseInt(data.employees || "0");
  const pages = (data.pagesVisited || "").toLowerCase();

  if (industries.some(i => industry.includes(i))) {
    score += 25;
    reasons.push("industry match");
  }

  if (titles.some(t => title.includes(t))) {
    score += 25;
    reasons.push("title match");
  }

  if (employees >= minEmp && employees <= maxEmp) {
    score += 20;
    reasons.push("company size match");
  }

  if (pages.includes("pricing") || pages.includes("services") || pages.includes("contact")) {
    score += 20;
    reasons.push("high intent page");
  }

  if (data.linkedinUrl) {
    score += 10;
    reasons.push("linkedin found");
  }

  const tier = score >= 80 ? "hot" : score >= 60 ? "warm" : "cold";

  return { score, tier, reasons };
}

module.exports = { scoreICP };
