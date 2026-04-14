// utils/logger.js
// Bulletproof logger — works in pkg/exe, SYSTEM account, any context
const fs = require("fs");
const path = require("path");
const os = require("os");
const { execSync } = require("child_process");

// ─── Config ──────────────────────────────
const MAX_FILE_SIZE = 2 * 1024 * 1024; // 2 MB per file
const MAX_LOG_FILES = 7;
const CHECK_SIZE_EVERY = 500;

let writeCounter = 0;
let currentDate = "";
let currentLogPath = "";
let LOG_DIR = "";

// ─── Determine log directory (multiple fallbacks) ──
function resolveLogDir() {
  const candidates = [
    path.join("C:\\ProgramData", "SmartMonitoringAgent", "logs"),
    path.join(os.homedir(), "AppData", "Local", "SmartMonitoringAgent", "logs"),
    path.join(os.tmpdir(), "SmartMonitoringAgentLogs"),
  ];

  for (const dir of candidates) {
    try {
      fs.mkdirSync(dir, { recursive: true });
      // Fix Windows ACL so any user/SYSTEM can write log files
      try { execSync(`icacls "${dir}" /grant Everyone:(OI)(CI)F /Q`, { stdio: "ignore" }); } catch (_) {}
      // Test actual file write
      const testFile = path.join(dir, ".write-test");
      fs.writeFileSync(testFile, "ok");
      fs.unlinkSync(testFile);
      return dir;
    } catch (_) {
      // try next candidate
    }
  }
  // absolute last resort
  return os.tmpdir();
}

// ─── Safe date formatting (no locale dependency) ──
function getJakartaTime() {
  try {
    // Offset WIB = UTC+7
    const now = new Date();
    const utc = now.getTime() + now.getTimezoneOffset() * 60000;
    const wib = new Date(utc + 7 * 3600000);
    const y = wib.getFullYear();
    const m = String(wib.getMonth() + 1).padStart(2, "0");
    const d = String(wib.getDate()).padStart(2, "0");
    const hh = String(wib.getHours()).padStart(2, "0");
    const mm = String(wib.getMinutes()).padStart(2, "0");
    const ss = String(wib.getSeconds()).padStart(2, "0");
    return `${y}-${m}-${d} ${hh}:${mm}:${ss}`;
  } catch (_) {
    return new Date().toISOString().replace("T", " ").substring(0, 19);
  }
}

function getToday() {
  return getJakartaTime().split(" ")[0];
}

// ─── Initialize log dir ─────────────────
LOG_DIR = resolveLogDir();

// ─── Get today's log path ───────────────
function getLogPath() {
  const today = getToday();
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

  try {
    const logPath = getLogPath();
    fs.appendFileSync(logPath, line);
  } catch (err) {
    // If primary fails, try re-resolving log dir
    try {
      LOG_DIR = resolveLogDir();
      const logPath = getLogPath();
      fs.appendFileSync(logPath, line);
    } catch (_) {
      // Nothing we can do, output to stderr
      try { process.stderr.write(line); } catch (_) { }
    }
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

    if (fs.existsSync(logPath)) {
      const stats = fs.statSync(logPath);
      if (stats.size > MAX_FILE_SIZE) {
        const data = fs.readFileSync(logPath, "utf-8");
        const lines = data.split("\n");
        const half = Math.floor(lines.length / 2);
        const trimmed = lines.slice(half).join("\n");
        fs.writeFileSync(logPath, trimmed, "utf-8");
      }
    }

    const files = fs.readdirSync(LOG_DIR)
      .filter((f) => f.startsWith("agent-") && f.endsWith(".log"))
      .sort();

    if (files.length > MAX_LOG_FILES) {
      const toDelete = files.slice(0, files.length - MAX_LOG_FILES);
      toDelete.forEach((f) => {
        try { fs.unlinkSync(path.join(LOG_DIR, f)); } catch (_) { }
      });
    }
  } catch (_) { }
}

// ─── Backwards compat ───────────────────
function startLogTrimmer() { }

module.exports = { log, startLogTrimmer };
