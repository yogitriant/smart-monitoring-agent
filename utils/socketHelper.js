function sendData(socket, event, data) {
  if (socket && socket.connected) {
    socket.emit(event, data);
    console.log(`📡 Emit '${event}' berhasil dikirim.`);
  } else {
    console.warn(`⚠️ Gagal kirim '${event}': Socket belum terhubung.`);
  }
}

module.exports = { sendData };
