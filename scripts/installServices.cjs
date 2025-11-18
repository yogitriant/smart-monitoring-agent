const { Service } = require("node-windows");
const path = require("path");

const svc = new Service({
  name: "Smart Monitoring Agent",
  description: "Monitoring Agent for Smart Monitoring System",
  script: path.join(__dirname, "../index.js"), // file agent utama
  wait: 2,
  grow: 0.5,
  maxRetries: 3,
  maxRestarts: 3,
  nodeOptions: ["--enable-source-maps"],
});

svc.on("install", () => {
  console.log("✅ Service installed.");
  svc.start();
});

svc.on("alreadyinstalled", () => {
  console.log("⚠️ Service already installed.");
});

svc.on("start", () => {
  console.log("🚀 Service started.");
});

svc.on("error", (err) => {
  console.error("❌ Error starting service:", err);
});

svc.install();
