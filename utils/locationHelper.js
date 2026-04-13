// utils/locationHelper.js
// Memanggil Windows Location API via PowerShell untuk GPS presisi tinggi (WiFi-based)

const { execSync } = require("child_process");
const path = require("path");
const fs = require("fs");
const { log } = require("./logger");

// Cache lokasi selama 30 menit (posisi gedung tidak berubah secepat itu)
let cachedLocation = null;
let lastFetchTime = 0;
const CACHE_TTL = 30 * 60 * 1000; // 30 menit

function getLocation() {
  // Return cache jika masih valid
  if (cachedLocation && (Date.now() - lastFetchTime) < CACHE_TTL) {
    return cachedLocation;
  }

  try {
    // Cari script PS1 — mendukung running dari source code DAN dari pkg-compiled exe
    let scriptPath = path.join(__dirname, "..", "scripts", "getLocation.ps1");
    if (!fs.existsSync(scriptPath)) {
      // Fallback untuk pkg snapshot
      scriptPath = path.join(path.dirname(process.execPath), "scripts", "getLocation.ps1");
    }
    if (!fs.existsSync(scriptPath)) {
      return null;
    }

    const result = execSync(
      `powershell -NoProfile -ExecutionPolicy Bypass -File "${scriptPath}"`,
      { timeout: 20000, encoding: "utf-8", windowsHide: true }
    ).trim();

    if (!result || result === "UNAVAILABLE") {
      log("📍 Windows Location Service tidak tersedia atau dimatikan", "location");
      return null;
    }

    const parts = result.split(",");
    if (parts.length >= 2) {
      const lat = parseFloat(parts[0]);
      const lng = parseFloat(parts[1]);
      const accuracy = parts[2] ? parseFloat(parts[2]) : null;

      if (!isNaN(lat) && !isNaN(lng) && lat !== 0 && lng !== 0) {
        cachedLocation = { lat, lng, accuracy };
        lastFetchTime = Date.now();
        log(`📍 GPS Fix: ${lat}, ${lng} (±${accuracy || "?"}m)`, "location");
        return cachedLocation;
      }
    }
  } catch (err) {
    log("📍 Gagal ambil lokasi GPS: " + err.message, "location");
  }

  return null;
}

module.exports = { getLocation };
