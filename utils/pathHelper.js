// utils/pathHelper.js
// Standalone data path resolver — no dependency on logger
const fs = require("fs");
const os = require("os");
const path = require("path");

function getDataPath() {
  const candidates = [
    path.join("C:\\ProgramData", "SmartMonitoringAgent", "data"),
    path.join(os.homedir(), "AppData", "Local", "SmartMonitoringAgent", "data"),
    path.join(os.tmpdir(), "SmartMonitoringAgent", "data"),
  ];

  for (const dir of candidates) {
    try {
      fs.mkdirSync(dir, { recursive: true });
      // Actual write-test (not just folder access check)
      const testFile = path.join(dir, ".write-test");
      fs.writeFileSync(testFile, "ok");
      fs.unlinkSync(testFile);
      return dir;
    } catch (_) {
      // try next candidate
    }
  }
  // absolute last resort
  return path.join(os.tmpdir(), "SmartMonitoringAgent", "data");
}

module.exports = { getDataPath };
