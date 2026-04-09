//statusServices.js
const { getIdleTime } = require("../utils/getIdleTime");
const { log } = require("../utils/logger");

let intervalId = null;
let lastStatus = null;
let heartbeatCount = 0;

function startStatusService(socket, config) {
  stopStatusService(); // clear previous

  const INTERVAL = 5000; // cek status setiap 5 detik
  const HEARTBEAT_EVERY = 6; // kirim heartbeat setiap 6x check = 30 detik

  const emitStatus = async () => {
    const idleTime = await getIdleTime();
    const idleTimeoutSec = (config.idleTimeout || 0) * 60; // convert menit → detik
    const isIdle = idleTimeoutSec > 0 && idleTime > idleTimeoutSec;

    const status = isIdle ? "idle" : "online";
    heartbeatCount++;

    // Emit jika status berubah ATAU setiap 30 detik sebagai heartbeat
    const shouldEmit = status !== lastStatus || heartbeatCount >= HEARTBEAT_EVERY;

    if (shouldEmit) {
      socket.emit("status", {
        pcId: config.pcId,
        status,
        timestamp: new Date().toISOString(),
      });

      if (status !== lastStatus) {
        log(`📶 Status changed to ${status}`, "status");
      }

      lastStatus = status;
      heartbeatCount = 0;
    }
  };

  emitStatus();
  intervalId = setInterval(emitStatus, INTERVAL);
  log("🚀 Status Service started (5s check, 30s heartbeat)", "status");
}

function stopStatusService() {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
  }
  lastStatus = null;
  heartbeatCount = 0;
  log("🛑 Status Service stopped", "status");
}

module.exports = { startStatusService, stopStatusService };
