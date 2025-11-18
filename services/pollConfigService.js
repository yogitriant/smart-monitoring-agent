// services/pollConfigService.js
const axios = require("axios");
const { loadConfig } = require("../utils/configHandler");
const { log } = require("../utils/logger");
const { setPerformanceInterval } = require("./performanceService");

let lastPerfInterval = null;

/**
 * 🧠 Polling dinamis performanceInterval dari backend
 * - Cek perubahan setiap beberapa menit
 * - Kalau berubah, restart interval performance service
 */
async function pollPerformanceConfig() {
  const config = await loadConfig();
  const baseUrl = config.API_BASE_URL?.trim();
  const pcId = String(config.pcId || "").trim();

  if (!baseUrl || !pcId) {
    log("❌ API_BASE_URL atau pcId kosong di config.json", "pollConfig");
    return;
  }

  const url = `${baseUrl}/api/settings/agent-config/${pcId}`;

  try {
    const res = await axios.get(url);
    const currentInterval = res.data?.performanceInterval;

    if (typeof currentInterval !== "number") {
      log("⚠️ performanceInterval tidak valid di response", "pollConfig");
      return;
    }

    // pertama kali jalan
    if (lastPerfInterval === null) {
      lastPerfInterval = currentInterval;
      log(`📦 Initial performanceInterval: ${currentInterval}s`, "pollConfig");
      return;
    }

    // kalau ada perubahan
    if (currentInterval !== lastPerfInterval) {
      log(
        `♻️ performanceInterval berubah: ${lastPerfInterval}s → ${currentInterval}s, restart performance service`,
        "pollConfig"
      );
      lastPerfInterval = currentInterval;

      // jalankan perubahan interval di performanceService
      setPerformanceInterval(null, config, currentInterval * 1000);
    }
  } catch (err) {
    log(
      `❌ Gagal polling performance config: ${
        err.response ? JSON.stringify(err.response.data) : err.message
      }`,
      "pollConfig"
    );
  }
}

/**
 * ⏱️ Jalankan polling tiap beberapa menit (default 5 menit)
 */
function startConfigPolling(intervalMs = 300_000) {
  log(`📡 Memulai polling performance config tiap ${intervalMs / 1000}s`, "pollConfig");

  setInterval(() => {
    pollPerformanceConfig().catch((err) =>
      log("❌ Polling crash: " + err.message, "pollConfig")
    );
  }, intervalMs);
}

module.exports = { startConfigPolling };
