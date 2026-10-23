param(
  [string]$Profile = "tenderteddy",
  [string]$Region = "eu-west-2",
  [string]$StackName = "tenderteddy-alpha",
  [string]$CloudFormationRoleArn = ""
)

$ErrorActionPreference = "Stop"
$repositoryRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
& (Join-Path $PSScriptRoot "prepare-deployment.ps1")

$identity = aws sts get-caller-identity --profile $Profile --region $Region --output json | ConvertFrom-Json
if ($LASTEXITCODE -ne 0 -or -not $identity.Account) { throw "AWS login is required for profile $Profile." }
if (-not $CloudFormationRoleArn) { $CloudFormationRoleArn = "arn:aws:iam::$($identity.Account):role/TenderTeddyCloudFormationExecutionRole" }

$artifactBucket = "tenderteddy-artifacts-$($identity.Account)-$Region"
$headErrorPreference = $ErrorActionPreference
$headExitCode = 1
try {
  $ErrorActionPreference = "SilentlyContinue"
  aws s3api head-bucket --bucket $artifactBucket --profile $Profile 2>$null
  $headExitCode = $LASTEXITCODE
} finally {
  $ErrorActionPreference = $headErrorPreference
}
if ($headExitCode -ne 0) {
  aws s3api create-bucket --bucket $artifactBucket --region $Region --create-bucket-configuration LocationConstraint=$Region --profile $Profile | Out-Null
  if ($LASTEXITCODE -ne 0) { throw "Could not create the deployment artifact bucket." }
}
aws s3api put-bucket-encryption --bucket $artifactBucket --server-side-encryption-configuration "Rules=[{ApplyServerSideEncryptionByDefault={SSEAlgorithm=AES256}}]" --profile $Profile | Out-Null
if ($LASTEXITCODE -ne 0) { throw "Could not enforce artifact-bucket encryption." }
aws s3api put-public-access-block --bucket $artifactBucket --public-access-block-configuration BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true --profile $Profile | Out-Null
if ($LASTEXITCODE -ne 0) { throw "Could not enforce the artifact-bucket public access block." }

$packagedTemplate = Join-Path $repositoryRoot "infra/packaged.yaml"
aws cloudformation package --template-file (Join-Path $repositoryRoot "infra/template.yaml") --s3-bucket $artifactBucket --output-template-file $packagedTemplate --profile $Profile --region $Region | Out-Null
if ($LASTEXITCODE -ne 0) { throw "CloudFormation packaging failed." }

aws cloudformation deploy --template-file $packagedTemplate --stack-name $StackName --capabilities CAPABILITY_IAM CAPABILITY_AUTO_EXPAND --role-arn $CloudFormationRoleArn --no-fail-on-empty-changeset --profile $Profile --region $Region
if ($LASTEXITCODE -ne 0) { throw "CloudFormation deployment failed." }

$appUrl = aws cloudformation describe-stacks --stack-name $StackName --profile $Profile --region $Region --query "Stacks[0].Outputs[?OutputKey=='AppUrl'].OutputValue | [0]" --output text
if ($LASTEXITCODE -ne 0 -or -not $appUrl) { throw "Could not read the hosted application URL." }
$fireTvUrl = "$($appUrl.TrimEnd('/'))/test-lab.html"
$androidRoot = Join-Path $repositoryRoot "android"
$previousJavaHome = $env:JAVA_HOME
$androidStudioJbr = "C:\Program Files\Android\Android Studio\jbr"
$gradleExitCode = 1
$androidLocationPushed = $false
try {
  if (Test-Path -LiteralPath (Join-Path $androidStudioJbr "bin/java.exe")) { $env:JAVA_HOME = $androidStudioJbr }
  Push-Location -LiteralPath $androidRoot
  $androidLocationPushed = $true
  & (Join-Path $androidRoot "gradlew.bat") "-PtenderTeddyServerUrl=$fireTvUrl" assembleDebug
  $gradleExitCode = $LASTEXITCODE
} finally {
  if ($androidLocationPushed) { Pop-Location }
  $env:JAVA_HOME = $previousJavaHome
}
if ($gradleExitCode -ne 0) { throw "Fire TV APK build failed." }
Copy-Item -LiteralPath (Join-Path $androidRoot "app/build/outputs/apk/debug/app-debug.apk") -Destination (Join-Path $repositoryRoot "public/downloads/TenderTeddy-firetv-debug.apk") -Force

# Publish the APK a second time after its default server URL is set to this stack.
& (Join-Path $PSScriptRoot "prepare-deployment.ps1")
aws cloudformation package --template-file (Join-Path $repositoryRoot "infra/template.yaml") --s3-bucket $artifactBucket --output-template-file $packagedTemplate --profile $Profile --region $Region | Out-Null
if ($LASTEXITCODE -ne 0) { throw "CloudFormation repackaging failed." }
aws cloudformation deploy --template-file $packagedTemplate --stack-name $StackName --capabilities CAPABILITY_IAM CAPABILITY_AUTO_EXPAND --role-arn $CloudFormationRoleArn --no-fail-on-empty-changeset --profile $Profile --region $Region
if ($LASTEXITCODE -ne 0) { throw "CloudFormation APK update failed." }

aws cloudformation describe-stacks --stack-name $StackName --profile $Profile --region $Region --query "Stacks[0].Outputs" --output table
