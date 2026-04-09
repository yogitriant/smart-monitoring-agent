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
