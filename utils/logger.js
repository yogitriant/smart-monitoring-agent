// utils/logger.js
// Reliable logger with daily rotation and size cap
// Uses appendFileSync for guaranteed writes (even in pkg/exe environment)
const fs = require("fs");
const path = require("path");
const os = require("os");
const { getDataPath } = require("./pathHelper");

// ─── Config ──────────────────────────────
const LOG_DIR = path.join(getDataPath(), "..", "logs");
const MAX_FILE_SIZE = 2 * 1024 * 1024; // 2 MB per file
const MAX_LOG_FILES = 7;               // keep 7 days of logs
const CHECK_SIZE_EVERY = 500;          // check file size every N writes

let writeCounter = 0;
let currentDate = "";
let currentLogPath = "";

// ─── Helpers ─────────────────────────────
function getJakartaTime() {
  // Return format YYYY-MM-DD HH:mm:ss in WIB
  return new Date().toLocaleString("sv-SE", { timeZone: "Asia/Jakarta" });
}

// ─── Ensure log dir ─────────────────────
try {
  if (!fs.existsSync(LOG_DIR)) {
    fs.mkdirSync(LOG_DIR, { recursive: true });
  }
} catch (_) { /* will retry on each log call */ }

// ─── Get today's log path ───────────────
function getLogPath() {
  try {
    if (!fs.existsSync(LOG_DIR)) {
      fs.mkdirSync(LOG_DIR, { recursive: true });
    }
  } catch (_) { }

  const today = getJakartaTime().split(" ")[0]; // YYYY-MM-DD
  if (today !== currentDate) {
    currentDate = today;
    currentLogPath = path.join(LOG_DIR, `agent-${today}.log`);
  }
  return currentLogPath;
}

// ─── Main log function ──────────────────
function log(message, category = "agent") {
  const timestamp = getJakartaTime();
  const line = `[${timestamp}] [${category}] ${message}\n`;

  // Synchronous file append — guaranteed write, works in pkg/exe
  try {
    const logPath = getLogPath();
    fs.appendFileSync(logPath, line);
  } catch (_) {
    // Last resort: try original temp location
    try {
      const fallback = path.join(os.tmpdir(), "SmartMonitoringAgentLogs");
      if (!fs.existsSync(fallback)) fs.mkdirSync(fallback, { recursive: true });
      fs.appendFileSync(path.join(fallback, `agent-${currentDate}.log`), line);
    } catch (_) { /* truly nothing we can do */ }
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
        fs.writeFileSync(logPath, trimmed, "utf-8");
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
