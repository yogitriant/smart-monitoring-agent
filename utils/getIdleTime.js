// 📁 utils/getIdleTime.js
const { spawn } = require("child_process");
const path = require("path");
const { log } = require("./logger");
const fs = require("fs");
const os = require("os");

let lastIdle = 0;

// ✅ Tentukan lokasi script PowerShell
const ps1Path = path.join(
  process.pkg ? path.dirname(process.execPath) : path.resolve(__dirname, ".."),
  "scripts",
  "getIdleTime.ps1"
);

// 🚑 Fallback: kalau script nggak ada (misalnya lupa copy waktu build),
// tulis ulang script ke temp folder
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
    Start-Sleep -Milliseconds 1000
}`;
  scriptPath = path.join(os.tmpdir(), "getIdleTime.ps1");
  fs.writeFileSync(scriptPath, ps1Content, "utf-8");
  log(`⚠️ getIdleTime.ps1 tidak ditemukan, tulis ulang ke ${scriptPath}`, "idle");
}

// 🔹 spawn PowerShell sekali aja, baca output idle time terus-menerus
const ps = spawn("powershell.exe", [
  "-ExecutionPolicy",
  "Bypass",
  "-File",
  scriptPath,
]);

ps.stdout.on("data", (data) => {
  const raw = data.toString().trim();
  log(`[IdleTime Raw]: ${raw}`, "performance"); // 🔍 DEBUG ke performance.log

  const val = parseInt(raw, 10);
  if (!isNaN(val)) {
    lastIdle = val;
  }
});

ps.stderr.on("data", (data) => {
  log(`[IdleTime Error]: ${data.toString()}`, "performance");
});

// ✅ fungsi yang bisa dipanggil kapan saja
function getIdleTime() {
  return lastIdle;
}

// ✅ fungsi tambahan: idle status dengan threshold
function getIdleStatus(threshold = 300) { // default 5 menit
  if (lastIdle >= threshold) {
    return { status: "idle", idleFor: lastIdle - threshold };
  } else {
    return { status: "active", idleFor: 0 };
  }
}

module.exports = { getIdleTime, getIdleStatus};

