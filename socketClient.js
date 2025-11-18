const { io } = require("socket.io-client");
const { API_BASE_URL } = require("./utils/env");
const { handleAgentUpdate } = require("./services/agentUpdateService");
const { loadConfig } = require("./utils/configHandler");
const { log } = require("./utils/logger");

let socket;

async function connectSocket(pcId) {
  const config = await loadConfig();
  if (!config || !config.pcId) {
    console.error("❌ config.json tidak ditemukan. Aplikasi dihentikan.");
    process.exit(1);
  }

  return new Promise((resolve, reject) => {
    socket = io(API_BASE_URL, {
      transports: ["websocket"],
      reconnection: true,
    });

    const emitOnlineStatus = () => {
      log(`📡 [AGENT] Emitting status ONLINE untuk pcId: ${pcId}`, "socket");
      socket.emit("status", {
        pcId,
        status: "online",
        timestamp: new Date(),
      });
    };

    socket.on("connect", () => {
      log(`🔌 Socket connected: ${socket.id}`, "socket");
      socket.emit("join-room", pcId);
      emitOnlineStatus();

      // 🔹 Handle agent update (file version, update exe, dll)
      socket.on("agent-update", async (data) => {
        log(`📦 Received agent-update: ${JSON.stringify(data)}`, "socket");
        try {
          await handleAgentUpdate(data, socket);
        } catch (err) {
          console.error("❌ Update agent gagal:", err.message);
          socket.emit("agent-update-result", {
            pcId: data.pcId,
            version: data.version,
            status: "failed",
            message: err.message,
          });
        }
      });

      // 🔹 Handle config update (from backend broadcast)
      socket.on("agent-config-updated", async () => {
        log("🔁 Received agent-config-updated event", "socket");
        try {
          const res = await fetch(`${API_BASE_URL}/api/settings/agent-config/${pcId}`);
          const updatedConfig = await res.json();

          const {
            startUptimeService,
            stopUptimeService,
          } = require("./services/uptimeService");

          const {
            startAutoShutdownService,
            stopAutoShutdownService,
          } = require("./services/autoShutdownService");

          const {
            setPerformanceInterval,
          } = require("./services/performanceService");

          // Gabungkan config lama dan baru
          const currentConfig = {
            ...(await loadConfig()),
            ...updatedConfig,
          };

          // 🔹 Update interval performance secara realtime (tanpa restart)
          if (typeof updatedConfig.performanceInterval === "number") {
            const perfMs = updatedConfig.performanceInterval * 1000;
            setPerformanceInterval(socket, currentConfig, perfMs);
            log(`⚙️ Performance interval diubah ke ${perfMs / 1000}s`, "socket");
          }

          // 🔹 Restart service lain yang butuh refresh penuh
          stopUptimeService();
          stopAutoShutdownService();

          startUptimeService(socket, currentConfig, currentConfig.uptimeInterval);
          startAutoShutdownService(socket, currentConfig);

          log("✅ Agent config reloaded & applied successfully", "socket");
        } catch (err) {
          log("❌ Gagal reload config agent: " + err.message, "socket");
        }
      });

      resolve(socket);
    });

    socket.on("reconnect", (attempt) => {
      log(`🔁 Socket reconnected after ${attempt} attempt(s)`, "socket");
      emitOnlineStatus();
    });

    socket.on("disconnect", () => {
      log("⚠️ Socket disconnected", "socket");
    });

    socket.on("connect_error", (err) => {
      log("❌ Gagal konek socket: " + err.message, "socket");
      reject(err);
    });
  });
}

module.exports = connectSocket;
module.exports.socket = socket;
