// const si = require("systeminformation");
// const { sendData } = require("../utils/socketHelper");
// const { getStoredSpec, saveStoredSpec } = require("../utils/specStorage");
// const { log } = require("../utils/logger");

// async function startSpecService(socket, config, force = false) {
//   try {
//     const spec = await collectSpec();
//     const lastSpec = await getStoredSpec();

//     const isDifferent =
//       force || JSON.stringify(spec) !== JSON.stringify(lastSpec);

//     if (isDifferent) {
//   const payload = { pcId: config.pcId, ...spec };
//   log("📡 Kirim ke socket:", payload, "spec");

//   sendData(socket, "spec", payload);
//   await saveStoredSpec(spec);
//   log("🖥️ Spesifikasi dikirim dan disimpan.", "spec");
// }
//   } catch (err) {
//     log("❌ Gagal ambil/kirim spesifikasi: " + err.message, "spec");
//   }
// }

// async function collectSpec() {
//   const cpu = await si.cpu();
//   const mem = await si.mem();
//   const os = await si.osInfo();
//   const disk = await si.diskLayout();
//   const bios = await si.bios();
//   const gpu = await si.graphics();
//   const net = await si.networkInterfaces();
//   const baseboard = await si.baseboard();
//   const resolution = await si.graphics();

//   return {
//     brand: baseboard.manufacturer || bios.vendor || "-",
//     model: baseboard.model || "-",
//     cpu: `${cpu.manufacturer} ${cpu.brand}`,
//     ram: `${Math.round(mem.total / 1024 / 1024 / 1024)} GB`,
//     os: `${os.distro} ${os.arch}`,
//     gpu: gpu.controllers.map((g) => g.model).join(", "),
//     macAddress: net[0]?.mac || "-",
//     ipAddress: net[0]?.ip4 || "-",
//     resolution:
//       resolution.displays[0]?.currentResX && resolution.displays[0]?.currentResY
//         ? `${resolution.displays[0].currentResX}x${resolution.displays[0].currentResY}`
//         : "-",
//     disk: disk.map((d, i) => ({
//       drive: String.fromCharCode(67 + i), // C, D, E
//       type: d.type || "SSD",
//       total: `${(d.size / 1024 / 1024 / 1024).toFixed(0)} GB`,
//     })),
//     bios: bios.vendor,
//   };
// }

// module.exports = startSpecService;
const si = require("systeminformation");
const { sendData } = require("../utils/socketHelper");
const { getStoredSpec, saveStoredSpec } = require("../utils/specStorage");
const { log } = require("../utils/logger");

// ====== Configurable threshold (GB) ======
const DISK_DELTA_GB_THRESHOLD = 100;

// ---- helpers ----
const toInt = (v) => (v == null ? null : Number(v));
const parseGbNumber = (v) => {
  // terima 238, "238", "238 GB", "238GB", "238.4 gb"
  if (v == null) return null;
  if (typeof v === "number") return v;
  const m = String(v).match(/([\d.]+)/);
  return m ? Math.round(Number(m[1])) : null;
};

const bytesToGB = (bytes) => Math.round(bytes / 1024 / 1024 / 1024);

// normalisasi array disk → map by drive letter, dan angka GB murni
function normalizeDisks(disks = []) {
  // pastikan deterministik
  const sorted = [...disks].sort((a, b) => String(a.drive).localeCompare(String(b.drive)));
  const map = {};
  for (const d of sorted) {
    const drive = String(d.drive || "").toUpperCase(); // "C", "D"
    const type = d.type || "SSD";
    // dukung input lama: { total: "238 GB" } atau baru: { totalGB: 238 } atau dari si: { size(bytes) }
    const totalGB =
      parseGbNumber(d.totalGB) ??
      (d.totalBytes ? bytesToGB(d.totalBytes) : null) ??
      parseGbNumber(d.total);
    if (!drive) continue;
    map[drive] = { drive, type, totalGB: toInt(totalGB) };
  }
  return map;
}

// bandingkan dua set disk dengan threshold per drive
function diskChanged(prevDisks = {}, currDisks = {}, thresholdGB = DISK_DELTA_GB_THRESHOLD) {
  const drives = new Set([...Object.keys(prevDisks), ...Object.keys(currDisks)]);
  for (const drv of drives) {
    const p = prevDisks[drv]?.totalGB ?? null;
    const c = currDisks[drv]?.totalGB ?? null;
    if (p == null || c == null) continue; // kalau salah satu null, anggap tidak signifikan (biar tidak spam)
    if (Math.abs(c - p) >= thresholdGB) return true;
  }
  return false;
}

