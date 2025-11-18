// const si = require("systeminformation");
// const axios = require("axios");
// const { API_BASE_URL } = require("../utils/env");
// const { loadConfig, saveConfig } = require("../utils/configHandler");
// const { log } = require("../utils/logger");

// async function loadOrRegisterPc() {
//   let config = await loadConfig();

//   if (config && config.pcId) {
//     log("✅ pcId ditemukan: " + config.pcId, "register");
//     return config.pcId;
//   }

//   log("⚠️ config.json tidak ditemukan atau belum lengkap.", "register");
//   log("⚠️ Belum ada config, mulai proses registrasi...", "register");

//   // Ambil data hardware
//   const system = await si.system();
//   const cpuInfo = await si.cpu();
//   const chassis = await si.chassis();
//   const mem = await si.mem();
//   const osInfo = await si.osInfo();

//   let user = "unknown";
//   try {
//     user = process.env.USERNAME || process.env.USER || "unknown";
//   } catch {
//     log("⚠️ Gagal ambil user info", "register");
//   }

//   const isLaptop =
//     chassis.type?.toLowerCase().includes("laptop") ||
//     system.model?.toLowerCase().includes("laptop");
//   const type = isLaptop ? "LT" : "DT";
//   const isAdmin = /admin|it|support/i.test(user.toLowerCase());

//   const serialNumber = system.serial || system.uuid || "UNKNOWN";
//   const cpu = cpuInfo.brand || "UNKNOWN";
//   const ram = `${(mem.total / 1024 / 1024 / 1024).toFixed(0)} GB`;
//   const os = `${osInfo.distro} ${osInfo.arch}`;

//   const payload = {
//     serialNumber,
//     assetNumber: "-",
//     pic: "-",
//     userLogin: user,
//     isAdmin,
//     type,
//     cpu,
//     ram,
//     os,
//   };

//   log("📦 Data dikirim ke backend: " + JSON.stringify(payload), "register");

//   try {
//     const res = await axios.post(`${API_BASE_URL}/api/pc/register`, payload);

//     const {
//       pcId: objectId,
//       isAdmin: backendIsAdmin,
//       type: backendType,
//       userLogin: backendUserLogin,
//     } = res.data;

//     const newConfig = {
//       pcId: objectId,
//       version: "1.0.0",
//       userLogin: backendUserLogin ?? user,
//       isAdmin: backendIsAdmin ?? isAdmin,
//       type: backendType ?? type,
//       registeredAt: new Date().toISOString(),
//     };

//     await saveConfig(newConfig);
//     log("✅ pcId (ObjectId) disimpan dan konfigurasi disinkronkan: " + objectId, "register");
//     return objectId;
//   } catch (err) {
//     log("❌ Gagal register PC ke backend: " + err.message, "register");
//     throw new Error("Gagal registrasi PC. Cek koneksi atau server backend.");
//   }
// }

// module.exports = {
//   loadOrRegisterPc,
// };

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
    const result = execSync("wmic computersystem get username", { encoding: "utf8" });
    const lines = result.trim().split("\n").map(l => l.trim()).filter(Boolean);
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
    }
    return config.pcId;
  }

  log("⚠️ config.json tidak ditemukan atau belum lengkap.", "register");
  log("⚠️ Belum ada config, mulai proses registrasi...", "register");

  const system = await si.system();
  const cpuInfo = await si.cpu();
  const chassis = await si.chassis();
  const mem = await si.mem();
  const osInfo = await si.osInfo();

  const isLaptop =
    chassis.type?.toLowerCase().includes("laptop") ||
    system.model?.toLowerCase().includes("laptop");
  const type = isLaptop ? "LT" : "DT";
  const isAdmin = /admin|it|support/i.test(user.toLowerCase());

  const serialNumber = system.serial || system.uuid || "UNKNOWN";
  const cpu = cpuInfo.brand || "UNKNOWN";
  const ram = `${(mem.total / 1024 / 1024 / 1024).toFixed(0)} GB`;
  const os = `${osInfo.distro} ${osInfo.arch}`;

  const payload = {
    serialNumber,
    assetNumber: "-",   // boleh tetap "-" (backend akan normalisasi)
    // ⬇️ JANGAN kirim "-" untuk pic
    // pic: "-", 
    userLogin: user,
    isAdmin,
    type,
    cpu,
    ram,
    os,
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
    log("✅ pcId (ObjectId) disimpan dan konfigurasi disinkronkan: " + objectId, "register");
    return objectId;
  } catch (err) {
    log("❌ Gagal register PC ke backend: " + err.message, "register");
    throw new Error("Gagal registrasi PC. Cek koneksi atau server backend.");
  }
}

module.exports = { loadOrRegisterPc };