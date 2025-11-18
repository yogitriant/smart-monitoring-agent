const os = require('os');
const si = require('systeminformation');

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

  // Username fallback
  let userLogin = "unknown";
  try {
    userLogin = os.userInfo().username || "unknown";
  } catch {
    // bisa log error jika perlu
  }

  // Deteksi jenis perangkat
  const isLaptop =
    (chassis.type || "").toLowerCase().includes("laptop") ||
    (system.model || "").toLowerCase().includes("laptop");
  const type = isLaptop ? "LT" : "DT";

  // Deteksi admin sederhana
  const isAdmin = /admin|it|support/i.test(userLogin.toLowerCase());

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
