// 📁 autoShutdownService.js
const { getIdleTime } = require("../utils/getIdleTime"); // ✅ langsung edge-js
const { exec } = require("child_process");
const { log } = require("../utils/logger");

let intervalId = null;
let shutdownIssued = false;

function startAutoShutdownService(socket, config) {
  stopAutoShutdownService(); // clear service lama

  log("💡 [AutoShutdown] Start with config: " + JSON.stringify(config), "shutdown");

  const idleTimeout = Number(config.idleTimeout) * 60; // detik
  const shutdownDelay = Number(config.shutdownDelay || 60); // detik

  if (idleTimeout <= 0) {
    log("⛔ Auto Shutdown dinonaktifkan (idleTimeout <= 0)", "shutdown");
    exec("shutdown /a", () => {
      log("🔄 Pending shutdown dibatalkan (idleTimeout=0)", "shutdown");
    });
    shutdownIssued = false;
    return;
  }

  log("💤 [AutoShutdown] Monitoring dimulai...", "shutdown");
  log(`⌛ Idle timeout: ${idleTimeout}s`, "shutdown");
  log(`⚠️ Shutdown delay: ${shutdownDelay}s`, "shutdown");

  let wasIdle = false;

  intervalId = setInterval(async () => {
    const idleTime = await getIdleTime(); // ✅ panggil langsung

    if (idleTime >= idleTimeout && !shutdownIssued) {
      if (!wasIdle) {
        log(`⚠️ Idle ${idleTime}s >= ${idleTimeout}s, shutdown dalam ${shutdownDelay}s...`, "shutdown");
        wasIdle = true;
      }
      exec(`msg * Komputer akan dimatikan dalam ${shutdownDelay} detik karena tidak aktif`);
      exec(`shutdown /s /t ${shutdownDelay}`);
      shutdownIssued = true;
    }

    if (shutdownIssued && idleTime < 10) {
      log("✅ Aktivitas terdeteksi, shutdown dibatalkan.", "shutdown");
      exec("shutdown /a", () => {
        log("🔄 Pending shutdown dibatalkan (aktivitas terdeteksi)", "shutdown");
      });
      shutdownIssued = false;
      wasIdle = false;
    }
  }, 10_000);
}

function stopAutoShutdownService() {
  exec("shutdown /a", () => {
    log("🔄 Pending shutdown dibatalkan (via stopAutoShutdownService)", "shutdown");
  });

  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
  }

  shutdownIssued = false;
  log("🛑 Auto Shutdown Service Stopped", "shutdown");
}

module.exports = {
  startAutoShutdownService,
  stopAutoShutdownService,
};
