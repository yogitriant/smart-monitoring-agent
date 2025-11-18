const axios = require("axios");
const { getIdleTime } = require("../utils/getIdleTime"); // ✅ pakai raw
const { loadConfig } = require("../utils/configHandler");
const { log } = require("../utils/logger");
const {
  startAutoShutdownService,
  stopAutoShutdownService,
} = require("./autoShutdownService");

let lastIdleTimeout = null;

async function pollIdleTimeoutWhenIdle() {
  const config = await loadConfig();
  const baseUrl = config.API_BASE_URL?.trim();
  const pcId = String(config.pcId || "").trim();

  if (!baseUrl || !pcId) {
    log("❌ API_BASE_URL atau pcId kosong di config.json", "poller");
    return;
  }

  const url = `${baseUrl}/api/pc/${pcId}`;
  const idleRaw = getIdleTime();

  if (idleRaw === 0 && lastIdleTimeout === null) {
    log("⏳ Idle service belum siap (idleRaw=0), skip dulu", "poller");
    return;
  }

  if (lastIdleTimeout === null) {
    log(`📡 First-time fetch idleTimeout dari ${url}`, "poller");
  } else if (idleRaw < 10) {
    log(`🟢 User aktif (idle=${idleRaw}s), skip polling idleTimeout`, "poller");
    return;
  }

  try {
    const res = await axios.get(url);
    const currentTimeout = res.data?.idleTimeout;

    if (typeof currentTimeout !== "number") {
      log("⚠️ idleTimeout tidak valid di response", "poller");
      return;
    }

    if (lastIdleTimeout === null) {
      log(`📌 idleTimeout pertama kali: ${currentTimeout}`, "poller");
      lastIdleTimeout = currentTimeout;
      startAutoShutdownService(null, { idleTimeout: currentTimeout });
      return;
    }

    if (currentTimeout !== lastIdleTimeout) {
      log(
        `♻️ idleTimeout berubah: ${lastIdleTimeout} → ${currentTimeout}, restart shutdown service`,
        "poller"
      );
      lastIdleTimeout = currentTimeout;

      await stopAutoShutdownService();
      startAutoShutdownService(null, { idleTimeout: currentTimeout });
    }
  } catch (err) {
    log(
      `❌ Polling gagal: ${
        err.response ? JSON.stringify(err.response.data) : err.message
      }`,
      "poller"
    );
  }
}

function startIdleAwarePolling(intervalMs = 60_000) {
  log(
    `📡 Memulai polling idleTimeout tiap ${intervalMs / 1000} detik (idle only)`,
    "poller"
  );
  setInterval(() => {
    pollIdleTimeoutWhenIdle().catch((err) =>
      log("❌ Polling crash: " + err.message, "poller")
    );
  }, intervalMs);
}

module.exports = { startIdleAwarePolling };
