# Fix Prisma Windows Permission Issue
Write-Host "Fixing Prisma Windows permission issue..."

# Kill any running Node processes that might be locking files
Get-Process -Name "node" -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue

# Remove Prisma cache directories
if (Test-Path "node_modules\.prisma") {
    Remove-Item -Path "node_modules\.prisma" -Recurse -Force -ErrorAction SilentlyContinue
    Write-Host "Removed root .prisma cache"
}

if (Test-Path "packages\db\node_modules\.prisma") {
    Remove-Item -Path "packages\db\node_modules\.prisma" -Recurse -Force -ErrorAction SilentlyContinue
    Write-Host "Removed db package .prisma cache"
}

# Try to generate Prisma client with retry logic
$maxRetries = 3
$retryCount = 0

do {
    $retryCount++
    Write-Host "Attempt $retryCount of $maxRetries to generate Prisma client..."
    
    try {
        Set-Location "packages\db"
        $result = & npx prisma generate 2>&1
        if ($LASTEXITCODE -eq 0) {
            Write-Host "✅ Prisma client generated successfully!"
            break
        } else {
            Write-Host "❌ Attempt $retryCount failed: $result"
        }
    } catch {
        Write-Host "❌ Attempt $retryCount failed with exception: $($_.Exception.Message)"
    }
    
    Set-Location "..\.."
    
    if ($retryCount -lt $maxRetries) {
        Write-Host "Waiting 2 seconds before retry..."
        Start-Sleep -Seconds 2
    }
} while ($retryCount -lt $maxRetries)

if ($retryCount -eq $maxRetries) {
    Write-Host "❌ Failed to generate Prisma client after $maxRetries attempts"
    Write-Host "Try running PowerShell as Administrator and run this script again"
    exit 1
}

Write-Host "✅ Prisma setup completed successfully!"
