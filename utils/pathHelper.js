// utils/pathHelper.js
// Standalone data path resolver with proper Windows ACL handling
const fs = require("fs");
const os = require("os");
const path = require("path");
const { execSync } = require("child_process");

/**
 * Grant Everyone full control on a folder (with Object & Container Inheritance)
 * so files inside are accessible regardless of which user/account created them.
 */
function grantEveryoneAccess(dir) {
  try {
    execSync(`icacls "${dir}" /grant Everyone:(OI)(CI)F /Q`, { stdio: "ignore" });
  } catch (_) { /* non-critical */ }
}

function getDataPath() {
  const candidates = [
    path.join("C:\\ProgramData", "SmartMonitoringAgent", "data"),
    path.join(os.homedir(), "AppData", "Local", "SmartMonitoringAgent", "data"),
    path.join(os.tmpdir(), "SmartMonitoringAgent", "data"),
  ];

  for (const dir of candidates) {
    try {
      fs.mkdirSync(dir, { recursive: true });
      // Fix Windows ACL so any user/SYSTEM can read+write files here
      grantEveryoneAccess(dir);
      // Actual write-test
      const testFile = path.join(dir, ".write-test");
      fs.writeFileSync(testFile, "ok");
      fs.unlinkSync(testFile);
      return dir;
    } catch (_) {
      // try next candidate
    }
  }
  return path.join(os.tmpdir(), "SmartMonitoringAgent", "data");
}

module.exports = { getDataPath };
