const path = require("path");
const fs = require("fs");

function restartAgent(reason = "unknown",customSpawn) {
  try {
    const exePath = path.resolve(__dirname, "../SmartMonitoringAgent.exe");
    const flagPath = path.resolve(__dirname, "../.restarting");

    fs.writeFileSync(flagPath, `restart-triggered ${reason}`);

    const spawn = customSpawn || require("child_process").spawn;
    const proc = spawn(exePath, [], {
      detached: true,
      stdio: "ignore",
    });

    proc.unref();

    process.exit(0);
  } catch (err) {
    console.error("❌ Restart agent gagal:", err);
  }
}

module.exports = { restartAgent };
