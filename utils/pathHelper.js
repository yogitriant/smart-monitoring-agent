// utils/pathHelper.js
const fs = require("fs");
const os = require("os");
const path = require("path");
const { log } = require("./logger");

function getDataPath() {
  const username = os.userInfo().username.toLowerCase();
  const isSystem = username.includes("system") || username.includes("service");

  // Target utama → global folder di ProgramData
  const globalPath = path.join("C:\\ProgramData", "SmartMonitoringAgent", "data");

  // Fallback → user AppData kalau global gak bisa diakses
  const localPath = path.join(
    os.homedir(),
    "AppData",
    "Local",
    "SmartMonitoringAgent",
    "data"
  );

  try {
    fs.mkdirSync(globalPath, { recursive: true });
    fs.accessSync(globalPath, fs.constants.W_OK);
    log(`📁 Menggunakan path global: ${globalPath}`, "path");
    return globalPath;
  } catch (err) {
    log(`⚠️ Tidak bisa tulis di ProgramData, fallback ke: ${localPath}`, "path");
    fs.mkdirSync(localPath, { recursive: true });
    return localPath;
  }
}

module.exports = { getDataPath };
