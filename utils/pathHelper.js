// utils/pathHelper.js
const fs = require("fs");
const os = require("os");
const path = require("path");

function getDataPath() {
  // Target utama → global ProgramData (mudah diakses, berlaku untuk semua user & SYSTEM)
  const globalPath = path.join("C:\\ProgramData", "SmartMonitoringAgent", "data");

  // Fallback → user AppData (jika PC ini punya restriksi ketat)
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
    return globalPath;
  } catch (err) {
    fs.mkdirSync(localPath, { recursive: true });
    return localPath;
  }
}

module.exports = { getDataPath };
