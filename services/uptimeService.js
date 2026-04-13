const fs = require("fs/promises");
const path = require("path");
const dayjs = require("dayjs");
const { getDataPath } = require("../utils/pathHelper");
const { log } = require("../utils/logger");
const { runWithMutex } = require("../utils/fileMutex");

const appDataPath = getDataPath();
const UPTIME_FILE = path.join(appDataPath, "uptime.json");

let sessionUptime = 0;
let intervalId = null;
let lastSessionStart = Date.now();

async function readUptimeData() {
  try {
    const content = await fs.readFile(UPTIME_FILE, "utf-8");
    return JSON.parse(content);
  } catch {
    return {};
  }
}

async function writeUptimeData(data) {
  await fs.mkdir(path.dirname(UPTIME_FILE), { recursive: true });
  await fs.writeFile(UPTIME_FILE, JSON.stringify(data, null, 2));
}

async function emitUptime(socket, config, session, total) {
  socket.emit("uptime", {
    pc: config.pcId,
    date: dayjs().format("YYYY-MM-DD"),
    uptimeSession: session,
    uptimeTotalToday: total,
  });

  log(
    `🕓 Uptime Emit | Session: ${Math.floor(session)}s, Total Today: ${Math.floor(total)}s`,
    "uptime"
  );
}

async function emitAtStartup(socket, config) {
  const today = dayjs().format("YYYY-MM-DD");
  try {
    await runWithMutex(UPTIME_FILE, async () => {
      const data = await readUptimeData();
      const totalToday = data[today] || 0;
      sessionUptime = 0;
      lastSessionStart = Date.now();
      await emitUptime(socket, config, sessionUptime, totalToday);
    });
  } catch (err) {
    log("❌ Gagal emit uptime saat startup: " + err.message, "uptime");
  }
}

function startUptimeService(socket, config, interval = 60) {
  if (intervalId) clearInterval(intervalId);
  // Jangan reset sessionUptime ke 0 di sini, agar jika fungsi ini dipanggil
  // ulang karena update config dari dashboard, uptime session tidak ke-reset.
  lastSessionStart = Date.now();

  intervalId = setInterval(async () => {
    const now = Date.now();
    const duration = Math.floor((now - lastSessionStart) / 1000);
    sessionUptime += duration;
    lastSessionStart = now;

    const today = dayjs().format("YYYY-MM-DD");
    try {
      await runWithMutex(UPTIME_FILE, async () => {
        const data = await readUptimeData();
        data[today] = (data[today] || 0) + duration;
        await writeUptimeData(data);
        await emitUptime(socket, config, sessionUptime, data[today]);
      });
    } catch (err) {
      log("❌ Gagal update uptime: " + err.message, "uptime");
    }
  }, interval * 1000);

  log(`🚀 Uptime Service dimulai (interval ${interval}s)`, "uptime");
}

function stopUptimeService() {
  if (intervalId) clearInterval(intervalId);
  intervalId = null;
  log("🛑 Uptime Service Stopped", "uptime");
}

module.exports = { emitAtStartup, startUptimeService, stopUptimeService };
