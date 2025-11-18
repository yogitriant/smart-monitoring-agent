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

// 🔁 Interval pengecekan agent (10 detik)
const INTERVAL_MS = 10000;

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
  } catch (err) {
    log("❌ Backup error: " + err.message);
  }
}

// 🔄 Fungsi apply update
function applyUpdate() {
  try {
    if (fs.existsSync(UPDATE_FLAG) && fs.existsSync(TMP_UPDATE_DIR)) {
      const version = fs.readFileSync(UPDATE_FLAG, "utf-8").trim();
      log(`🔄 Update detected → applying version ${version}...`);

      // 🔹 Backup dulu sebelum replace
      backupOldFiles(version);

      const files = fs.readdirSync(TMP_UPDATE_DIR);
      for (const file of files) {
        const src = path.join(TMP_UPDATE_DIR, file);
        const dest = path.join(baseDir, file);

        try {
          const stat = fs.statSync(src);
          if (stat.isDirectory()) {
            fs.cpSync(src, dest, { recursive: true });
          } else {
            fs.copyFileSync(src, dest);
          }
          log(`✅ Replaced ${file}`);
        } catch (err) {
          log(`⚠️ Failed to replace ${file}: ${err.message}`);
        }
      }

      // Bersihkan folder update
      fs.rmSync(TMP_UPDATE_DIR, { recursive: true, force: true });
      fs.unlinkSync(UPDATE_FLAG);
      log("✅ Update applied successfully.");
    }
  } catch (err) {
    log("❌ Error applying update: " + err.message);
  }
}

// 🟢 Log awal saat watchbee dijalankan
log("🔄 Watchbee started...");

// 🔁 Loop pengecekan agent hidup/mati
setInterval(() => {
  if (!isAgentRunning()) {
    // Cek apakah ini karena update
    applyUpdate();

    log("💀 Agent not running. Restarting...");
    startAgent();
  }
}, INTERVAL_MS);
