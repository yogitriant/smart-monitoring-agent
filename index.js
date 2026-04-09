const fs = require("fs");
const path = require("path");
const os = require("os");
const { loadConfig, saveConfig } = require("./utils/configHandler");
const { loadOrRegisterPc } = require("./services/registerService");
const connectSocket = require("./socketClient");
const { startScheduler } = require("./scheduler");
const { log } = require("./utils/logger");
const { API_BASE_URL } = require("./utils/env");
const { getDataPath } = require("./utils/pathHelper");

// 🧠 Tulis PID di folder temp
try {
  fs.writeFileSync(path.join(os.tmpdir(), "agent.pid"), process.pid.toString());
} catch (err) {
  log("⚠️ Gagal menulis PID file: " + err.message);
}

// 🧾 Redirect console.log ke logger kalau dibuild jadi .exe
if (process.pkg) {
  console.log = (...args) => log(args.join(" "));
  console.error = (...args) => log("[ERR] " + args.join(" "));
}

// 🧩 Tampilkan info data path aktif
const dataPath = getDataPath();
log(`📂 Data path aktif: ${dataPath}`, "init");

// 🧠 Main entry
const main = async () => {
  let config = await loadConfig();
  if (!config || !config.pcId) {
    await loadOrRegisterPc();
    config = await loadConfig();
  }

  let socket;
  // Mengambil instance socket tanpa memblokir dari koneksi berhasil
  socket = await connectSocket(config.pcId);

  await startScheduler(socket, config);
};

main().catch((err) => log("❌ Unhandled error: " + err.message));
