const fs = require("fs/promises");
const path = require("path");
const dayjs = require("dayjs");
const { getDataPath } = require("../utils/pathHelper");
const { getIdleTime } = require("../utils/getIdleTime");
const { log } = require("../utils/logger");

const appDataPath = getDataPath();
const IDLE_FILE = path.join(appDataPath, "idle.json");

let sessionIdle = 0;
let intervalId = null;
let lastSessionStart = Date.now();
let lastIdleValue = 0;

async function readIdleData() {
  try {
    const content = await fs.readFile(IDLE_FILE, "utf-8");
    return JSON.parse(content);
  } catch {
    return {};
  }
}

async function writeIdleData(data) {
  await fs.mkdir(path.dirname(IDLE_FILE), { recursive: true });
  await fs.writeFile(IDLE_FILE, JSON.stringify(data, null, 2));
}

async function emitIdle(socket, config, session, total) {
  socket.emit("idle", {
    pc: config.pcId,
    date: dayjs().format("YYYY-MM-DD"),
    idleSession: session,
    idleTotalToday: total,
  });

  log(
    `💤 Idle Emit | Session: ${Math.floor(session)}s, Total Today: ${Math.floor(total)}s`,
    "idle"
  );
}

async function emitAtStartup(socket, config) {
  const today = dayjs().format("YYYY-MM-DD");
  try {
    const data = await readIdleData();
    const totalToday = data[today] || 0;
    sessionIdle = 0;
    lastSessionStart = Date.now();
    lastIdleValue = getIdleTime();
    await emitIdle(socket, config, sessionIdle, totalToday);
  } catch (err) {
    log("❌ Gagal emit idle saat startup: " + err.message, "idle");
  }
}

function startIdleReporter(socket, config, interval = 60) {
  if (intervalId) clearInterval(intervalId);

  sessionIdle = 0;
  lastSessionStart = Date.now();
  lastIdleValue = getIdleTime();

  intervalId = setInterval(async () => {
    const now = Date.now();
    const duration = Math.floor((now - lastSessionStart) / 1000);
    lastSessionStart = now;

    const idleNow = getIdleTime();
    const deltaIdle = Math.max(idleNow - lastIdleValue, 0);
    lastIdleValue = idleNow;
    sessionIdle += deltaIdle;

    const today = dayjs().format("YYYY-MM-DD");

    try {
      const data = await readIdleData();
      data[today] = (data[today] || 0) + deltaIdle;
      await writeIdleData(data);
      await emitIdle(socket, config, sessionIdle, data[today]);
    } catch (err) {
      log("❌ Gagal update idle: " + err.message, "idle");
    }
  }, interval * 1000);

  log(`🚀 IdleReporter Service dimulai (interval ${interval}s)`, "idle");
}

function stopIdleReporter() {
  if (intervalId) clearInterval(intervalId);
  intervalId = null;
  log("🛑 IdleReporter Service Stopped", "idle");
}

module.exports = {
  emitAtStartup,
  startIdleReporter,
  stopIdleReporter,
};
