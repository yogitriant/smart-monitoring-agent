// services/idleManager.js
// Unified idle service: replaces statusService + idleReporterService + autoShutdownService
const fs = require("fs/promises");
const path = require("path");
const dayjs = require("dayjs");
const { exec } = require("child_process");
const { getIdleTime } = require("../utils/getIdleTime");
const { getDataPath } = require("../utils/pathHelper");
const { log } = require("../utils/logger");
const { runWithMutex } = require("../utils/fileMutex");

// ─── State ───────────────────────────────
let intervalId = null;
let lastStatus = null;        // "online" | "idle"
let heartbeatCount = 0;
let shutdownIssued = false;
let sessionIdleTotal = 0;     // cumulative idle this session
let lastRawIdle = 0;          // previous raw idle value
let activeStreak = 0;         // consecutive active checks (for debounce)
let baselineIdle = 0;         // rawIdle saat idleManager start (untuk opsi B)

// ─── Constants ───────────────────────────
const CHECK_INTERVAL = 5000;  // cek setiap 5 detik
const HEARTBEAT_EVERY = 6;    // heartbeat setiap 6 checks = 30s
const IDLE_THRESHOLD = 300;   // 5 menit (detik) sebelum dianggap idle
const DEBOUNCE_ACTIVE = 6;    // butuh 6x active check (30s) untuk reset dari idle
const IDLE_FILE = path.join(getDataPath(), "idle.json");

// ─── Idle file helpers ───────────────────
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

// ─── Main ────────────────────────────────
function startIdleManager(socket, config) {
  stopIdleManager();

  const idleTimeoutSec = (Number(config.idleTimeout) || 0) * 60; // menit → detik
  const shutdownDelay = Number(config.shutdownDelay) || 60;

  const shutdownInfo = idleTimeoutSec > 0
    ? `total before shutdown=${IDLE_THRESHOLD + idleTimeoutSec}s (${(IDLE_THRESHOLD + idleTimeoutSec) / 60} min)`
    : `SHUTDOWN DISABLED (idleTimeout=0)`;

  log(
    `🚀 IdleManager started | ` +
    `config.idleTimeout=${config.idleTimeout} (raw), ` +
    `idleTimeoutSec=${idleTimeoutSec}s, ` +
    `threshold=${IDLE_THRESHOLD}s, ` +
    `shutdownDelay=${shutdownDelay}s, ` +
    shutdownInfo,
    "idle"
  );

  sessionIdleTotal = 0;
  lastRawIdle = 0;
  lastStatus = null;
  heartbeatCount = 0;
  shutdownIssued = false;
  activeStreak = 0;
  baselineIdle = getIdleTime(); // snapshot idle saat start, agar hitung dari nol

  log(`📌 Baseline idle saat start: ${baselineIdle}s`, "idle");

  intervalId = setInterval(async () => {
    const rawIdle = getIdleTime(); // detik sejak last input

    // ─── 1. Determine status ───────────────
    let status;
    let effectiveIdle = 0;
    // idleSinceStart: hanya hitung idle setelah idleManager start
    const idleSinceStart = Math.max(rawIdle - baselineIdle, 0);

    if (rawIdle >= IDLE_THRESHOLD) {
      // Idle phase: past threshold
      effectiveIdle = Math.max(idleSinceStart - IDLE_THRESHOLD, 0);
      status = "idle";
      activeStreak = 0;
    } else {
      // Active phase: but apply debounce if previously idle
      activeStreak++;
      if (lastStatus === "idle" && activeStreak < DEBOUNCE_ACTIVE) {
        // Still "idle" until sustained activity (debounce)
        status = "idle";
        effectiveIdle = 0;
      } else {
        status = "online";
        activeStreak = 0;
      }
    }

    // ─── 2. Track cumulative idle ──────────
    // Only accumulate when raw idle is growing (not reset by user activity)
    if (rawIdle > lastRawIdle && status === "idle") {
      const delta = rawIdle - lastRawIdle;
      sessionIdleTotal += delta;

      // Persist daily total
      const today = dayjs().format("YYYY-MM-DD");
      try {
        await runWithMutex(IDLE_FILE, async () => {
          const data = await readIdleData();
          data[today] = (data[today] || 0) + delta;
          await writeIdleData(data);
        });
      } catch (err) {
        log("⚠️ Gagal tulis idle data: " + err.message, "idle");
      }
    }
    lastRawIdle = rawIdle;

    // ─── 3. Emit status (on change + heartbeat) ───
    heartbeatCount++;
    const shouldEmit = status !== lastStatus || heartbeatCount >= HEARTBEAT_EVERY;

    if (shouldEmit) {
      socket.emit("status", {
        pcId: config.pcId,
        status,
        timestamp: new Date().toISOString(),
      });

      if (status !== lastStatus) {
        log(`📶 Status: ${lastStatus || "init"} → ${status} (rawIdle=${rawIdle}s, effective=${effectiveIdle}s)`, "idle");
      }

      lastStatus = status;
      heartbeatCount = 0;
    }

    // ─── 4. Emit idle data (every ~60s when idle) ──
    // Use heartbeat count modulo: every 12 checks = ~60s
    if (status === "idle" && heartbeatCount % 12 === 0) {
      const today = dayjs().format("YYYY-MM-DD");
      try {
        await runWithMutex(IDLE_FILE, async () => {
          const data = await readIdleData();
          socket.emit("idle", {
            pc: config.pcId,
            date: today,
            idleSession: sessionIdleTotal,
            idleTotalToday: data[today] || 0,
          });
        });
      } catch (err) {
        log("⚠️ Gagal emit idle data: " + err.message, "idle");
      }
    }

    // ─── 5. Auto shutdown ──────────────────
    if (idleTimeoutSec > 0 && status === "idle") {
      if (effectiveIdle >= idleTimeoutSec && !shutdownIssued) {
        log(`⚠️ Idle ${effectiveIdle}s >= timeout ${idleTimeoutSec}s → shutdown in ${shutdownDelay}s`, "idle");
        
        const psScript = `Add-Type -AssemblyName PresentationFramework; [System.Windows.MessageBox]::Show('Komputer akan dimatikan dalam ${shutdownDelay} detik karena tidak aktif.', 'Peringatan System', 'OK', 'Warning')`;
        exec(`powershell -WindowStyle Hidden -Command "${psScript}"`);
        
        exec(`shutdown /s /t ${shutdownDelay}`);
        shutdownIssued = true;
      }
    }

    // Cancel shutdown if user becomes active
    if (shutdownIssued && status === "online") {
      log("✅ User aktif, shutdown dibatalkan", "idle");
      exec("shutdown /a", () => { });
      shutdownIssued = false;
    }

  }, CHECK_INTERVAL);
}

function stopIdleManager() {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
  }

  // Cancel pending shutdown
  if (shutdownIssued) {
    exec("shutdown /a", () => { });
    shutdownIssued = false;
  }

  lastStatus = null;
  heartbeatCount = 0;
  sessionIdleTotal = 0;
  lastRawIdle = 0;
  activeStreak = 0;
  baselineIdle = 0;
  log("🛑 IdleManager stopped", "idle");
}

module.exports = { startIdleManager, stopIdleManager };
