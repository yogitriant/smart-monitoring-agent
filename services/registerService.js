//spec/registerService.js
const si = require("systeminformation");
const axios = require("axios");
const { execSync } = require("child_process");
const os = require("os");
const { API_BASE_URL } = require("../utils/env");
const { loadConfig, saveConfig } = require("../utils/configHandler");
const { log } = require("../utils/logger");

// 🧠 Fungsi ambil user login aktif (GUI session), fallback aman

function getCurrentUser() {
  try {
    const envUser = process.env.USERNAME || process.env.USER;
    if (envUser && envUser.toLowerCase() !== "system") {
      log(`🧑 Deteksi user login dari ENV: ${envUser}`, "register");
      return envUser;
    }
    const result = execSync("wmic computersystem get username", {
      encoding: "utf8",
    });
    const lines = result
      .trim()
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);
    const last = lines[lines.length - 1];
    if (last && !last.toLowerCase().includes("username")) {
      log(`🧑 Deteksi user login dari WMIC: ${last}`, "register");
      return last;
    }
  } catch (e) {
    log(`⚠️ WMIC gagal digunakan: ${e.message}`, "register");
  }
  try {
    const osUser = os.userInfo().username;
    log(`🧑 Deteksi user login dari OS fallback: ${osUser}`, "register");
    return osUser || "unknown";
  } catch (e) {
    log(`❌ Gagal ambil user dari os.userInfo(): ${e.message}`, "register");
    return "unknown";
  }
}

async function loadOrRegisterPc() {
  let config = await loadConfig();
  const user = getCurrentUser();

  if (config && config.pcId) {
    log("✅ pcId ditemukan: " + config.pcId, "register");
    let isServerFound = true;

    try {
      const res = await axios.get(`${API_BASE_URL}/api/pc/${config.pcId}`);
      const current = res.data;

      // ⬇️ gunakan userLogin (sesuai route backend)
      if (current?.userLogin !== user && user !== "unknown") {
        await axios.put(`${API_BASE_URL}/api/pc/${config.pcId}`, {
          userLogin: user,
        });
        log(`🧑‍💻 User login diupdate ke: ${user}`, "register");
      } else {
        log(`✅ User login tetap: ${user}`, "register");
      }
    } catch (err) {
      log("❌ Gagal cek/update user login: " + err.message, "register");
      if (err.response && err.response.status === 404) {
        log("⚠️ PC dihapus dari server (404). Mereset cache lokal agen dan pendaftaran ulang...", "register");
        isServerFound = false;

        const fs = require("fs");
        const path = require("path");
        const { getDataPath } = require("../utils/pathHelper");
        const appData = getDataPath();

        // Hapus cache
        try { fs.unlinkSync(path.join(appData, "uptime.json")); } catch (e) {}
        try { fs.unlinkSync(path.join(appData, "idle.json")); } catch (e) {}
        try { fs.unlinkSync(path.join(appData, "config.json")); } catch (e) {}

        config = null; // putus paksa, register ulang
      }
    }
    
    // Jika masih terdaftar di server, gunakan pcId lama. Jika tidak, lari ke proses registrasi dari nol.
    if (isServerFound) {
      return config.pcId;
    }
  }

  log("⚠️ config.json tidak ditemukan atau belum lengkap.", "register");
  log("⚠️ Belum ada config, memulai proses registrasi (atau reg ulang)...", "register");

  // BERSIHKAN STATISTIK LALU (Jika registrasi ini hasil reset paksa atau hapus config manual)
  const fs = require("fs");
  const path = require("path");
  const { getDataPath } = require("../utils/pathHelper");
  const appData = getDataPath();
  try { fs.unlinkSync(path.join(appData, "uptime.json")); log("🧹 uptime.json sisa dibersihkan", "register"); } catch (e) {}
  try { fs.unlinkSync(path.join(appData, "idle.json")); } catch (e) {}

  const system = await si.system();
  const cpuInfo = await si.cpu();
  const chassis = await si.chassis();
  const mem = await si.mem();
  const osInfo = await si.osInfo();
  const diskLayout = await si.diskLayout();

  const typeStr = chassis.type?.toLowerCase() || "";
  const modelStr = system.model?.toLowerCase() || "";
  const isLaptop =
    typeStr.includes("laptop") || typeStr.includes("notebook") || typeStr.includes("portable") ||
    modelStr.includes("laptop") || modelStr.includes("notebook");
  const type = isLaptop ? "LT" : "DT";
  
  let isAdmin = false;
  try {
    const netCmd = `net localgroup administrators`;
    const result = require("child_process").execSync(netCmd, { stdio: 'pipe', encoding: 'utf8' }).toLowerCase();
    isAdmin = result.includes(user.toLowerCase());
  } catch (e) {
    isAdmin = /admin|it|support/i.test(user.toLowerCase());
  }

  const serialNumber = system.serial || system.uuid || "UNKNOWN";
  const cpu = cpuInfo.brand || "UNKNOWN";
  const ram = `${(mem.total / 1024 / 1024 / 1024).toFixed(0)} GB`;
  const os = `${osInfo.distro} ${osInfo.arch}`;

  // Format storage size
  const formattedDisks = diskLayout.map(disk => {
    let sizeGB = Math.round(disk.size / (1024 * 1024 * 1024));
    let sizeStr = "";
    if (sizeGB >= 900 && sizeGB <= 1050) sizeStr = "1 TB";
    else if (sizeGB >= 1800 && sizeGB <= 2100) sizeStr = "2 TB";
    else if (sizeGB >= 3600 && sizeGB <= 4200) sizeStr = "4 TB";
    else if (sizeGB > 450 && sizeGB <= 512) sizeStr = "512 GB";
    else if (sizeGB > 220 && sizeGB <= 256) sizeStr = "256 GB";
    else if (sizeGB > 110 && sizeGB <= 128) sizeStr = "128 GB";
    else if (sizeGB >= 1000) sizeStr = `${(sizeGB / 1000).toFixed(1)} TB`;
    else sizeStr = `${sizeGB} GB`;
    
    const typeStr = disk.type ? disk.type.toUpperCase() : "Disk";
    return `${sizeStr} ${typeStr}`;
  });
  const storage = formattedDisks.join(" + ");

  const payload = {
    serialNumber,
    assetNumber: "-", // boleh tetap "-" (backend akan normalisasi)
    // ⬇️ JANGAN kirim "-" untuk pic
    // pic: "-",
    userLogin: user,
    isAdmin,
    type,
    cpu,
    ram,
    os,
    storage,
  };

  log("📦 Data dikirim ke backend: " + JSON.stringify(payload), "register");

  try {
    const res = await axios.post(`${API_BASE_URL}/api/pc/register`, payload);
    const {
      pcId: objectId,
      isAdmin: backendIsAdmin,
      type: backendType,
      userLogin: backendUserLogin,
    } = res.data;

    const newConfig = {
      pcId: objectId,
      version: "1.0.0",
      userLogin: backendUserLogin ?? user,
      isAdmin: backendIsAdmin ?? isAdmin,
      type: backendType ?? type,
      registeredAt: new Date().toISOString(),
    };

    await saveConfig(newConfig);
    log(
      "✅ pcId (ObjectId) disimpan dan konfigurasi disinkronkan: " + objectId,
      "register"
    );
    return objectId;
  } catch (err) {
    log("❌ Gagal register PC ke backend: " + err.message, "register");
    throw new Error("Gagal registrasi PC. Cek koneksi atau server backend.");
  }
}

module.exports = { loadOrRegisterPc };
