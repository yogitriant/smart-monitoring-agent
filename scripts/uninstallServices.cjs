const { Service } = require("node-windows");
const path = require("path");

const svc = new Service({
  name: "Smart Monitoring Agent",
  script: path.join(__dirname, "../index.js"), // pastikan sama seperti saat install
});

svc.on("uninstall", () => {
  console.log("🗑️  Service uninstalled.");
  console.log("👉 Service exists after uninstall?", svc.exists);
});

svc.on("error", (err) => {
  console.error("❌ Error uninstalling service:", err);
});

svc.uninstall();
