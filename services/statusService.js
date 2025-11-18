//statusServices.js
const os = require("os");
const si = require("systeminformation");
const { getIdleTime } = require("../utils/getIdleTime");
const { log } = require("../utils/logger");

function startStatusService(socket, config) {
  const INTERVAL = 5000; // kirim status setiap 5 detik
  let lastStatus = null;

  const emitStatus = async () => {
    const idleTime = await getIdleTime();
    const isIdle = idleTime > config.idleTimeout * 60 * 1000; // idleTimeout dalam menit

    const status = isIdle ? "idle" : "online";

    if (status !== lastStatus) {
      socket.emit("status", {
        pcId: config.pcId,
        status,
        timestamp: new Date().toISOString(),
      });
      log(`📶 Status changed to ${status}`, "status");
      lastStatus = status;
    }
  };

  emitStatus();
  setInterval(emitStatus, INTERVAL);
}

module.exports = startStatusService;
