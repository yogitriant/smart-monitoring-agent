// services/agentUpdateService.js
const fs = require("fs");
const path = require("path");
const fetch = require("node-fetch");
const unzipper = require("unzipper");
const { API_BASE_URL } = require("../utils/env");
const { loadConfig, saveConfig } = require("../utils/configHandler");
const { log } = require("../utils/logger");

async function handleAgentUpdate(data, socket) {
  const { pcId, version, silent = true, force = false } = data;
  const zipUrl = `${API_BASE_URL}/agent_versions/${version}/agent.zip`;
  const config = await loadConfig();
  const currentVersion = config.version || "unknown";

  if (version === currentVersion && !force) {
    log(`⚠️ Skip update: version ${version} is already current.`, "update");
    return;
  }

  try {
    const agentDir = path.dirname(process.execPath);
    const tempZipPath = path.join(agentDir, "tmp_update.zip");
    const tempExtractDir = path.join(agentDir, "tmp_update");
    const flagFile = path.join(agentDir, "update.flag");

    log(`📂 AgentDir   : ${agentDir}`, "update");
    log(`📂 TempZipPath: ${tempZipPath}`, "update");
    log(`📂 TempExtract: ${tempExtractDir}`, "update");

    // 🔹 Opsional: backup config & VBS saja (tanpa .exe / .env)
    try {
      const backupRoot = path.join(
        process.env.PROGRAMDATA || agentDir,
        "smart-monitoring-agent",
        "backup",
        currentVersion
      );
      fs.mkdirSync(backupRoot, { recursive: true });
      const filesToBackup = ["config.json", "run-silent.vbs", "run-watchbee.vbs"];
      for (const file of filesToBackup) {
        const srcPath = path.join(agentDir, file);
        const destPath = path.join(backupRoot, file);
        if (fs.existsSync(srcPath)) {
          fs.copyFileSync(srcPath, destPath);
        }
      }
    } catch (err) {
      log(`⚠️ Backup config/VBS gagal: ${err.message}`, "update");
    }

    // 🔹 Download ZIP
    log(`🌍 Fetching ZIP: ${zipUrl}`, "update");
    const res = await fetch(zipUrl);
    if (!res.ok) throw new Error(`Gagal download zip: ${res.statusText}`);

    const fileStream = fs.createWriteStream(tempZipPath);
    await new Promise((resolve, reject) => {
      res.body.pipe(fileStream);
      res.body.on("error", reject);
      fileStream.on("finish", resolve);
    });

    // 🔹 Ekstrak ke folder tmp_update
    if (fs.existsSync(tempExtractDir)) {
      fs.rmSync(tempExtractDir, { recursive: true, force: true });
    }
    await fs
      .createReadStream(tempZipPath)
      .pipe(unzipper.Extract({ path: tempExtractDir }))
      .promise();
    fs.unlinkSync(tempZipPath);

    // 🔹 Update config versi
    config.version = version;
    config.lastUpdate = new Date().toISOString();
    await saveConfig(config);

    // 🔹 Buat marker update.flag → biar watchbee handle replace
    fs.writeFileSync(flagFile, version, "utf-8");

    socket.emit("agent-update-result", {
      pcId,
      version,
      status: "success",
      message: "Update siap, agent akan exit. Watchbee akan replace file.",
    });

    log(`✅ Update ke ${version} siap. Agent exit, tunggu watchbee.`, "update");

    // 🔹 Exit supaya watchbee jalanin update
    process.exit(0);
  } catch (err) {
    log(`❌ Gagal update ke ${version}: ${err.message}`, "update");
    socket.emit("agent-update-result", {
      pcId,
      version,
      status: "failed",
      message: err.message,
    });
  }
}

module.exports = { handleAgentUpdate };
