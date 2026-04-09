// utils/logger.js
// Efficient logger with daily rotation and size cap
const fs = require("fs");
const path = require("path");
const os = require("os");

// ─── Config ──────────────────────────────
const LOG_DIR = path.join(os.tmpdir(), "SmartMonitoringAgentLogs");
const MAX_FILE_SIZE = 2 * 1024 * 1024; // 2 MB per file
const MAX_LOG_FILES = 7;               // keep 7 days of logs
const CHECK_SIZE_EVERY = 500;          // check file size every N writes

let writeCounter = 0;
let currentDate = "";
let currentLogPath = "";
let writeStream = null;

// ─── Helpers ─────────────────────────────
function getJakartaTime() {
  // Return format YYYY-MM-DD HH:mm:ss in WIB
  return new Date().toLocaleString("sv-SE", { timeZone: "Asia/Jakarta" });
}

// ─── Ensure log dir ─────────────────────
if (!fs.existsSync(LOG_DIR)) {
  fs.mkdirSync(LOG_DIR, { recursive: true });
}

// ─── Get today's log path ───────────────
function getLogPath() {
  const today = getJakartaTime().split(" ")[0]; // YYYY-MM-DD
  if (today !== currentDate) {
    currentDate = today;
    currentLogPath = path.join(LOG_DIR, `agent-${today}.log`);
    // Close old stream, open new one
    if (writeStream) {
      writeStream.end();
    }
    writeStream = fs.createWriteStream(currentLogPath, { flags: "a" });
    writeStream.on("error", () => { }); // suppress errors
  }
  return currentLogPath;
}

// ─── Main log function ──────────────────
function log(message, category = "agent") {
  const timestamp = getJakartaTime();
  const line = `[${timestamp}] [${category}] ${message}\n`;

  // File output via stream (non-blocking)
  getLogPath();
  if (writeStream) {
    writeStream.write(line);
  }

  // Periodic maintenance
  writeCounter++;
  if (writeCounter % CHECK_SIZE_EVERY === 0) {
    maintenance();
  }
}

// ─── Maintenance: rotate + cleanup ──────
function maintenance() {
  try {
    const logPath = getLogPath();

    // 1. Check file size → rotate if too big
    if (fs.existsSync(logPath)) {
      const stats = fs.statSync(logPath);
      if (stats.size > MAX_FILE_SIZE) {
        // Truncate: keep last half of file
        const data = fs.readFileSync(logPath, "utf-8");
        const lines = data.split("\n");
        const half = Math.floor(lines.length / 2);
        const trimmed = lines.slice(half).join("\n");

        // Close stream, write truncated, reopen
        if (writeStream) writeStream.end();
        fs.writeFileSync(logPath, trimmed, "utf-8");
        writeStream = fs.createWriteStream(logPath, { flags: "a" });
        writeStream.on("error", () => { });
      }
    }

    // 2. Delete old log files (keep MAX_LOG_FILES days)
    const files = fs.readdirSync(LOG_DIR)
      .filter((f) => f.startsWith("agent-") && f.endsWith(".log"))
      .sort();

    if (files.length > MAX_LOG_FILES) {
      const toDelete = files.slice(0, files.length - MAX_LOG_FILES);
      toDelete.forEach((f) => {
        try {
          fs.unlinkSync(path.join(LOG_DIR, f));
        } catch (_) { }
      });
    }
  } catch (_) {
    // Maintenance errors are non-fatal
  }
}

// ─── Backwards compat (startLogTrimmer is now a no-op) ──
function startLogTrimmer() {
  // No longer needed — maintenance runs inline every N writes
}

module.exports = { log, startLogTrimmer };
