[Setup]
AppName=Smart Monitoring Agent
AppVersion=1.0.6
DefaultDirName={pf}\SmartMonitoringAgent
DefaultGroupName=Smart Monitoring Agent
OutputDir=dist
OutputBaseFilename=SmartMonitoringAgentInstaller
Compression=lzma
SolidCompression=yes

[Files]
Source: "dist\smart-monitoring-agent.exe"; DestDir: "{app}"; Flags: ignoreversion
Source: "dist\watchbee.exe"; DestDir: "{app}"; Flags: ignoreversion
Source: "dist\run-silent.vbs"; DestDir: "{app}"; Flags: ignoreversion
Source: "dist\run-watchbee.vbs"; DestDir: "{app}"; Flags: ignoreversion
Source: "dist\config.json"; DestDir: "{app}"; Flags: ignoreversion
Source: "scripts\getIdleTime.ps1"; DestDir: "{app}\scripts"; Flags: ignoreversion

[Icons]
Name: "{commonstartup}\Smart Monitoring Watchbee"; Filename: "wscript.exe"; Parameters: """{app}\run-watchbee.vbs"""

[Dirs]
Name: "{app}"; Permissions: users-modify

[Run]
Filename: "wscript.exe"; Parameters: """{app}\run-watchbee.vbs"""; Flags: nowait postinstall skipifsilent

[UninstallRun]
; Hentikan proses (jika gagal, anggap sukses)
Filename: "{cmd}"; Parameters: "/C taskkill /IM ""watchbee.exe"" /F || exit /B 0"
Filename: "{cmd}"; Parameters: "/C taskkill /IM ""smart-monitoring-agent.exe"" /F || exit /B 0"

; Hapus task scheduler (jika tidak ada, anggap sukses)
Filename: "{cmd}"; Parameters: "/C schtasks /Delete /TN ""SmartMonitoringAgent"" /F || exit /B 0"
Filename: "{cmd}"; Parameters: "/C schtasks /Delete /TN ""SmartMonitoringWatchbee"" /F || exit /B 0"

[UninstallDelete]
Type: files; Name: "{app}\config.json"
Type: filesandordirs; Name: "{app}\logs"
Type: files; Name: "{app}\scripts\getIdleTime.ps1"
