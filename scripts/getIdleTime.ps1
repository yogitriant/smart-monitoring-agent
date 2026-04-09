# Add-Type -TypeDefinition @"
# using System;
# using System.Runtime.InteropServices;

# public static class IdleTime {
#     [DllImport("user32.dll")]
#     public static extern bool GetLastInputInfo(ref LASTINPUTINFO plii);

#     [StructLayout(LayoutKind.Sequential)]
#     public struct LASTINPUTINFO {
#         public uint cbSize;
#         public uint dwTime;
#     }

#     public static uint GetIdleTime() {
#         LASTINPUTINFO lii = new LASTINPUTINFO();
#         lii.cbSize = (uint)Marshal.SizeOf(typeof(LASTINPUTINFO));
#         GetLastInputInfo(ref lii);
#         return ((uint)Environment.TickCount - lii.dwTime) / 1000;
#     }
# }
# "@

# try {
#     $idleTime = [IdleTime]::GetIdleTime()
#     Write-Output $idleTime
# } catch {
#     Write-Output 0
# }

Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;

public static class IdleTime {
    [DllImport("user32.dll")]
    public static extern bool GetLastInputInfo(ref LASTINPUTINFO plii);

    [StructLayout(LayoutKind.Sequential)]
    public struct LASTINPUTINFO {
        public uint cbSize;
        public uint dwTime;
    }

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
        [Console]::Out.Flush()   # ✅ flush biar Node langsung terima
    } catch {
        Write-Output 0
        [Console]::Out.Flush()
    }
    Start-Sleep -Milliseconds 3000
}

