// utils/pathHelper.js
const fs = require("fs");
const os = require("os");
const path = require("path");

function getDataPath() {
  // Target utama → user AppData (tidak butuh permission khusus)
  const localPath = path.join(
    os.homedir(),
    "AppData",
    "Local",
    "SmartMonitoringAgent",
    "data"
  );

  // Fallback → global ProgramData (kalau AppData gagal, misal SYSTEM account)
  const globalPath = path.join("C:\\ProgramData", "SmartMonitoringAgent", "data");

  try {
    fs.mkdirSync(localPath, { recursive: true });
    fs.accessSync(localPath, fs.constants.W_OK);
    return localPath;
  } catch (err) {
    fs.mkdirSync(globalPath, { recursive: true });
    return globalPath;
  }
}

module.exports = { getDataPath };
