$ErrorActionPreference = 'Stop'
$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$project = Join-Path $repoRoot 'firmware\device-test-v1'

Push-Location -LiteralPath $project
try {
  & cmake --preset Debug --fresh
  if ($LASTEXITCODE -ne 0) { throw "device firmware configure failed (cmake exit code $LASTEXITCODE)" }
  & cmake --build --preset Debug --parallel
  if ($LASTEXITCODE -ne 0) { throw "device firmware build failed (cmake exit code $LASTEXITCODE)" }
} finally {
  Pop-Location
}

$output = Join-Path $project 'build\Debug'
foreach ($extension in @('elf', 'hex', 'bin')) {
  $artifact = Join-Path $output "device-test-v1.$extension"
  if (-not (Test-Path -LiteralPath $artifact -PathType Leaf)) {
    throw "device firmware artifact missing: $artifact"
  }
}
Write-Output 'Device test firmware build passed: ELF, HEX, BIN.'
