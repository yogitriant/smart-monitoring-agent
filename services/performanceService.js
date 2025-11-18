const os = require("os");
const si = require("systeminformation");
const { getIdleTime: getIdleTimeRaw } = require("../utils/getIdleTime");
const { getUptimeTotalToday } = require("../utils/uptimeHelper");
const { log } = require("../utils/logger");

let performanceInterval = null;
let intervalMs = 3_600_000; // 🕒 default 3600 detik (1 jam)
const agentStartTime = Date.now();

function formatTime(sec) {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.floor(sec % 60);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

async function collectAndEmit(socket, config) {
  try {
    const [cpu, mem, disks] = await Promise.all([
      si.currentLoad(),
      si.mem(),
      si.fsSize(),
    ]);

    // 🔹 Baca idle time saja (tidak set ke sharedState)
    const idleRaw = getIdleTimeRaw();

    const uptime = os.uptime();
    const agentUptime = Math.floor((Date.now() - agentStartTime) / 1000);
    const uptimeTotal = await getUptimeTotalToday();
    const uptimeSession = Math.max(uptimeTotal - idleRaw, 0);

    const cpuUsage = Math.round(cpu.currentLoad);
    const ramUsage = Math.round((mem.active / mem.total) * 100);
    const diskUsage = disks.map((d) => ({
      drive: d.mount,
      used: +(d.used / 1024 / 1024 / 1024).toFixed(2),
      total: +(d.size / 1024 / 1024 / 1024).toFixed(2),
    }));

    socket.emit("performance", {
      pc: config.pcId,
      cpuUsage,
      ramUsage,
      diskUsage,
      idleTime: idleRaw,
      uptime,
      agentUptime,
      uptimeTotal,
      uptimeSession,
      timestamp: new Date(),
    });

    log(
      `📊 Performance | CPU: ${cpuUsage}%, RAM: ${ramUsage}%, Boot: ${formatTime(
        uptime
      )}, Agent: ${formatTime(agentUptime)}, Total: ${formatTime(
        uptimeTotal
      )}, IdleRaw: ${idleRaw}s, Session: ${formatTime(uptimeSession)}`,
      "performance"
    );
  } catch (err) {
    log("❌ Gagal ambil data performa: " + err.message, "performance");
  }
}

function startPerformanceService(socket, config) {
  if (performanceInterval) clearInterval(performanceInterval);

  const customInterval = (config.performanceInterval || 60) * 1000; // default 1 jam
  intervalMs = customInterval;

  // 🔹 kirim 1x data awal langsung
  collectAndEmit(socket, config);

  // 🔹 lanjut ke interval berikutnya
  performanceInterval = setInterval(() => collectAndEmit(socket, config), intervalMs);
  log(`🚀 Performance service dimulai dengan interval ${intervalMs / 1000}s`, "performance");
}

function setPerformanceInterval(socket, config, newIntervalMs) {
  if (performanceInterval) clearInterval(performanceInterval);
  intervalMs = newIntervalMs;
  performanceInterval = setInterval(() => collectAndEmit(socket, config), intervalMs);
  log(`🔁 Performance interval diperbarui ke ${intervalMs / 1000}s`, "performance");
}

module.exports = {
  startPerformanceService,
  setPerformanceInterval,
};
