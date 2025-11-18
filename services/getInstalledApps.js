const { exec } = require("child_process");
const util = require("util");
const execAsync = util.promisify(exec);

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
      `powershell -NoProfile -Command "${psCommand.replace(/\n/g, " ")}"`
    );
    const apps = JSON.parse(stdout.trim());
    return Array.isArray(apps) ? apps : [apps];
  } catch (err) {
    console.error("❌ Gagal ambil list aplikasi:", err.message);
    return [];
  }
}

module.exports = {
  getInstalledApps,
};
