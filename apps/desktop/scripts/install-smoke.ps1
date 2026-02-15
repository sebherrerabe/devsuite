$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest
Remove-Item Env:ELECTRON_RUN_AS_NODE -ErrorAction SilentlyContinue

function Get-PositiveIntFromEnv {
  param(
    [Parameter(Mandatory = $true)]
    [string] $Name,
    [Parameter(Mandatory = $true)]
    [int] $DefaultValue
  )

  $raw = [Environment]::GetEnvironmentVariable($Name)
  if ([string]::IsNullOrWhiteSpace($raw)) {
    return $DefaultValue
  }

  $parsed = 0
  if (-not [int]::TryParse($raw, [ref] $parsed) -or $parsed -le 0) {
    throw "Invalid value for ${Name}: '$raw'. Expected a positive integer."
  }

  return $parsed
}

function Stop-LeftoverProcesses {
  $names = @('DevSuite', 'Update')
  foreach ($name in $names) {
    Get-Process -Name $name -ErrorAction SilentlyContinue |
      Stop-Process -Force -ErrorAction SilentlyContinue
  }
}

function Write-ProcessDiagnostics {
  param(
    [Parameter(Mandatory = $true)]
    [string] $Phase
  )

  Write-Host "[desktop:install-smoke][$Phase] Process snapshot (DevSuite/Update/Squirrel):"

  $processes = Get-CimInstance Win32_Process -ErrorAction SilentlyContinue |
    Where-Object {
      $_.Name -in @('DevSuite.exe', 'Update.exe') -or
      $_.Name -like '*Squirrel*' -or
      $_.Name -like '*Setup*.exe'
    } |
    Select-Object ProcessId, Name, ExecutablePath, CommandLine

  if ($null -eq $processes -or @($processes).Count -eq 0) {
    Write-Host '[desktop:install-smoke]   (no related processes found)'
    return
  }

  Write-Host ($processes | Format-Table -Wrap -AutoSize | Out-String)
}

function Write-SquirrelDiagnostics {
  param(
    [Parameter(Mandatory = $true)]
    [string] $Phase
  )

  $squirrelTemp = Join-Path $env:LOCALAPPDATA 'SquirrelTemp'
  Write-Host "[desktop:install-smoke][$Phase] Squirrel diagnostics path: $squirrelTemp"

  if (-not (Test-Path -Path $squirrelTemp)) {
    Write-Host '[desktop:install-smoke]   SquirrelTemp directory not found.'
    return
  }

  $logs = Get-ChildItem -Path $squirrelTemp -File -Filter '*.log' -ErrorAction SilentlyContinue |
    Sort-Object LastWriteTimeUtc -Descending |
    Where-Object {
      $_.Name -ieq 'Squirrel-Install.log' -or
      $_.Name -like '*devsuite*'
    } |
    Select-Object -First 3

  if ($null -eq $logs -or @($logs).Count -eq 0) {
    Write-Host '[desktop:install-smoke]   No *.log files found in SquirrelTemp.'
    return
  }

  foreach ($log in $logs) {
    Write-Host "[desktop:install-smoke]   Tail: $($log.FullName)"
    $tail = @(Get-Content -Path $log.FullName -Tail 200 -ErrorAction SilentlyContinue)
    $focusedTail = @(
      $tail |
        Where-Object {
          $_ -match 'devsuite_desktop|DevSuite|Squirrel Updater|error|warn|exception'
        }
    )
    $outputLines = if ($focusedTail.Count -gt 0) {
      $focusedTail
    } else {
      @($tail | Select-Object -Last 80)
    }
    foreach ($line in $outputLines) {
      Write-Host "    $line"
    }
  }
}

function Write-Diagnostics {
  param(
    [Parameter(Mandatory = $true)]
    [string] $Phase,
    [Parameter(Mandatory = $true)]
    [string] $Reason
  )

  Write-Host "[desktop:install-smoke][$Phase] Diagnostics reason: $Reason"
  Write-ProcessDiagnostics -Phase $Phase
  Write-SquirrelDiagnostics -Phase $Phase
}

