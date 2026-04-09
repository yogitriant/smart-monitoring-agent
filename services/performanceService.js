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
    const [cpu, mem, disks, diskLayout, battery, netInterfaces] = await Promise.all([
      si.currentLoad(),
      si.mem(),
      si.fsSize(),
      si.diskLayout(),
      si.battery(),
      si.networkInterfaces()
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

    // 🔋 Battery Calculation
    let batteryInfo = null;
    if (battery.hasBattery) {
      const healthPercent = (battery.designedCapacity && battery.maxCapacity)
        ? Math.round((battery.maxCapacity / battery.designedCapacity) * 100)
        : null;
      batteryInfo = {
        percent: battery.percent,
        isCharging: battery.isCharging,
        health: healthPercent
      };
    }

    // 💽 Disk Health (SMART)
    const diskHealth = diskLayout.map(d => ({
      name: d.name,
      type: d.type,
      smartStatus: d.smartStatus || "Unknown"
    }));

    // 🌐 Active IP Address
    const activeNet = netInterfaces.find(n => n.operstate === "up" && !n.virtual && n.ip4);
    const activeIp = activeNet ? activeNet.ip4 : "127.0.0.1";

    socket.emit("performance", {
      pc: config.pcId,
      cpuUsage,
      ramUsage,
      diskUsage,
      diskHealth,
      battery: batteryInfo,
      activeIp,
      idleTime: idleRaw,
      uptime,
      agentUptime,
      uptimeTotal,
      uptimeSession,
      timestamp: new Date(),
    });

    log(
      `📊 Performa | CPU:${cpuUsage}% RAM:${ramUsage}% IP:${activeIp} Batt:${batteryInfo ? batteryInfo.percent + '%' : 'N/A'} Uptime:${formatTime(uptimeSession)}`,
      "performance"
    );
  } catch (err) {
    log("❌ Gagal ambil data performa: " + err.message, "performance");
  }
}

function startPerformanceService(socket, config) {
  if (performanceInterval) clearInterval(performanceInterval);

  const customInterval = (config.performanceInterval || 3600) * 1000; // default 1 jam
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
