param(
  [string]$OutputDirectory = "infra/package"
)

$ErrorActionPreference = "Stop"
$repositoryRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$outputPath = [System.IO.Path]::GetFullPath((Join-Path $repositoryRoot $OutputDirectory))
$expectedParent = [System.IO.Path]::GetFullPath((Join-Path $repositoryRoot "infra"))

if (-not $outputPath.StartsWith($expectedParent, [System.StringComparison]::OrdinalIgnoreCase)) {
  throw "Deployment package must stay under the repository's infra directory."
}

if (Test-Path -LiteralPath $outputPath) {
  Remove-Item -LiteralPath $outputPath -Recurse -Force
}

New-Item -ItemType Directory -Path $outputPath | Out-Null
Copy-Item -LiteralPath (Join-Path $repositoryRoot "lambda.mjs") -Destination $outputPath
Copy-Item -LiteralPath (Join-Path $repositoryRoot "package.json") -Destination $outputPath
Copy-Item -LiteralPath (Join-Path $repositoryRoot "package-lock.json") -Destination $outputPath
Copy-Item -LiteralPath (Join-Path $repositoryRoot "src") -Destination $outputPath -Recurse
Copy-Item -LiteralPath (Join-Path $repositoryRoot "public") -Destination $outputPath -Recurse

& npm ci --omit=dev --prefix $outputPath
if ($LASTEXITCODE -ne 0) { throw "npm deployment install failed." }

Write-Host "Deployment package prepared at $outputPath"
