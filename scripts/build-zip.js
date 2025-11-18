const fs = require("fs");
const path = require("path");
const archiver = require("archiver");

// Ambil versi dari package.json
const pkg = JSON.parse(fs.readFileSync("package.json", "utf-8"));
const version = pkg.version || "0.0.1";

// Path output
const outputDir = path.resolve("dist");
const zipPath = path.join(outputDir, `agent-v${version}.zip`);

if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

// Buat archive
const output = fs.createWriteStream(zipPath);
const archive = archiver("zip", { zlib: { level: 9 } });

output.on("close", () => {
  console.log(
    `✅ ZIP selesai dibuat: ${zipPath} (${(archive.pointer() / 1024).toFixed(2)} KB)`
  );
});
archive.on("error", (err) => {
  throw err;
});
archive.pipe(output);

// 🔹 File utama dari dist (nama jangan diubah!)
const mainFiles = [
  { src: "dist/smart-monitoring-agent.exe", name: "smart-monitoring-agent.exe" },
  { src: "dist/watchbee.exe", name: "watchbee.exe" },
  { src: "dist/run-silent.vbs", name: "run-silent.vbs" },
  { src: "dist/run-watchbee.vbs", name: "run-watchbee.vbs" },
  // { src: "dist/config.json", name: "config.json" },
  // { src: "dist/.env", name: ".env" },
];

mainFiles.forEach(({ src, name }) => {
  if (fs.existsSync(src)) {
    archive.file(src, { name });
  } else {
    console.warn(`⚠️ File tidak ditemukan, skip: ${src}`);
  }
});

// 🔹 File eksternal tambahan (scripts)
if (fs.existsSync("scripts/getIdleTime.ps1")) {
  archive.file("scripts/getIdleTime.ps1", { name: "scripts/getIdleTime.ps1" });
}

// Finalisasi ZIP
archive.finalize();
