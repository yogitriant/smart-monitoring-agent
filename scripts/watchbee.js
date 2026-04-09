const { exec } = require("child_process");
const path = require("path");
const fs = require("fs");
const os = require("os");

// 📁 Direktori base agent (lokasi exe)
const baseDir = path.dirname(process.execPath);

// 📍 Lokasi file pid dan log → simpan di temp (selalu writable)
const AGENT_PID_PATH = path.join(os.tmpdir(), "agent.pid");
const LOG_PATH = path.join(os.tmpdir(), "watchbee.log");

// 📁 Lokasi VBS launcher (tetap 1 folder dengan exe)
const vbsPath = path.join(baseDir, "run-silent.vbs");
const VBS_LAUNCHER = `"C:\\Windows\\System32\\wscript.exe" "${vbsPath}"`;

// 📂 Path update marker & folder
const UPDATE_FLAG = path.join(baseDir, "update.flag");
const TMP_UPDATE_DIR = path.join(baseDir, "tmp_update");
const LAST_BACKUP_MARKER = path.join(baseDir, "last_backup.flag");

// 🔁 Interval pengecekan agent (10 detik)
const INTERVAL_MS = 10000;

// 🔁 Variabel untuk Crash Loop Detection
let restartTimestamps = [];
const MAX_CRASHES = 4;
const TIME_WINDOW_MS = 60000;

// 📌 Fungsi log ke file
const log = (msg) => {
  fs.appendFileSync(LOG_PATH, `[${new Date().toISOString()}] ${msg}\n`);
};

// 🔎 Fungsi cek apakah agent hidup
function isAgentRunning() {
  try {
    if (!fs.existsSync(AGENT_PID_PATH)) return false;
    const pid = parseInt(fs.readFileSync(AGENT_PID_PATH, "utf-8"));
    process.kill(pid, 0); // check alive (tidak membunuh)
    return true;
  } catch {
    return false;
  }
}

// ▶️ Fungsi start agent (silent)
function startAgent() {
  exec(VBS_LAUNCHER, { windowsHide: true }, (err) => {
    if (err) {
      log("❌ Failed to start agent: " + err.message);
    } else {
      log("✅ Agent restarted (via VBS)");
    }
  });
}

// 🔄 Fungsi backup file lama
function backupOldFiles(version) {
  try {
    const backupDir = path.join(
      process.env.PROGRAMDATA || baseDir,
      "smart-monitoring-agent",
      "backup",
      version || "unknown"
    );
    fs.mkdirSync(backupDir, { recursive: true });

    const filesToBackup = [
      "smart-monitoring-agent.exe",
      "watchbee.exe",
      "run-silent.vbs",
      "run-watchbee.vbs",
      "config.json",
    ];

    for (const file of filesToBackup) {
      const src = path.join(baseDir, file);
      const dest = path.join(backupDir, file);
      if (fs.existsSync(src)) {
        try {
          fs.copyFileSync(src, dest);
          log(`📦 Backed up ${file}`);
        } catch (err) {
          log(`⚠️ Failed to backup ${file}: ${err.message}`);
        }
      }
    }
    
    // Simpan lokasi backup agar rollback tahu kemana harus mencari
    fs.writeFileSync(LAST_BACKUP_MARKER, backupDir, "utf-8");
  } catch (err) {
    log("❌ Backup error: " + err.message);
  }
}

// 🔄 Fungsi apply update via eksternal bat
function applyUpdate() {
  try {
    if (fs.existsSync(UPDATE_FLAG) && fs.existsSync(TMP_UPDATE_DIR)) {
      const version = fs.readFileSync(UPDATE_FLAG, "utf-8").trim();
      log(`🔄 Update detected → applying version ${version}...`);

      // 🔹 Backup dulu sebelum replace
      backupOldFiles(version);

      // 🔹 Buat file updater.bat
      const updaterBat = path.join(os.tmpdir(), "agent_updater.bat");
      const batContent = `
@echo off
echo Waiting for watchbee to exit...
timeout /t 3 /nobreak >nul
echo Copying new files...
xcopy /s /e /y "${TMP_UPDATE_DIR}\\*" "${baseDir}\\"
echo Cleaning up temp dir...
rmdir /s /q "${TMP_UPDATE_DIR}"
del "${UPDATE_FLAG}"
echo Restarting watchbee...
wscript.exe "${path.join(baseDir, "run-watchbee.vbs")}"
del "%~f0"
`;
      fs.writeFileSync(updaterBat, batContent, "utf-8");

      log("🚀 Starting external updater.bat and exiting Watchbee to release lock...");
      
      const { spawn } = require("child_process");
      const child = spawn("cmd.exe", ["/c", updaterBat], {
        detached: true,
        stdio: "ignore",
        windowsHide: true,
      });
      child.unref();

      process.exit(0);
    }
  } catch (err) {
    log("❌ Error applying update: " + err.message);
  }
}

// ⏪ Fungsi Rollback jika Crash Loop
function doRollback() {
  try {
    if (fs.existsSync(LAST_BACKUP_MARKER)) {
      const backupDir = fs.readFileSync(LAST_BACKUP_MARKER, "utf-8").trim();
      log(`⏪ Rollback initiated from: ${backupDir}`);
      if (fs.existsSync(backupDir)) {
        const rollbackBat = path.join(os.tmpdir(), "agent_rollback.bat");
        const batContent = `
@echo off
echo Waiting for watchbee to exit...
timeout /t 3 /nobreak >nul
echo Restoring old files...
xcopy /s /e /y "${backupDir}\\*" "${baseDir}\\"
echo Cleaning up marker...
del "${LAST_BACKUP_MARKER}"
echo Restarting watchbee...
wscript.exe "${path.join(baseDir, "run-watchbee.vbs")}"
del "%~f0"
`;
        fs.writeFileSync(rollbackBat, batContent, "utf-8");

        const { spawn } = require("child_process");
        const child = spawn("cmd.exe", ["/c", rollbackBat], {
          detached: true,
          stdio: "ignore",
          windowsHide: true,
        });
        child.unref();

        log("⏪ Starting external agent_rollback.bat and exiting Watchbee...");
        process.exit(0);
      }
    } else {
      log("❌ Rollback failed: LAST_BACKUP_MARKER not found.");
    }
  } catch (err) {
    log("❌ Error rolling back: " + err.message);
  }
}

// 🟢 Log awal saat watchbee dijalankan
log("🔄 Watchbee started...");

// 🔁 Loop pengecekan agent hidup/mati
setInterval(() => {
  if (!isAgentRunning()) {
    // Cek apakah ini karena update
    applyUpdate();

    // Cek crash loop
    const now = Date.now();
    restartTimestamps.push(now);
    restartTimestamps = restartTimestamps.filter(t => (now - t) < TIME_WINDOW_MS);
    
    if (restartTimestamps.length >= MAX_CRASHES) {
      log("🔥 Crash loop detected! Attempting rollback...");
      doRollback();
      return; // Stop eksekusi dan biarkan doRollback mematikan proses ini
    }

    log("💀 Agent not running. Restarting...");
    startAgent();
  }
}, INTERVAL_MS);
