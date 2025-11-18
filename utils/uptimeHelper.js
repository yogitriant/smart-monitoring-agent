// utils/uptimeHelper.js
// const fs = require("fs/promises");
// const path = require("path");
// const dayjs = require("dayjs");

// const UPTIME_FILE = path.join(process.cwd(), "data", "uptime.json");

// async function getUptimeTotalToday() {
//   const today = dayjs().format("YYYY-MM-DD");

//   try {
//     const content = await fs.readFile(UPTIME_FILE, "utf-8");
//     const data = JSON.parse(content);
//     return data[today] || 0;
//   } catch {
//     return 0;
//   }
// }

// module.exports = {
//   getUptimeTotalToday,
// };

// utils/uptimeHelper.js
const fetch = require("node-fetch");
const { loadConfig } = require("./configHandler");
const { API_BASE_URL } = require("./env");
const dayjs = require("dayjs");

async function getUptimeTotalToday() {
  const config = await loadConfig();
  const today = dayjs().format("YYYY-MM-DD");

  try {
    const res = await fetch(
      `${API_BASE_URL}/api/uptime?pc=${config.pcId}&date=${today}`
    );

    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    return data?.uptimeTotalToday || 0;
  } catch (err) {
    console.error("❌ Gagal fetch uptime from API:", err.message);
    return 0;
  }
}

module.exports = {
  getUptimeTotalToday,
};

