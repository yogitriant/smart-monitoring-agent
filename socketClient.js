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

    // 🔹 Handle agent update — di-register SEKALI di luar "connect"
    // agar tidak menumpuk setiap kali reconnect
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

    // ⚠️ "agent-config-updated" ditangani di scheduler.js (satu tempat saja)
    // Tidak perlu listener duplikat di sini.

    socket.on("connect", () => {
      log(`🔌 Socket connected: ${socket.id}`, "socket");
      socket.emit("join-room", pcId);
      emitOnlineStatus();
    });
    
    // Langsung resolve socket agar scheduler bisa berjalan di background walau sedang offline
    resolve(socket);

    socket.on("reconnect", (attempt) => {
      log(`🔁 Socket reconnected after ${attempt} attempt(s)`, "socket");
      emitOnlineStatus();
    });

    socket.on("disconnect", () => {
      log("⚠️ Socket disconnected", "socket");
    });

    socket.on("connect_error", (err) => {
      log("❌ Gagal konek socket: " + err.message, "socket");
      // Jangan reject — biarkan socket.io retry otomatis
      // Hanya reject jika belum pernah connect setelah 30 detik
    });


  });
}

// ✅ Getter function — socket baru tersedia setelah connectSocket() dipanggil
function getSocket() {
  return socket;
}

module.exports = connectSocket;
module.exports.getSocket = getSocket;
