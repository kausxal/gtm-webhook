const fs = require("fs");
const path = require("path");

const STORE_PATH = "/tmp/dedup_store.json";
const WINDOW_DAYS = parseInt(process.env.DEDUP_WINDOW_DAYS || "7");

function loadStore() {
  try {
    if (fs.existsSync(STORE_PATH)) {
      return JSON.parse(fs.readFileSync(STORE_PATH, "utf8"));
    }
  } catch (e) {}
  return {};
}

function saveStore(store) {
  try {
    fs.writeFileSync(STORE_PATH, JSON.stringify(store), "utf8");
  } catch (e) {}
}

function isDuplicate(email) {
  const store = loadStore();
  const now = Date.now();
  const windowMs = WINDOW_DAYS * 24 * 60 * 60 * 1000;
  const key = email.toLowerCase().trim();

  if (store[key]) {
    const lastSeen = store[key];
    if (now - lastSeen < windowMs) {
      return true;
    }
  }

  store[key] = now;
  saveStore(store);
  return false;
}

module.exports = { isDuplicate };
