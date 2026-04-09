// services/installedAppsService.js
const axios = require("axios");
const { getInstalledApps } = require("./getInstalledApps");
const { API_BASE_URL } = require("../utils/env");
const { loadConfig } = require("../utils/configHandler");
const { log } = require("../utils/logger");

const ONE_DAY_MS = 24 * 60 * 60 * 1000;
let intervalId = null;

async function collectAndSend() {
  try {
    const config = await loadConfig();
    const pcId = config.pcId;

    if (!pcId) {
      log("⚠️ pcId kosong, skip installed apps", "apps");
      return;
    }

    log("📦 Collecting installed apps...", "apps");
    const apps = await getInstalledApps();

    if (!apps || apps.length === 0) {
      log("ℹ️ Tidak ada app terdeteksi, skip", "apps");
      return;
    }

    log(`📦 Found ${apps.length} installed apps, sending to backend...`, "apps");

    await axios.post(`${API_BASE_URL}/api/installed-apps`, {
      pcId,
      apps,
    });

    log(`✅ Installed apps (${apps.length}) sent to backend`, "apps");
  } catch (err) {
    log("❌ Gagal kirim installed apps: " + err.message, "apps");
  }
}

function startInstalledAppsService(config) {
  if (intervalId) clearInterval(intervalId);

  // Kirim sekali saat startup (delay 30s agar agent settle dulu)
  setTimeout(collectAndSend, 30_000);

  // Lalu kirim daily
  intervalId = setInterval(collectAndSend, ONE_DAY_MS);
  log("🚀 Installed Apps Service started (daily)", "apps");
}

function stopInstalledAppsService() {
  if (intervalId) clearInterval(intervalId);
  intervalId = null;
  log("🛑 Installed Apps Service stopped", "apps");
}

module.exports = { startInstalledAppsService, stopInstalledAppsService };
