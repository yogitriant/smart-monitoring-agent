const fs = require("fs");
const path = require("path");
const os = require("os");

const MAX_LOG_LINES = 200;
const TRIM_EVERY_N_WRITES = 100; // trim tiap 100 log
let writeCounter = 0;

function getLogFilePath(name = "agent") {
  const baseDir = os.tmpdir();
  const logDir = path.join(baseDir, "SmartMonitoringAgentLogs");
  if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true });
  return path.join(logDir, `${name}.log`);
}

function log(message, name = "agent") {
  const logFile = getLogFilePath(name);
  const timestamp = new Date().toISOString();
  const fullMessage = `[${timestamp}] ${message}\n`;

  // 🚀 Non-blocking append
  fs.appendFile(logFile, fullMessage, (err) => {
    if (err) console.error("❌ Logging gagal:", err.message);
  });

  // 🧩 Trim hanya sesekali
  writeCounter++;
  if (writeCounter % TRIM_EVERY_N_WRITES !== 0) return;

  try {
    const data = fs.readFileSync(logFile, "utf-8");
    const lines = data.trim().split("\n");
    if (lines.length > MAX_LOG_LINES) {
      const trimmed = lines.slice(-MAX_LOG_LINES);
      fs.writeFileSync(logFile, trimmed.join("\n") + "\n", "utf-8");
      console.log(`🧹 Trim ${name}.log → ${MAX_LOG_LINES} baris`);
    }
  } catch (err) {
    console.error("⚠️ Gagal trim log:", err.message);
  }
}

function startLogTrimmer() {
  setInterval(() => {
    const logDir = path.join(os.tmpdir(), "SmartMonitoringAgentLogs");
    if (!fs.existsSync(logDir)) return;

    fs.readdirSync(logDir).forEach((file) => {
      const filePath = path.join(logDir, file);
      const data = fs.readFileSync(filePath, "utf-8");
      const lines = data.trim().split("\n");
      if (lines.length > MAX_LOG_LINES) {
        const trimmed = lines.slice(-MAX_LOG_LINES);
        fs.writeFileSync(filePath, trimmed.join("\n") + "\n", "utf-8");
      }
    });
  }, 5 * 60 * 1000);
}

module.exports = { log, startLogTrimmer };
