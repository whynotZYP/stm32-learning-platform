$ErrorActionPreference = 'Continue'

$root = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$logDir = Join-Path $root 'work\release-logs'
$evidencePath = Join-Path $root 'work\release-evidence.json'
$hardwarePath = Join-Path $root 'outputs\stm32-hardware-evidence.json'
New-Item -ItemType Directory -Force -Path $logDir | Out-Null

function Find-HostCompiler {
  if ($env:HOST_CC) { return $env:HOST_CC }
  foreach ($name in @('clang', 'gcc', 'cc')) {
    $found = Get-Command $name -ErrorAction SilentlyContinue
    if ($found) { return $found.Source }
  }
  $bundled = Join-Path $root 'work\tools\tccbox\tccbox\tcc_dist\tcc.exe'
  if (Test-Path $bundled) { return $bundled }
  return $null
}

$hostCompiler = Find-HostCompiler
$steps = @(
  [pscustomobject]@{ Key = 'npm-ci'; File = 'npm.cmd'; Args = @('ci'); Env = @{} },
  [pscustomobject]@{ Key = 'validate-content'; File = 'npm.cmd'; Args = @('run', 'validate:content'); Env = @{} },
  [pscustomobject]@{ Key = 'unit-tests'; File = 'npm.cmd'; Args = @('test'); Env = @{ HOST_CC = $hostCompiler } },
  [pscustomobject]@{ Key = 'typecheck'; File = 'npm.cmd'; Args = @('run', 'typecheck'); Env = @{} },
  [pscustomobject]@{ Key = 'web-build'; File = 'npm.cmd'; Args = @('run', 'build'); Env = @{} },
  [pscustomobject]@{ Key = 'browser-e2e'; File = 'npm.cmd'; Args = @('run', 'test:e2e'); Env = @{} },
  [pscustomobject]@{ Key = 'device-e2e'; File = 'npm.cmd'; Args = @('run', 'test:e2e', '--', 'web/e2e/device-console.spec.ts'); Env = @{} },
  [pscustomobject]@{ Key = 'offline-e2e'; File = 'npm.cmd'; Args = @('run', 'test:e2e', '--', 'web/e2e/offline.spec.ts'); Env = @{ E2E_PREVIEW = '1' } },
  [pscustomobject]@{ Key = 'lesson-firmware'; File = 'npm.cmd'; Args = @('run', 'build:firmware'); Env = @{} },
  [pscustomobject]@{ Key = 'device-firmware'; File = 'npm.cmd'; Args = @('run', 'build:device-firmware'); Env = @{} },
  [pscustomobject]@{ Key = 'learner-docs'; File = 'npm.cmd'; Args = @('test', '--', '--run', 'scripts/content-validation/learner-docs.test.ts'); Env = @{} },
  [pscustomobject]@{ Key = 'git-diff-check'; File = 'git.exe'; Args = @('diff', '--check'); Env = @{} }
)

$commands = [ordered]@{}
$failed = $false
Push-Location $root
try {
  foreach ($step in $steps) {
    $startedAt = (Get-Date).ToUniversalTime().ToString('o')
    $logPath = Join-Path $logDir ($step.Key + '.log')
    $savedEnvironment = @{}
    foreach ($name in $step.Env.Keys) {
      $savedEnvironment[$name] = [Environment]::GetEnvironmentVariable($name, 'Process')
      [Environment]::SetEnvironmentVariable($name, $step.Env[$name], 'Process')
    }

    Write-Host "[release] $($step.Key)"
    & $step.File @($step.Args) 2>&1 | Tee-Object -FilePath $logPath
    $exitCode = $LASTEXITCODE
    if ($null -eq $exitCode) { $exitCode = 0 }

    foreach ($name in $step.Env.Keys) {
      [Environment]::SetEnvironmentVariable($name, $savedEnvironment[$name], 'Process')
    }
    $commands[$step.Key] = [ordered]@{
      command = (($step.File) + ' ' + ($step.Args -join ' ')).Trim()
      exitCode = $exitCode
      logPath = ('work/release-logs/' + $step.Key + '.log')
      startedAt = $startedAt
      finishedAt = (Get-Date).ToUniversalTime().ToString('o')
    }
    if ($exitCode -ne 0) { $failed = $true }
  }
} finally {
  Pop-Location
}

$previous = if (Test-Path $evidencePath) { Get-Content -Raw -Encoding UTF8 $evidencePath | ConvertFrom-Json } else { $null }
$document = [ordered]@{
  schemaVersion = 1
  commands = $commands
  deployment = if ($previous -and $previous.deployment) { $previous.deployment } else { [ordered]@{} }
}
if ($previous -and $previous.package) { $document.package = $previous.package }
$document | ConvertTo-Json -Depth 12 | Set-Content -Encoding UTF8 $evidencePath

Push-Location $root
try {
  & npm.cmd run audit -- --evidence $evidencePath --hardware $hardwarePath
  if ($LASTEXITCODE -ne 0) { $failed = $true }
} finally {
  Pop-Location
}

if ($failed) { exit 1 }
