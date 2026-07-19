$ErrorActionPreference = 'Stop'
$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$manifestPath = Join-Path $repoRoot 'firmware\projects.json'
$manifest = Get-Content -LiteralPath $manifestPath -Raw -Encoding UTF8 | ConvertFrom-Json

foreach ($project in $manifest.projects) {
  $source = Join-Path $repoRoot $project.path
  if (-not (Test-Path -LiteralPath $source -PathType Container)) {
    throw "project directory missing: $($project.id) ($source)"
  }
  Push-Location -LiteralPath $source
  try {
    & cmake --preset Debug --fresh
    $configureExitCode = $LASTEXITCODE
    if ($configureExitCode -ne 0) { throw "configure failed: $($project.id) (cmake exit code $configureExitCode)" }

    & cmake --build --preset Debug --parallel
    $buildExitCode = $LASTEXITCODE
    if ($buildExitCode -ne 0) { throw "build failed: $($project.id) (cmake exit code $buildExitCode)" }
  } finally {
    Pop-Location
  }
}

$successPrefix = -join @([char]0x56FA, [char]0x4EF6, [char]0x6784, [char]0x5EFA, [char]0x901A, [char]0x8FC7, [char]0xFF1A)
$projectUnit = -join @([char]0x4E2A, [char]0x5DE5, [char]0x7A0B, [char]0x3002)
Write-Output "$successPrefix$($manifest.projects.Count) $projectUnit"
