param(
  [Parameter(Mandatory = $true)]
  [string]$FireTvIp,
  [string]$ApkPath = "public/downloads/TenderTeddy-firetv-debug.apk",
  [switch]$SkipLaunch
)

$ErrorActionPreference = "Stop"
$repositoryRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$resolvedApk = (Resolve-Path (Join-Path $repositoryRoot $ApkPath)).Path
$adbCommand = Get-Command adb -ErrorAction SilentlyContinue
$adb = if ($adbCommand) { $adbCommand.Source } else { Join-Path $env:LOCALAPPDATA "Android\Sdk\platform-tools\adb.exe" }

if (-not (Test-Path -LiteralPath $adb)) {
  throw "ADB was not found. In Android Studio, install Android SDK Platform-Tools, then reopen PowerShell."
}

$target = if ($FireTvIp.Contains(":")) { $FireTvIp } else { "${FireTvIp}:5555" }
Write-Host "Connecting to Fire TV at $target..."
& $adb connect $target
if ($LASTEXITCODE -ne 0) { throw "ADB could not connect to $target." }

$state = (& $adb -s $target get-state 2>&1 | Out-String).Trim()
if ($LASTEXITCODE -ne 0 -or $state -ne "device") {
  throw "Fire TV is not authorised. Accept the debugging prompt on the TV, then run this command again."
}

Write-Host "Installing TenderTeddy without clearing its saved settings or app data..."
& $adb -s $target install -r $resolvedApk
if ($LASTEXITCODE -ne 0) { throw "APK installation failed." }

if (-not $SkipLaunch) {
  & $adb -s $target shell am start -n com.tenderteddy.firetv/.MainActivity
  if ($LASTEXITCODE -ne 0) { throw "TenderTeddy installed, but could not be launched automatically." }
}

Write-Host "TenderTeddy is installed. Existing app data was preserved."