// deep compare ringan untuk field selain disk / bios
function shallowEqual(a, b) {
  const ka = Object.keys(a || {}).sort();
  const kb = Object.keys(b || {}).sort();
  if (ka.length !== kb.length) return false;
  for (let i = 0; i < ka.length; i++) {
    if (ka[i] !== kb[i]) return false;
    if (a[ka[i]] !== b[kb[i]]) return false;
  }
  return true;
}

/** tentukan apakah spec “berarti berubah” */
function isMeaningfullyDifferent(prev = {}, curr = {}) {
  // bandingkan field non-disk & tanpa bios
  const pick = (s) => ({
    hostname: s.hostname ?? "-",
    brand: s.brand ?? "-",
    model: s.model ?? "-",
    cpu: s.cpu ?? "-",
    ram: s.ram ?? "-",
    os: s.os ?? "-",
    gpu: s.gpu ?? "-",
    macAddress: s.macAddress ?? "-",
    ipAddress: s.ipAddress ?? "-",
    resolution: s.resolution ?? "-",
    // bios sengaja DIHILANGKAN
  });

  if (!shallowEqual(pick(prev), pick(curr))) return true;

  // khusus disk: gunakan threshold
  const prevDisks = normalizeDisks(prev.disk || []);
  const currDisks = normalizeDisks(curr.disk || []);
  if (diskChanged(prevDisks, currDisks)) return true;

  return false;
}

// ====================== VALIDATION ======================
/** 
 * Memastikan hasil query systeminformation valid, 
 * tidak kosong akibat kegagalan WMI Windows
 */
function isValidSpec(s) {
  if (!s) return false;
  if (!s.cpu || s.cpu.trim() === "" || s.cpu.trim() === "-") return false;
  if (!s.os || s.os.trim() === "x64" || s.os.trim() === "") return false;
  if (!Array.isArray(s.disk) || s.disk.length === 0) return false;
  return true;
}

// ====================== SERVICE ======================
async function startSpecService(socket, config, force = false) {
  try {
    const spec = await collectSpec(); // sudah tanpa BIOS
    const lastSpec = await getStoredSpec();

    if (!isValidSpec(spec)) {
      log("⚠️ Spesifikasi tidak lengkap (kemungkinan kegagalan WMI), mengabaikan...", "spec");
      return;
    }

    const changed = force || isMeaningfullyDifferent(lastSpec, spec);
    if (changed) {
      const payload = { pcId: config.pcId, ...spec };
      log("📡 Kirim ke socket:", payload, "spec");
      sendData(socket, "spec", payload);
      await saveStoredSpec(spec);
      log("🖥️ Spesifikasi dikirim dan disimpan.", "spec");
    } else {
      log("ℹ️ Spesifikasi tidak berubah secara signifikan (>=100GB untuk disk).", "spec");
    }
  } catch (err) {
    log("❌ Gagal ambil/kirim spesifikasi: " + err.message, "spec");
  }
}

async function collectSpec() {
  const [cpu, mem, os, diskLayout, gpu, nets, baseboard, graphics] = await Promise.all([
    si.cpu(),
    si.mem(),
    si.osInfo(),
    si.diskLayout(),
    si.graphics(),
    si.networkInterfaces(),
    si.baseboard(),
    si.graphics(), // dipakai untuk resolusi
  ]);

  // ambil interface aktif & bukan virtual jika ada
  const nic =
    nets.find((n) => n.operstate === "up" && !n.virtual && n.mac) ||
    nets[0] ||
    {};

  return {
    hostname: os.hostname || "-",
    brand: baseboard.manufacturer || "-",
    model: baseboard.model || "-",
    cpu: `${cpu.manufacturer} ${cpu.brand}`.trim(),
    ram: `${Math.round(mem.total / 1024 / 1024 / 1024)} GB`,
    os: `${os.distro} ${os.arch}`.trim(),
    gpu: (gpu.controllers || []).map((g) => g.model).filter(Boolean).join(", "),
    macAddress: nic.mac || "-",
    ipAddress: nic.ip4 || "-",
    resolution:
      graphics.displays?.[0]?.currentResX && graphics.displays?.[0]?.currentResY
        ? `${graphics.displays[0].currentResX}x${graphics.displays[0].currentResY}`
        : "-",
    // BIOS DIHAPUS
    disk: (diskLayout || []).map((d, i) => ({
      drive: String.fromCharCode(67 + i), // C, D, E ...
      type: d.type || "SSD",
      totalBytes: d.size || null,
      totalGB: d.size ? bytesToGB(d.size) : null, // angka murni untuk diff
      // total (string) opsional untuk display, tidak dipakai diff
      total: d.size ? `${bytesToGB(d.size)} GB` : "-",
    })),
  };
}

module.exports = startSpecService;
