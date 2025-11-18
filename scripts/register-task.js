const { execSync } = require("child_process");
const path = require("path");

const taskName = "SmartMonitoringAgent";
// const vbsPath = path.join(__dirname, "..", "run-silent.vbs");
const vbsPath = "C:\\smart-monitoring-system\\smart-monitoring-agent\\run-silent.vbs";


// Escape path untuk Windows
const escapedPath = `"${vbsPath.replace(/\\/g, "\\\\")}"`;

try {
  console.log("📝 Mendaftarkan task scheduler...");

  // Coba hapus task jika ada
  try {
    execSync(`schtasks /Query /TN "${taskName}"`, { stdio: "ignore" });
    execSync(`schtasks /Delete /TN "${taskName}" /F`, { stdio: "ignore" });
    console.log("🧹 Task lama dihapus");
  } catch {
    console.log("ℹ️ Task belum ada sebelumnya, lanjut buat baru...");
  }

  // Buat task baru
execSync(
  `schtasks /Create /TN "${taskName}" /TR "wscript.exe ${escapedPath}" /SC ONLOGON /RL LIMITED /F /RU "${process.env.USERNAME}"`
);

  console.log("✅ Task berhasil dibuat!");
} catch (err) {
  console.error("❌ Gagal buat task:", err.message);
}
