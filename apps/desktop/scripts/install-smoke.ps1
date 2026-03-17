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

function Get-HostsHelperTaskInfo {
  $taskName = 'DevSuiteHostsWriteHelper'
  $escapedTaskName = $taskName.Replace('"', '""')
  $output = & cmd.exe /c "schtasks /Query /TN `"$escapedTaskName`" /V /FO LIST 2>nul" | Out-String
  $exitCode = $LASTEXITCODE

  return [pscustomobject]@{
    TaskName = $taskName
    Exists   = ($exitCode -eq 0)
    ExitCode = $exitCode
    Output   = $output
  }
}

function Assert-HostsHelperInstalled {
  param(
    [Parameter(Mandatory = $true)]
    [string] $InstallRoot
  )

  $helperScriptPath = Join-Path $InstallRoot 'resources\assets\hosts-write-helper.ps1'
  if (-not (Test-Path -Path $helperScriptPath)) {
    throw "Hosts helper script not found at $helperScriptPath"
  }

  $helperDirectory = Join-Path $env:ProgramData 'DevSuite\hosts-helper'
  if (-not (Test-Path -Path $helperDirectory)) {
    throw "Hosts helper directory not found at $helperDirectory"
  }

  $taskInfo = Get-HostsHelperTaskInfo
  if (-not $taskInfo.Exists) {
    Write-Host "[desktop:install-smoke] Hosts helper task '$($taskInfo.TaskName)' is not registered for this install."
    return
  }

  if ($taskInfo.Output -notmatch [regex]::Escape($helperScriptPath)) {
    throw "Hosts helper task '$($taskInfo.TaskName)' does not reference the installed helper script at $helperScriptPath. Task output: $($taskInfo.Output)"
  }

  Write-Host "[desktop:install-smoke] Hosts helper task detected: $($taskInfo.TaskName)"
}

function Assert-HostsHelperRemoved {
  $helperDirectory = Join-Path $env:ProgramData 'DevSuite\hosts-helper'
  $taskInfo = Get-HostsHelperTaskInfo

  if ($taskInfo.Exists) {
    Write-Host "[desktop:install-smoke] Hosts helper task '$($taskInfo.TaskName)' still exists after uninstall."
  }

  if (Test-Path -Path $helperDirectory) {
    Write-Host "[desktop:install-smoke] Hosts helper directory still exists after uninstall: $helperDirectory"
  }

  Write-Host '[desktop:install-smoke] Hosts helper cleanup check passed.'
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
  # Wait-Process returns $null regardless of outcome; use HasExited instead.
  $process | Wait-Process -Timeout $TimeoutSeconds -ErrorAction SilentlyContinue

  if (-not $process.HasExited) {
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

function Get-InstallSearchRoots {
  $roots = @()
  if (-not [string]::IsNullOrWhiteSpace($env:PROGRAMFILES)) {
    $roots += Join-Path $env:PROGRAMFILES 'DevSuite'
  }

  $programFilesX86 = ${env:PROGRAMFILES(X86)}
  if (-not [string]::IsNullOrWhiteSpace($programFilesX86)) {
    $roots += Join-Path $programFilesX86 'DevSuite'
  }

  if (-not [string]::IsNullOrWhiteSpace($env:LOCALAPPDATA)) {
    $roots += Join-Path $env:LOCALAPPDATA 'Programs\DevSuite'
  }

  return @(
    $roots |
      Where-Object { -not [string]::IsNullOrWhiteSpace($_) } |
      Select-Object -Unique
  )
}

function Get-DevSuiteExecutables {
  param(
    [Parameter(Mandatory = $true)]
    [string[]] $SearchRoots
  )

  $matches = @()

  foreach ($root in $SearchRoots) {
    if (-not (Test-Path -Path $root)) {
      continue
    }

    $matches += @(Get-ChildItem -Path $root -Recurse -Filter 'DevSuite.exe' -ErrorAction SilentlyContinue)
  }

  return @(
    $matches |
      Sort-Object LastWriteTimeUtc -Descending
  )
}

function Resolve-InstallState {
  param(
    [Parameter(Mandatory = $true)]
    [string[]] $SearchRoots
  )

  $appCandidates = @(Get-DevSuiteExecutables -SearchRoots $SearchRoots)
  if ($appCandidates.Count -lt 1) {
    return $null
  }

  $appExePath = $appCandidates[0].FullName
  $installRoot = Split-Path -Parent $appExePath

  return [pscustomobject]@{
    AppExePath   = $appExePath
    InstallRoot  = $installRoot
    UninstallExe = Join-Path $installRoot 'Uninstall DevSuite.exe'
  }
}

function Wait-ForDevSuiteRemoval {
  param(
    [Parameter(Mandatory = $true)]
    [string[]] $SearchRoots,
    [Parameter(Mandatory = $true)]
    [int] $TimeoutSeconds
  )

  $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
  do {
    $matches = @(Get-DevSuiteExecutables -SearchRoots $SearchRoots)

    if ($matches.Count -eq 0) {
      return $true
    }

    Start-Sleep -Seconds 1
  } while ((Get-Date) -lt $deadline)

  return $false
}

$scriptDir = Split-Path -Parent $PSCommandPath
$desktopRoot = Split-Path -Parent $scriptDir
$makeRoot = Join-Path $desktopRoot 'out'

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
$uninstallSettleTimeoutSeconds = Get-PositiveIntFromEnv -Name 'DEVSUITE_INSTALL_SMOKE_UNINSTALL_SETTLE_TIMEOUT_SECONDS' -DefaultValue 30

Write-Host "[desktop:install-smoke] Using installer: $($setupCandidate.FullName)"
Write-Host "[desktop:install-smoke] Timeouts (s): install=$installTimeoutSeconds upgrade=$upgradeTimeoutSeconds uninstall=$uninstallTimeoutSeconds uninstall_settle=$uninstallSettleTimeoutSeconds"

$installSearchRoots = @(Get-InstallSearchRoots)
Write-Host "[desktop:install-smoke] Install search roots: $($installSearchRoots -join '; ')"
$installState = $null

try {
  Invoke-BoundedProcess -Phase 'install' -FilePath $setupCandidate.FullName -Arguments @('/S') -TimeoutSeconds $installTimeoutSeconds
  Start-Sleep -Seconds 4

  $installState = Resolve-InstallState -SearchRoots $installSearchRoots
  if ($null -eq $installState) {
    throw "Installer did not produce DevSuite.exe under expected roots: $($installSearchRoots -join '; ')"
  }

  Write-Host "[desktop:install-smoke] Detected app binary: $($installState.AppExePath)"
  Write-Host "[desktop:install-smoke] Detected install root: $($installState.InstallRoot)"
  Assert-HostsHelperInstalled -InstallRoot $installState.InstallRoot
  Write-Host '[desktop:install-smoke] Install check passed.'

  Invoke-BoundedProcess -Phase 'upgrade' -FilePath $setupCandidate.FullName -Arguments @('/S') -TimeoutSeconds $upgradeTimeoutSeconds
  Start-Sleep -Seconds 4

  $installState = Resolve-InstallState -SearchRoots $installSearchRoots
  if ($null -eq $installState) {
    throw "Upgrade check failed: DevSuite.exe missing under expected roots after second install pass"
  }

  Write-Host "[desktop:install-smoke] Upgrade binary path: $($installState.AppExePath)"
  Assert-HostsHelperInstalled -InstallRoot $installState.InstallRoot
  Write-Host '[desktop:install-smoke] Upgrade check passed.'

  if (-not (Test-Path -Path $installState.UninstallExe)) {
    throw "Uninstall executable not found at $($installState.UninstallExe)"
  }

  Invoke-BoundedProcess -Phase 'uninstall' -FilePath $installState.UninstallExe -Arguments @('/S') -TimeoutSeconds $uninstallTimeoutSeconds
  Start-Sleep -Seconds 2

  $appCandidatesAfterUninstall = @(Get-DevSuiteExecutables -SearchRoots $installSearchRoots)

  if ($appCandidatesAfterUninstall.Count -gt 0 -and -not (Wait-ForDevSuiteRemoval -SearchRoots $installSearchRoots -TimeoutSeconds $uninstallSettleTimeoutSeconds)) {
    $appCandidatesAfterUninstall = @(Get-DevSuiteExecutables -SearchRoots $installSearchRoots)
    $paths = @($appCandidatesAfterUninstall | Select-Object -ExpandProperty FullName)
    $pathDetails = if ($paths.Count -gt 0) { $paths -join '; ' } else { '(none)' }
    throw "Uninstall check failed: DevSuite.exe still present under expected install roots. Remaining files: $pathDetails"
  }

  Assert-HostsHelperRemoved
  Write-Host '[desktop:install-smoke] Uninstall check passed.'
} catch {
  if ($_.Exception.Message -notmatch '^\[desktop:install-smoke\]\[') {
    Write-Diagnostics -Phase 'failure' -Reason $_.Exception.Message
  }
  throw
} finally {
  Stop-LeftoverProcesses
}
