$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$scriptDir = Split-Path -Parent $PSCommandPath
$desktopRoot = Split-Path -Parent $scriptDir
$makeRoot = Join-Path $desktopRoot 'out/make'

if (-not (Test-Path -Path $makeRoot)) {
  throw "Installer output path not found: $makeRoot. Run 'pnpm --filter @devsuite/desktop make:win' first."
}

$setupCandidate = Get-ChildItem -Path $makeRoot -Recurse -Filter '*Setup*.exe' |
  Sort-Object LastWriteTimeUtc -Descending |
  Select-Object -First 1

if ($null -eq $setupCandidate) {
  throw "Could not find Setup.exe artifact under $makeRoot"
}

Write-Host "[desktop:install-smoke] Using installer: $($setupCandidate.FullName)"

Start-Process -FilePath $setupCandidate.FullName -ArgumentList '/S' -Wait -NoNewWindow
Start-Sleep -Seconds 4

$installRoot = Join-Path $env:LOCALAPPDATA 'devsuite_desktop'
$updateExe = Join-Path $installRoot 'Update.exe'
$appCandidates = @()
if (Test-Path -Path $installRoot) {
  $appCandidates = Get-ChildItem -Path $installRoot -Recurse -Filter 'DevSuite.exe'
}

if (-not (Test-Path -Path $updateExe)) {
  throw "Installer did not create expected Update.exe at $updateExe"
}

if ($appCandidates.Count -lt 1) {
  throw "Installer did not produce DevSuite.exe under $installRoot"
}

Write-Host "[desktop:install-smoke] Install check passed. Found Update.exe and DevSuite.exe."

Start-Process -FilePath $updateExe -ArgumentList '--uninstall', '-s' -Wait -NoNewWindow
Start-Sleep -Seconds 4

$appCandidatesAfterUninstall = @()
if (Test-Path -Path $installRoot) {
  $appCandidatesAfterUninstall = Get-ChildItem -Path $installRoot -Recurse -Filter 'DevSuite.exe'
}

if ($appCandidatesAfterUninstall.Count -gt 0) {
  throw "Uninstall check failed: DevSuite.exe still present under $installRoot"
}

Write-Host '[desktop:install-smoke] Uninstall check passed.'
