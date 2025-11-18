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

  intervalId = setInterval(async () => {
    const idleTime = await getIdleTime(); // ✅ panggil langsung
    log(`⌛ Idle time: ${idleTime} | Timeout: ${idleTimeout}`, "shutdown");

    if (idleTime >= idleTimeout && !shutdownIssued) {
      log("⚠️ Terlalu lama idle! Kirim peringatan shutdown...", "shutdown");
      exec(`msg * Komputer akan dimatikan dalam ${shutdownDelay} detik karena tidak aktif`);
      exec(`shutdown /s /t ${shutdownDelay}`);
      shutdownIssued = true;
    }

    if (shutdownIssued && idleTime < 10) {
      log("✅ Aktivitas terdeteksi ulang, shutdown dibatalkan.", "shutdown");
      exec("shutdown /a", () => {
        log("🔄 Pending shutdown dibatalkan (aktivitas terdeteksi)", "shutdown");
      });
      shutdownIssued = false;
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
