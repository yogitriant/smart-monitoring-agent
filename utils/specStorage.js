const os = require("os");
const fs = require("fs");
const path = require("path");

const specPath = path.join(os.homedir(), ".smart-agent-spec.json");

function getStoredSpec() {
  try {
    if (!fs.existsSync(specPath)) return null;
    return JSON.parse(fs.readFileSync(specPath, "utf-8"));
  } catch {
    return null;
  }
}

function saveStoredSpec(spec) {
  try {
    fs.writeFileSync(specPath, JSON.stringify(spec, null, 2));
  } catch (err) {
    console.error("❌ Gagal simpan spesifikasi lokal:", err.message);
  }
}

module.exports = {
  getStoredSpec,
  saveStoredSpec,
};
