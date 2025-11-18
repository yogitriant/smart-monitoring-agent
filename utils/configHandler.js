// 📁 utils/configHandler.js
const fs = require('fs');
const path = require('path');


const CONFIG_PATH = path.join(
  process.pkg ? path.dirname(process.execPath) : path.resolve(__dirname, ".."),
  "config.json"
);

// const CONFIG_PATH = path.resolve("config.json");


function loadConfig() {
  try {
    console.log("📍 Mencoba baca config dari:", CONFIG_PATH);
    if (!fs.existsSync(CONFIG_PATH)) {
      console.log("⚠️ config.json tidak ditemukan.");
      return {};
    }

    const raw = fs.readFileSync(CONFIG_PATH, "utf-8");
    const parsed = JSON.parse(raw);
    console.log("🔑 Key ditemukan di config.json:", Object.keys(parsed));
    return parsed;
  } catch (err) {
    console.error("❌ Gagal load config:", err.message);
    return {};
  }
}

function saveConfig(newConfig) {
  try {
    let existingConfig = {};

    if (fs.existsSync(CONFIG_PATH)) {
      const raw = fs.readFileSync(CONFIG_PATH, "utf-8");
      existingConfig = JSON.parse(raw);
    }

    // Gabungkan data lama dan baru
    const mergedConfig = { ...existingConfig, ...newConfig };

    fs.writeFileSync(CONFIG_PATH, JSON.stringify(mergedConfig, null, 2));
    console.log("💾 Config disimpan:", mergedConfig);
  } catch (err) {
    console.error("❌ Gagal simpan config:", err.message);
  }
}

module.exports = { loadConfig, saveConfig };
