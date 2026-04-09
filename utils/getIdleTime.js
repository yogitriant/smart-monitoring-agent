// 📁 utils/getIdleTime.js
const { spawn } = require("child_process");
const path = require("path");
const { log } = require("./logger");
const fs = require("fs");
const os = require("os");

let lastIdle = 0;
let psProcess = null;
let restartCount = 0;
const MAX_RESTARTS = 10;
const RESTART_DELAY_MS = 5000;

// ✅ Tentukan lokasi script PowerShell
const ps1Path = path.join(
  process.pkg ? path.dirname(process.execPath) : path.resolve(__dirname, ".."),
  "scripts",
  "getIdleTime.ps1"
);

// 🚑 Fallback: kalau script nggak ada, tulis ulang ke temp folder
let scriptPath = ps1Path;
if (!fs.existsSync(ps1Path)) {
  const ps1Content = `
Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;
public static class IdleTime {
    [DllImport("user32.dll")] public static extern bool GetLastInputInfo(ref LASTINPUTINFO plii);
    [StructLayout(LayoutKind.Sequential)] public struct LASTINPUTINFO { public uint cbSize; public uint dwTime; }
    public static uint GetIdleTime() {
        LASTINPUTINFO lii = new LASTINPUTINFO();
        lii.cbSize = (uint)Marshal.SizeOf(typeof(LASTINPUTINFO));
        GetLastInputInfo(ref lii);
        return ((uint)Environment.TickCount - lii.dwTime) / 1000;
    }
}
"@
while ($true) {
    try {
        $idleTime = [IdleTime]::GetIdleTime()
        Write-Output $idleTime
        [Console]::Out.Flush()
    } catch {
        Write-Output 0
        [Console]::Out.Flush()
    }
    Start-Sleep -Milliseconds 3000
}`;
  scriptPath = path.join(os.tmpdir(), "getIdleTime.ps1");
  fs.writeFileSync(scriptPath, ps1Content, "utf-8");
  log(`⚠️ getIdleTime.ps1 tidak ditemukan, tulis ulang ke ${scriptPath}`, "idle");
}

// 🔹 Spawn PowerShell dengan auto-restart jika crash
function spawnPowershell() {
  if (psProcess) {
    try { psProcess.kill(); } catch (_) {}
  }

  psProcess = spawn("powershell.exe", [
    "-ExecutionPolicy", "Bypass",
    "-File", scriptPath,
  ]);

  psProcess.stdout.on("data", (data) => {
    const lines = data.toString().trim().split(/\r?\n/);
    for (const line of lines) {
      const val = parseInt(line.trim(), 10);
      if (!isNaN(val)) {
        lastIdle = val;
      }
    }
  });

  psProcess.stderr.on("data", (data) => {
    log(`[IdleTime Error]: ${data.toString().trim()}`, "performance");
  });

  psProcess.on("exit", (code) => {
    log(`⚠️ PowerShell idle process exited with code ${code}`, "idle");
    psProcess = null;

    if (restartCount < MAX_RESTARTS) {
      restartCount++;
      log(`🔄 Auto-restart PowerShell idle (attempt ${restartCount}/${MAX_RESTARTS})`, "idle");
      setTimeout(spawnPowershell, RESTART_DELAY_MS);
    } else {
      log(`❌ PowerShell idle max restarts (${MAX_RESTARTS}) reached, giving up`, "idle");
    }
  });

  psProcess.on("error", (err) => {
    log(`❌ PowerShell spawn error: ${err.message}`, "idle");
  });

  log("🟢 PowerShell idle process started", "idle");
}

// Start on module load
spawnPowershell();

// ✅ Fungsi yang bisa dipanggil kapan saja
function getIdleTime() {
  return lastIdle;
}

// ✅ Fungsi tambahan: idle status dengan threshold
function getIdleStatus(threshold = 300) {
  if (lastIdle >= threshold) {
    return { status: "idle", idleFor: lastIdle - threshold };
  } else {
    return { status: "active", idleFor: 0 };
  }
}

module.exports = { getIdleTime, getIdleStatus };
