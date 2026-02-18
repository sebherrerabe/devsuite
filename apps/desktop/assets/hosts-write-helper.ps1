$ErrorActionPreference = 'Stop'

$helperDir = Join-Path $env:ProgramData 'DevSuite\hosts-helper'
$requestPath = Join-Path $helperDir 'request.json'
$resultPath = Join-Path $helperDir 'result.json'

if (-not (Test-Path -LiteralPath $requestPath)) {
  exit 2
}

$rawRequest = Get-Content -LiteralPath $requestPath -Raw
if ([string]::IsNullOrWhiteSpace($rawRequest)) {
  exit 3
}

$request = $rawRequest | ConvertFrom-Json
$requestId = [string]$request.requestId
$updatedAtMs = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()

$result = @{
  requestId = $requestId
  ok = $false
  updatedAtMs = $updatedAtMs
  error = 'Unknown helper error'
}

try {
  $hostsPath = [string]$request.hostsPath
  $encodedContents = [string]$request.encodedContents
  if ([string]::IsNullOrWhiteSpace($hostsPath)) {
    throw 'Missing hostsPath in helper request payload.'
  }
  if ([string]::IsNullOrWhiteSpace($encodedContents)) {
    throw 'Missing encodedContents in helper request payload.'
  }

  $decodedBytes = [Convert]::FromBase64String($encodedContents)
  [System.IO.File]::WriteAllBytes($hostsPath, $decodedBytes)

  $result.ok = $true
  $result.error = $null
} catch {
  $result.ok = $false
  $result.error = $_.Exception.Message
}

$result.updatedAtMs = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
$result | ConvertTo-Json -Compress | Set-Content -LiteralPath $resultPath -Encoding UTF8

if (-not $result.ok) {
  exit 1
}

exit 0
