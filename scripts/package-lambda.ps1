param(
  [string]$ArtifactName = 'wanderwrap-lambda.zip'
)

$ErrorActionPreference = 'Stop'
$wwRepositoryRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$wwDeployRoot = Join-Path $wwRepositoryRoot '.deploy'
$wwStamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$wwStage = Join-Path $wwDeployRoot "runtime-$wwStamp"
$wwArtifact = Join-Path $wwDeployRoot $ArtifactName

if (-not ([System.IO.Path]::GetFullPath($wwStage).StartsWith([System.IO.Path]::GetFullPath($wwDeployRoot)))) {
  throw 'Refusing to use a staging directory outside .deploy.'
}

Push-Location $wwRepositoryRoot
try {
  & npm run build:alexa
  if ($LASTEXITCODE -ne 0) { throw 'Alexa MCP App build failed.' }

  New-Item -ItemType Directory -Path $wwStage -Force | Out-Null
  Copy-Item -LiteralPath package.json -Destination $wwStage
  Copy-Item -LiteralPath package-lock.json -Destination $wwStage
  Copy-Item -LiteralPath src -Destination $wwStage -Recurse
  Copy-Item -LiteralPath public -Destination $wwStage -Recurse
  New-Item -ItemType Directory -Path (Join-Path $wwStage 'alexa') -Force | Out-Null
  Copy-Item -LiteralPath alexa\dist -Destination (Join-Path $wwStage 'alexa') -Recurse

  Push-Location $wwStage
  try {
    & npm ci --omit=dev --workspaces=false --cache (Join-Path $wwRepositoryRoot '.npm-cache')
    if ($LASTEXITCODE -ne 0) { throw 'Production dependency installation failed.' }
  } finally { Pop-Location }

  & tar.exe -a -c -f $wwArtifact -C $wwStage .
  if ($LASTEXITCODE -ne 0) { throw 'Lambda archive creation failed.' }
  $wwHash = (Get-FileHash -Algorithm SHA256 $wwArtifact).Hash
  [pscustomobject]@{ Artifact = $wwArtifact; Sha256 = $wwHash; Stage = $wwStage }
} finally { Pop-Location }
