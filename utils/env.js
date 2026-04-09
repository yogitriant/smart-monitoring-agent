const fs = require("fs");
const path = require("path");
const { log } = require("./logger");

try {
  const dotenvPath = typeof process.pkg !== "undefined"
    ? path.join(path.dirname(process.execPath), ".env")
    : path.join(process.cwd(), ".env");
  require("dotenv").config({ path: dotenvPath });
} catch (e) {
  // ignore dotenv errors
}

let API_BASE_URL = process.env.VITE_API_URL || process.env.API_BASE_URL || "http://localhost:3000"; // Fallback default

try {
  const isPkg = typeof process.pkg !== "undefined";
  const baseDir = isPkg ? path.dirname(process.execPath) : process.cwd();
  const configPath = path.join(baseDir, "config.json");

  log(`📍 Mencoba baca config dari: ${configPath}`, "env");

  const raw = fs.readFileSync(configPath, "utf-8");
  const config = JSON.parse(raw);

  log(`🔑 Key dalam config.json: ${Object.keys(config).join(", ")}`, "env");

  if (typeof config.API_BASE_URL === "string" && config.API_BASE_URL.startsWith("http")) {
    API_BASE_URL = config.API_BASE_URL;
    log(`🌐 API_BASE_URL ditemukan: ${API_BASE_URL}`, "env");
  } else {
    log(`⚠️ API_BASE_URL tidak valid di config.json, gunakan default: ${API_BASE_URL}`, "env");
  }

} catch (err) {
  log(`⚠️ Gagal membaca config.json: ${err.message}`, "env");
  log(`🔁 Gunakan fallback API_BASE_URL: ${API_BASE_URL}`, "env");
}

exports.API_BASE_URL = API_BASE_URL;
