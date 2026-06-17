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

// ⏳ Helper sleep (promise-based)
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

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

// 🔪 Fungsi kill agent secara paksa
function killAgent() {
  try {
    if (!fs.existsSync(AGENT_PID_PATH)) return;
    const pid = parseInt(fs.readFileSync(AGENT_PID_PATH, "utf-8"));
    try {
      process.kill(pid, "SIGTERM");
      log(`🔪 Killed agent process (PID: ${pid})`);
    } catch {
      // Process sudah mati, no-op
    }
  } catch (err) {
    log(`⚠️ Error killing agent: ${err.message}`);
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

// 📁 Fungsi copy file recursive dari src ke dest (skip file tertentu)
function copyFilesRecursive(srcDir, destDir, skipFiles = []) {
  const entries = fs.readdirSync(srcDir, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(srcDir, entry.name);
    const destPath = path.join(destDir, entry.name);

    if (entry.isDirectory()) {
      fs.mkdirSync(destPath, { recursive: true });
      copyFilesRecursive(srcPath, destPath, skipFiles);
    } else {
      // Skip file yang tidak boleh di-overwrite (watchbee.exe)
      if (skipFiles.includes(entry.name.toLowerCase())) {
        log(`⏭️ Skipped ${entry.name} (excluded from OTA)`);
        continue;
      }
      try {
        fs.copyFileSync(srcPath, destPath);
        log(`📁 Copied ${entry.name}`);
      } catch (err) {
        log(`⚠️ Failed to copy ${entry.name}: ${err.message}`);
      }
    }
  }
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

// 🔄 Fungsi apply update — LANGSUNG tanpa external script
async function applyUpdate() {
  try {
    if (!fs.existsSync(UPDATE_FLAG) || !fs.existsSync(TMP_UPDATE_DIR)) return;

    const version = fs.readFileSync(UPDATE_FLAG, "utf-8").trim();
    log(`🔄 Update detected → applying version ${version}...`);

    // 1. Kill agent dulu agar file tidak di-lock
    killAgent();

    // 2. Tunggu file lock release
    await sleep(2000);

    // 3. Backup file lama
    backupOldFiles(version);

    // 4. Copy file dari tmp_update ke baseDir (SKIP watchbee.exe)
    copyFilesRecursive(TMP_UPDATE_DIR, baseDir, ["watchbee.exe"]);

    // 5. Cleanup: hapus folder tmp_update dan flag
    try {
      fs.rmSync(TMP_UPDATE_DIR, { recursive: true, force: true });
      log("🗑️ Cleaned up tmp_update folder");
    } catch (err) {
      log(`⚠️ Cleanup tmp_update error: ${err.message}`);
    }

    try {
      fs.unlinkSync(UPDATE_FLAG);
      log("🗑️ Removed update.flag");
    } catch (err) {
      log(`⚠️ Cleanup update.flag error: ${err.message}`);
    }

    // 6. Start agent kembali
    log(`✅ Update ${version} applied! Starting agent...`);
    startAgent();
  } catch (err) {
    log("❌ Error applying update: " + err.message);
  }
}

// ⏪ Fungsi Rollback jika Crash Loop — LANGSUNG tanpa external script
async function doRollback() {
  try {
    if (!fs.existsSync(LAST_BACKUP_MARKER)) {
      log("❌ Rollback failed: LAST_BACKUP_MARKER not found.");
      return;
    }

    const backupDir = fs.readFileSync(LAST_BACKUP_MARKER, "utf-8").trim();
    log(`⏪ Rollback initiated from: ${backupDir}`);

    if (!fs.existsSync(backupDir)) {
      log("❌ Rollback failed: backup directory not found.");
      return;
    }

    // 1. Kill agent
    killAgent();
    await sleep(2000);

    // 2. Copy file backup kembali ke baseDir
    copyFilesRecursive(backupDir, baseDir, ["watchbee.exe"]);

    // 3. Hapus marker
    try {
      fs.unlinkSync(LAST_BACKUP_MARKER);
    } catch { }

    // 4. Start agent
    log("⏪ Rollback complete! Starting agent...");
    startAgent();
  } catch (err) {
    log("❌ Error rolling back: " + err.message);
  }
}

// 🟢 Log awal saat watchbee dijalankan
log("🔄 Watchbee started...");

// 🔁 Main loop — async agar bisa await sleep di applyUpdate
(async function mainLoop() {
  while (true) {
    if (!isAgentRunning()) {
      // Cek apakah ini karena update
      await applyUpdate();

      // Beri waktu agent untuk start dan tulis PID file
      await sleep(3000);

      // Kalau agent masih mati setelah applyUpdate (bukan karena update),
      // cek crash loop lalu restart
      if (!isAgentRunning()) {
        const now = Date.now();
        restartTimestamps.push(now);
        restartTimestamps = restartTimestamps.filter(
          (t) => now - t < TIME_WINDOW_MS
        );

        if (restartTimestamps.length >= MAX_CRASHES) {
          log("🔥 Crash loop detected! Attempting rollback...");
          await doRollback();
        } else {
          log("💀 Agent not running. Restarting...");
          startAgent();
        }
      }
    }
    await sleep(INTERVAL_MS);
  }
})();
