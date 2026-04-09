const { execFile, exec } = require("child_process");
const fs = require("fs");
const path = require("path");
const os = require("os");
const { log } = require("../utils/logger");

function startScriptRunner(socket, config) {
  socket.on("run-script", (data) => {
    const { scriptId, logId, name, type, content } = data;
    log(`📥 Menerima perintah eksekusi script: ${name} (${type})`, "scriptRunner");

    try {
      // Tentukan ekstensi
      const ext = type === "ps1" ? ".ps1" : type === "sh" ? ".sh" : ".bat";
      
      // Buat file sementara di folder temp OS
      const tmpFilename = `script_${scriptId}_${Date.now()}${ext}`;
      const tmpFilePath = path.join(os.tmpdir(), tmpFilename);
      
      fs.writeFileSync(tmpFilePath, content, { encoding: "utf8" });
      log(`📝 Script disimpan sementara di: ${tmpFilePath}`, "scriptRunner");

      let command = "";
      let args = [];

      if (type === "ps1") {
        command = "powershell.exe";
        args = ["-ExecutionPolicy", "Bypass", "-File", tmpFilePath];
      } else if (type === "cmd" || type === "bat") {
        command = "cmd.exe";
        args = ["/c", tmpFilePath];
      } else {
        // Fallback untuk sh kalau di linux/git bash
        command = "sh";
        args = [tmpFilePath];
      }

      log(`▶️ Mengeksekusi: ${command} ${args.join(" ")}`, "scriptRunner");
      
      execFile(command, args, { maxBuffer: 1024 * 1024 * 5 }, (error, stdout, stderr) => {
        // Hapus file sementara setelah dieksekusi agar bersih
        try {
          if (fs.existsSync(tmpFilePath)) {
            fs.unlinkSync(tmpFilePath);
          }
        } catch (cleanupErr) {
          log(`⚠️ Gagal menghapus file temp ${tmpFilePath}: ${cleanupErr.message}`, "scriptRunner");
        }

        const outputData = [];
        if (stdout) outputData.push(stdout);
        if (stderr) outputData.push(`[STDERR]\n${stderr}`);
        if (error) outputData.push(`[ERROR]\n${error.message}`);
        
        const finalOutput = outputData.join("\n").trim() || "Tidak ada output";

        log(`✅ Eksekusi selesai. Mengirim log result ke server...`, "scriptRunner");

        // Kirim hasil kembali ke server
        socket.emit("script-result", {
          logId,
          pcId: config.pcId,
          status: error ? "failed" : "success",
          output: finalOutput,
        });
      });
    } catch (err) {
      log(`❌ Error ketika menyiapkan script: ${err.message}`, "scriptRunner");
      socket.emit("script-result", {
        logId,
        pcId: config.pcId,
        status: "failed",
        output: `Error menyiapkan script: ${err.message}`,
      });
    }
  });
}

module.exports = { startScriptRunner };
