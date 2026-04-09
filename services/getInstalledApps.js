const { exec } = require("child_process");
const util = require("util");
const execAsync = util.promisify(exec);

// ======= Filter Configuration =======
// Pola nama yang di-SKIP (case-insensitive partial match)
const SKIP_PATTERNS = [
  // Windows Updates & Patches
  /^update for /i,
  /^security update/i,
  /^hotfix for /i,
  /^windows.*security intelligence/i,
  /^definition update/i,

  // Microsoft Visual C++ Redistributables
  /visual c\+\+.*redistributable/i,
  /visual c\+\+.*runtime/i,
  /^vcpp_crt/i,

  // .NET Framework / Runtime updates
  /^microsoft \.net/i,
  /^\.net.*runtime/i,
  /^\.net.*sdk/i,
  /^\.net.*targeting/i,

  // Drivers
  /\bdriver\b.*\bpackage\b/i,
  /^nvidia.*driver/i,
  /^intel.*driver/i,
  /^realtek.*driver/i,
  /^amd.*driver/i,
  /^synaptics/i,

  // Windows SDK / Dev tools noise
  /^windows sdk/i,
  /^windows software development/i,
  /^vs.*buildtools/i,
  /^microsoft asp\.net/i,
  /^microsoft windows desktop runtime/i,
  /^icecap/i,
  /^diagnostic/i,
  /^vs_/i,
  /^vs script/i,
  /^sdk arm/i,
  /^universal crt/i,
  /^universal general midi/i,
  /^kits configuration/i,
  /^msi development tools/i,
  /^winrt intellisense/i,
  /^windows.*extension sdk/i,
  /^windows.*certification kit/i,
  /^windows desktop extension/i,
  /^windows iot extension/i,
  /^windows mobile extension/i,
  /^windows team extension/i,
  /^winappdeploy/i,
  /^application verifier/i,

  // Office Click-to-Run sub-components
  /^office 16 click-to-run/i,

  // Python sub-packages (keep "Python 3.x.x" and "Python Launcher" only)
  /^python 3\.\d+\.\d+ (add to path|core interpreter|development|documentation|executables|pip|standard library|tcl|test suite|utility)/i,

  // System utilities noise
  /^kb\d{6,}/i,
  /^oobe/i,
  /^microsoft.*click-to-run/i,
  /^microsoft visual studio setup/i,
];

// Publisher yang di-skip (exact, case-insensitive)
const SKIP_PUBLISHERS = [];

/**
 * Ambil list aplikasi terinstall dengan filter pintar
 */
async function getInstalledApps() {
  const psCommand = `
    $apps1 = Get-ItemProperty 'HKLM:\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\*' |
      Where-Object { $_.DisplayName } |
      Select-Object DisplayName, DisplayVersion, Publisher, InstallDate;

    $apps2 = Get-ItemProperty 'HKLM:\\Software\\WOW6432Node\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\*' |
      Where-Object { $_.DisplayName } |
      Select-Object DisplayName, DisplayVersion, Publisher, InstallDate;

    $apps = $apps1 + $apps2;
    $apps | ConvertTo-Json -Depth 2
  `.trim();

  try {
    const { stdout } = await execAsync(
      `powershell -NoProfile -Command "${psCommand.replace(/\n/g, " ")}"`,
      { maxBuffer: 10 * 1024 * 1024 } // 10MB buffer for large app lists
    );

    let apps = JSON.parse(stdout.trim());
    if (!Array.isArray(apps)) apps = [apps];

    // Deduplicate by name
    const seen = new Set();
    const unique = [];
    for (const app of apps) {
      const name = (app.DisplayName || "").trim();
      if (!name || seen.has(name.toLowerCase())) continue;
      seen.add(name.toLowerCase());
      unique.push(app);
    }

    // Apply smart filter
    const filtered = unique.filter((app) => {
      const name = (app.DisplayName || "").trim();

      // Skip empty names
      if (!name) return false;

      // Skip if matches any skip pattern
      for (const pattern of SKIP_PATTERNS) {
        if (pattern.test(name)) return false;
      }

      // Skip by publisher
      const publisher = (app.Publisher || "").trim().toLowerCase();
      for (const skip of SKIP_PUBLISHERS) {
        if (publisher === skip.toLowerCase()) return false;
      }

      return true;
    });

    // Sort by name
    filtered.sort((a, b) =>
      (a.DisplayName || "").localeCompare(b.DisplayName || "")
    );

    return filtered;
  } catch (err) {
    console.error("❌ Gagal ambil list aplikasi:", err.message);
    return [];
  }
}

module.exports = {
  getInstalledApps,
};