function Invoke-BoundedProcess {
  param(
    [Parameter(Mandatory = $true)]
    [string] $Phase,
    [Parameter(Mandatory = $true)]
    [string] $FilePath,
    [Parameter(Mandatory = $true)]
    [string[]] $Arguments,
    [Parameter(Mandatory = $true)]
    [int] $TimeoutSeconds
  )

  Stop-LeftoverProcesses
  Write-Host "[desktop:install-smoke][$Phase] Launch: $FilePath $($Arguments -join ' ')"

  $process = Start-Process -FilePath $FilePath -ArgumentList $Arguments -PassThru -NoNewWindow
  $completed = $process | Wait-Process -Timeout $TimeoutSeconds -ErrorAction SilentlyContinue

  if ($null -eq $completed) {
    $message = "Timed out after $TimeoutSeconds seconds."
    Write-Diagnostics -Phase $Phase -Reason $message
    Stop-Process -Id $process.Id -Force -ErrorAction SilentlyContinue
    Stop-LeftoverProcesses
    throw "[desktop:install-smoke][$Phase] $message"
  }

  if ($process.ExitCode -ne 0) {
    $message = "Exited with code $($process.ExitCode)."
    Write-Diagnostics -Phase $Phase -Reason $message
    Stop-LeftoverProcesses
    throw "[desktop:install-smoke][$Phase] $message"
  }

  Stop-LeftoverProcesses
  Write-Host "[desktop:install-smoke][$Phase] Completed successfully."
}

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

$installTimeoutSeconds = Get-PositiveIntFromEnv -Name 'DEVSUITE_INSTALL_SMOKE_INSTALL_TIMEOUT_SECONDS' -DefaultValue 180
$upgradeTimeoutSeconds = Get-PositiveIntFromEnv -Name 'DEVSUITE_INSTALL_SMOKE_UPGRADE_TIMEOUT_SECONDS' -DefaultValue 180
$uninstallTimeoutSeconds = Get-PositiveIntFromEnv -Name 'DEVSUITE_INSTALL_SMOKE_UNINSTALL_TIMEOUT_SECONDS' -DefaultValue 180

Write-Host "[desktop:install-smoke] Using installer: $($setupCandidate.FullName)"
Write-Host "[desktop:install-smoke] Timeouts (s): install=$installTimeoutSeconds upgrade=$upgradeTimeoutSeconds uninstall=$uninstallTimeoutSeconds"

$installRoot = Join-Path $env:LOCALAPPDATA 'devsuite_desktop'
$updateExe = Join-Path $installRoot 'Update.exe'

try {
  Invoke-BoundedProcess -Phase 'install' -FilePath $setupCandidate.FullName -Arguments @('/S') -TimeoutSeconds $installTimeoutSeconds
  Start-Sleep -Seconds 4

  $appCandidates = @()
  if (Test-Path -Path $installRoot) {
    $appCandidates = @(Get-ChildItem -Path $installRoot -Recurse -Filter 'DevSuite.exe')
  }

  if (-not (Test-Path -Path $updateExe)) {
    throw "Installer did not create expected Update.exe at $updateExe"
  }

  if ($appCandidates.Count -lt 1) {
    throw "Installer did not produce DevSuite.exe under $installRoot"
  }

  Write-Host '[desktop:install-smoke] Install check passed. Found Update.exe and DevSuite.exe.'

  Invoke-BoundedProcess -Phase 'upgrade' -FilePath $setupCandidate.FullName -Arguments @('/S') -TimeoutSeconds $upgradeTimeoutSeconds
  Start-Sleep -Seconds 4

  $appCandidatesAfterUpgrade = @()
  if (Test-Path -Path $installRoot) {
    $appCandidatesAfterUpgrade = @(Get-ChildItem -Path $installRoot -Recurse -Filter 'DevSuite.exe')
  }

  if (-not (Test-Path -Path $updateExe)) {
    throw "Upgrade check failed: Update.exe missing at $updateExe after second install pass"
  }

  if ($appCandidatesAfterUpgrade.Count -lt 1) {
    throw "Upgrade check failed: DevSuite.exe missing under $installRoot after second install pass"
  }

  Write-Host '[desktop:install-smoke] Upgrade check passed.'

  Invoke-BoundedProcess -Phase 'uninstall' -FilePath $updateExe -Arguments @('--uninstall', '-s') -TimeoutSeconds $uninstallTimeoutSeconds
  Start-Sleep -Seconds 4

  $appCandidatesAfterUninstall = @()
  if (Test-Path -Path $installRoot) {
    $appCandidatesAfterUninstall = @(Get-ChildItem -Path $installRoot -Recurse -Filter 'DevSuite.exe')
  }

  if ($appCandidatesAfterUninstall.Count -gt 0) {
    throw "Uninstall check failed: DevSuite.exe still present under $installRoot"
  }

  Write-Host '[desktop:install-smoke] Uninstall check passed.'
} catch {
  if ($_.Exception.Message -notmatch '^\[desktop:install-smoke\]\[') {
    Write-Diagnostics -Phase 'failure' -Reason $_.Exception.Message
  }
  throw
} finally {
  Stop-LeftoverProcesses
}
