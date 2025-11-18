const axios = require("axios");
const { log } = require("./logger");
const { loadConfig } = require("./configHandler");

let idleBuffer = [];
const MAX_BUFFER_SIZE = 1000; // 🧱 Batas maksimum entries agar tidak membengkak
const AUTO_FLUSH_INTERVAL_MS = 5 * 60 * 1000; // ♻️ Auto-flush setiap 5 menit
let autoFlushTimer = null;

/**
 * Simpan nilai idle ke buffer
 * @param {number} value - idle time (detik)
 */
function pushIdle(value) {
  const timestamp = new Date();
  idleBuffer.push({ idle: value, timestamp });

  // 🧹 Jika buffer melebihi batas, hapus entri paling lama
  if (idleBuffer.length > MAX_BUFFER_SIZE) {
    const overflow = idleBuffer.length - MAX_BUFFER_SIZE;
    idleBuffer.splice(0, overflow);
    log(`⚠️ Idle buffer melebihi batas, hapus ${overflow} entri lama`, "idle");
  }
}

/**
 * Ambil dan kosongkan buffer
 * Dipanggil saat agent shutdown atau auto-flush
 */
function flushIdle() {
  const copy = [...idleBuffer];
  idleBuffer = [];
  log(`🧾 Flush idle buffer: ${copy.length} entries`, "idle");
  return copy;
}

/**
 * Kirim buffer idle ke backend
 */
async function sendIdleBuffer() {
  try {
    const cfg = await loadConfig();
    const baseUrl = cfg.API_BASE_URL?.trim();
    const pcId = cfg.pcId?.trim();
    if (!baseUrl || !pcId) {
      log("⚠️ IdleBuffer: baseUrl atau pcId kosong, skip flush", "idle");
      return;
    }

    const data = flushIdle();
    if (data.length === 0) {
      log("ℹ️ Tidak ada data idle untuk dikirim (buffer kosong)", "idle");
      return;
    }

    await axios.post(`${baseUrl}/api/idle-log/bulk`, {
      pc: pcId,
      logs: data,
    });

    log(`✅ Auto-flush ${data.length} idle logs → backend (${new Date().toLocaleTimeString()})`, "idle");
  } catch (err) {
    log(`❌ Gagal kirim idle buffer: ${err.message}`, "idle");
  }
}

/**
 * Jalankan auto-flush periodik setiap 5 menit
 */
function startAutoFlush() {
  if (autoFlushTimer) clearInterval(autoFlushTimer);
  autoFlushTimer = setInterval(sendIdleBuffer, AUTO_FLUSH_INTERVAL_MS);
  log(`🚀 Auto-flush idle buffer dimulai (${AUTO_FLUSH_INTERVAL_MS / 60000} menit)`, "idle");
}

/**
 * Hentikan auto-flush periodik
 */
function stopAutoFlush() {
  if (autoFlushTimer) clearInterval(autoFlushTimer);
  autoFlushTimer = null;
  log("🛑 Auto-flush idle buffer dihentikan", "idle");
}

/**
 * Dapatkan jumlah data buffer saat ini
 */
function getIdleBufferLength() {
  return idleBuffer.length;
}

module.exports = {
  pushIdle,
  flushIdle,
  sendIdleBuffer,
  startAutoFlush,
  stopAutoFlush,
  getIdleBufferLength,
};
