# scripts/getLocation.ps1
# Memanggil Windows Location API untuk mendapatkan koordinat GPS presisi tinggi
# Menggunakan WiFi triangulation (BSSID database Microsoft/Google)

try {
    Add-Type -AssemblyName System.Device -ErrorAction Stop
    $watcher = New-Object System.Device.Location.GeoCoordinateWatcher([System.Device.Location.GeoPositionAccuracy]::High)
    $watcher.Start()

    # Tunggu max 15 detik untuk mendapatkan fix
    $timeout = 15
    $elapsed = 0
    while ($watcher.Status -ne 'Ready' -and $elapsed -lt $timeout) {
        Start-Sleep -Milliseconds 500
        $elapsed += 0.5
    }

    $pos = $watcher.Position.Location
    if (-not $pos.IsUnknown) {
        # Output format: lat,lng,accuracy(meters)
        Write-Output "$($pos.Latitude),$($pos.Longitude),$($pos.HorizontalAccuracy)"
    } else {
        Write-Output "UNAVAILABLE"
    }
    $watcher.Stop()
    $watcher.Dispose()
} catch {
    Write-Output "UNAVAILABLE"
}
