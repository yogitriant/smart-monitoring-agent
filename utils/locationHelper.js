const { exec } = require("child_process");
const path = require("path");
const fs = require("fs");
const os = require("os");
const { log } = require("./logger");

// Cache lokasi selama 30 menit (posisi gedung tidak berubah secepat itu)
let cachedLocation = null;
let lastFetchTime = 0;
const CACHE_TTL = 30 * 60 * 1000; // 30 menit

async function getLocation() {
  // Return cache jika masih valid
  if (cachedLocation && (Date.now() - lastFetchTime) < CACHE_TTL) {
    return cachedLocation;
  }

  return new Promise((resolve) => {
    try {
      // 📦 Handle PKG Snapshot: PowerShell tidak bisa baca file di dalam .exe
      // Kita harus extract script ke folder temp beneran
      let scriptSource = path.join(__dirname, "..", "scripts", "getLocation.ps1");
      const tempScriptPath = path.join(os.tmpdir(), "sm-get-location.ps1");

      // Jika running dari PKG, extract file-nya ke temp
      try {
        const content = fs.readFileSync(scriptSource);
        fs.writeFileSync(tempScriptPath, content);
      } catch (err) {
        // Fallback: jika /scripts tidak ketemu di __dirname, coba base path
        try {
          scriptSource = path.join(path.dirname(process.execPath), "scripts", "getLocation.ps1");
          const content = fs.readFileSync(scriptSource);
          fs.writeFileSync(tempScriptPath, content);
        } catch (e) {
          log("📍 Script getLocation.ps1 tidak ditemukan", "location");
          return resolve(null);
        }
      }

      // Jalankan secara ASYNC agar agen tidak nge-lag (PowerShell nunggu fix bisa 15 detik)
      exec(
        `powershell -NoProfile -ExecutionPolicy Bypass -File "${tempScriptPath}"`,
        { timeout: 30000, windowsHide: true },
        (error, stdout) => {
          // Bersihkan file temp setelah dipakai (optional, tapi baik untuk security)
          try { if (fs.existsSync(tempScriptPath)) fs.unlinkSync(tempScriptPath); } catch (e) {}

          if (error) {
            log("📍 Gagal ambil lokasi GPS: " + error.message, "location");
            return resolve(null);
          }

          const result = stdout.trim();
          if (!result || result === "UNAVAILABLE") {
            log("📍 Windows Location Service tidak tersedia atau dimatikan", "location");
            return resolve(null);
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
              return resolve(cachedLocation);
            }
          }
          resolve(null);
        }
      );
    } catch (err) {
      log("📍 Gagal inisiasi GPS: " + err.message, "location");
      resolve(null);
    }
  });
}

module.exports = { getLocation };
