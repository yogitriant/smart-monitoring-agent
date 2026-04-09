const os = require('os');
const si = require('systeminformation');
const { execSync } = require('child_process');

export async function getHardwareInfo() {
  const system = await si.system();
  const cpu = await si.cpu();
  const mem = await si.mem();
  const osInfo = await si.osInfo();
  const chassis = await si.chassis();

  // Fallback serial
  const serialNumber = system.serial || system.uuid || "UNKNOWN";

  // CPU
  const cpuModel = `${cpu.manufacturer || ""} ${cpu.brand || ""}`.trim();

  // RAM
  const ram = mem.total
    ? `${(mem.total / 1024 ** 3).toFixed(1)} GB`
    : "UNKNOWN";

  // OS
  const osText = `${osInfo.distro || "Unknown OS"} ${
    osInfo.release || ""
  }`.trim();

  // Username & Admin Detection via WMI / PowerShell
  let userLogin = "unknown";
  let isAdmin = false;

  try {
    // Dapatkan username interaktif aktif
    const stdoutUser = execSync('powershell -NoProfile -Command "(Get-WmiObject -Class Win32_ComputerSystem).UserName"', { stdio: 'pipe' }).toString().trim();
    if (stdoutUser && stdoutUser.toLowerCase() !== "null" && stdoutUser !== "") {
      userLogin = stdoutUser.split('\\').pop() || stdoutUser;
      
      // Cek keanggotaan grup Administrator lokal menggunakan net localgroup administrators
      try {
        const netCmd = `net localgroup administrators`;
        const result = execSync(netCmd, { stdio: 'pipe', encoding: 'utf8' }).toLowerCase();
        // userLogin mungkin berisi domain\username atau hanya username
        isAdmin = result.includes(userLogin.toLowerCase());
      } catch (e) {
        isAdmin = /admin|it|support/i.test(userLogin.toLowerCase());
      }
    } else {
      // Fallback
      userLogin = os.userInfo().username || "unknown";
      isAdmin = /admin|it|support/i.test(userLogin.toLowerCase());
    }
  } catch (e) {
    // Fallback jika WMI / Powershell gagal
    try { userLogin = os.userInfo().username || "unknown"; } catch (err) {}
    isAdmin = /admin|it|support/i.test(userLogin.toLowerCase());
  }

  // Deteksi jenis perangkat
  const isLaptop =
    (chassis.type || "").toLowerCase().includes("laptop") ||
    (system.model || "").toLowerCase().includes("laptop");
  const type = isLaptop ? "LT" : "DT";

  return {
    serialNumber,
    cpu: cpuModel,
    ram,
    os: osText,
    userLogin,
    isAdmin,
    type,
  };
}
