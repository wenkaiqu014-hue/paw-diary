param(
  [string]$BaseUrl = 'https://wenkaiqu014-hue.github.io/paw-diary/',
  [string]$OutFile = (Join-Path $PSScriptRoot 'public-report.json'),
  [string]$ExpectedVersion = '__PRODUCT_VERSION__'
)
$ErrorActionPreference = 'Stop'
$AllowedBase = 'https://wenkaiqu014-hue.github.io/paw-diary/'
if ($BaseUrl -cne $AllowedBase) { throw 'Only the fixed paw-diary public HTTPS address is allowed.' }
if ($ExpectedVersion -notmatch '^(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)$') { throw 'ExpectedVersion must be a stable numeric product version.' }
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
$Results = New-Object System.Collections.Generic.List[object]
function Add-Result([string]$Id,[string]$Status,[string]$Evidence,[string]$Reason) {
  $Value = [ordered]@{ id=$Id; status=$Status }
  if ($Evidence) { $Value.evidence=$Evidence }
  if ($Reason) { $Value.reason=$Reason }
  $Results.Add([pscustomobject]$Value)
}
function Get-Public([string]$Path) {
  if ($Path -notmatch '^(index\.html|manifest\.webmanifest|release\.json|asset-manifest\.json|assets/[A-Za-z0-9_./-]+)$' -or $Path.Contains('..')) { throw 'Unexpected public resource path.' }
  $Uri = [Uri]::new([Uri]$AllowedBase,$Path)
  if ($Uri.Scheme -ne 'https' -or $Uri.Host -ne 'wenkaiqu014-hue.github.io' -or -not $Uri.AbsolutePath.StartsWith('/paw-diary/')) { throw 'Unexpected public origin or subpath.' }
  # No credentials/session; no redirects to another origin; no private business calls.
  return Invoke-WebRequest -Uri $Uri.AbsoluteUri -UseBasicParsing -TimeoutSec 10 -MaximumRedirection 0 -Headers @{'Cache-Control'='no-cache'}
}
function Get-Sha256($Response) {
  $Sha = [Security.Cryptography.SHA256]::Create()
  try {
    if ($Response.RawContentStream) { $Bytes=$Response.RawContentStream.ToArray() }
    elseif ($Response.Content -is [byte[]]) { $Bytes=$Response.Content }
    else { $Bytes=[Text.Encoding]::UTF8.GetBytes([string]$Response.Content) }
    return ([BitConverter]::ToString($Sha.ComputeHash($Bytes))).Replace('-','').ToLowerInvariant()
  } finally { $Sha.Dispose() }
}
$Page = $null
try { $Page=Get-Public 'index.html'; Add-Result 'public-page' 'pass' 'Fixed HTTPS origin and /paw-diary/ index: HTTP 200' '' }
catch { Add-Result 'public-page' 'unverified' '' 'Public page unavailable or network/script blocked; retry manually.' }
$Release = $null
try {
  $Release=(Get-Public 'release.json').Content | ConvertFrom-Json
  if ($Release.version -notmatch '^(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)$' -or $Release.channel -ne 'stable' -or -not $Release.buildId) { Add-Result 'release-version' 'fail' '' 'Release metadata is not a valid stable product release.' }
  elseif ($Release.version -ne $ExpectedVersion) { Add-Result 'release-version' 'unverified' ("Observed " + $Release.version) ("Expected " + $ExpectedVersion + '; candidate may not be deployed yet. Recheck after deployment.') }
  else { Add-Result 'release-version' 'pass' ("Stable version " + $Release.version + '; build ' + $Release.buildId) '' }
} catch { Add-Result 'release-version' 'unverified' '' 'release.json unavailable; older public version may not ship release metadata yet.' }
try {
  $Manifest=(Get-Public 'manifest.webmanifest').Content | ConvertFrom-Json
  if ($Manifest.id -ne '/paw-diary/' -or $Manifest.start_url -ne './#home' -or $Manifest.scope -ne './' -or $Manifest.display -ne 'standalone' -or $Manifest.prefer_related_applications -ne $false) { Add-Result 'manifest' 'fail' '' 'Manifest fixed path or display values differ.' }
  else { Add-Result 'manifest' 'pass' 'Manifest preserves /paw-diary/ app identity, relative start_url/scope and standalone display.' '' }
} catch { Add-Result 'manifest' 'unverified' '' 'Manifest unavailable or invalid; candidate may not be deployed yet.' }
foreach ($Icon in @('icon-192.png','icon-512.png','icon-maskable-512.png','apple-touch-icon-180.png')) {
  try { $Response=Get-Public ('assets/app-icons/'+$Icon); Add-Result ('icon-'+$Icon.Replace('.png','')) 'pass' ('HTTP200; SHA256 '+(Get-Sha256 $Response)) '' }
  catch { Add-Result ('icon-'+$Icon.Replace('.png','')) 'unverified' '' 'Public icon unavailable; real OS icon/installation remains a manual check.' }
}
try {
  $Assets=(Get-Public 'asset-manifest.json').Content | ConvertFrom-Json
  if (-not $Assets.release -or -not $Assets.release.version -or -not $Assets.release.buildId -or -not $Assets.release.channel) {
    Add-Result 'asset-release' 'unverified' '' 'Asset release declaration is missing; older public versions do not declare this metadata.'
  } elseif (-not $Release) {
    Add-Result 'asset-release' 'unverified' '' 'release.json is unavailable; declared asset release identity cannot be compared.'
  } elseif ($Assets.release.version -cne $Release.version -or $Assets.release.buildId -cne $Release.buildId -or $Assets.release.channel -cne $Release.channel) {
    Add-Result 'asset-release' 'fail' '' 'Asset release version/buildId/channel differs from release.json. This is an integrity mismatch, not a candidate deployment warning.'
  } else {
    Add-Result 'asset-release' 'pass' ('Asset metadata agrees with release.json: '+$Release.version+'; build '+$Release.buildId) ''
  }
  foreach ($Kind in @('app','style')) {
    $Path=[string]$Assets.$Kind
    if ($Path -notmatch '^assets/(app-[A-Z0-9]+\.js|style-[A-Z0-9]+\.css)$') {
      Add-Result ('asset-'+$Kind) 'fail' '' 'Unexpected hashed public entry; request was refused by the fixed path guard.'
      continue
    }
    try {
      $Response=Get-Public $Path
      $ActualDigest=Get-Sha256 $Response
      $DeclaredDigest=[string]$Assets.sha256.$Kind
      if (-not $DeclaredDigest) {
        Add-Result ('asset-'+$Kind) 'unverified' ($Path+'; downloaded SHA256 '+$ActualDigest) 'Declared SHA256 is missing in this older public metadata; recording a hash is not a consistency verification.'
      } elseif ($DeclaredDigest -notmatch '^[a-fA-F0-9]{64}$') {
        Add-Result ('asset-'+$Kind) 'fail' '' 'Declared SHA256 is invalid. This is an integrity failure, not an unavailable candidate.'
      } else {
        $DeclaredDigest=$DeclaredDigest.ToLowerInvariant()
        if ($ActualDigest -cne $DeclaredDigest) {
          Add-Result ('asset-'+$Kind) 'fail' ('Expected '+$DeclaredDigest+'; received '+$ActualDigest) 'SHA256 mismatch: downloaded bytes differ from the public declaration. Recheck deployment integrity.'
        } elseif (-not $Page) {
          Add-Result ('asset-'+$Kind) 'unverified' ($Path+'; SHA256 matches declaration') 'Public index is unavailable, so its reference to this matched asset cannot be checked.'
        } elseif (-not ([string]$Page.Content).Contains($Path)) {
          Add-Result ('asset-'+$Kind) 'fail' ($Path+'; SHA256 matches declaration') 'Public index does not reference asset-manifest entry.'
        } else {
          Add-Result ('asset-'+$Kind) 'pass' ($Path+'; SHA256 '+$ActualDigest+' matches declaration; referenced by public index') ''
        }
      }
    } catch {
      Add-Result ('asset-'+$Kind) 'unverified' '' 'Public asset download or byte hashing was unavailable; no consistency pass was recorded.'
    }
  }
} catch { Add-Result 'public-assets' 'unverified' '' 'Public asset metadata discovery unavailable; no private API was called.' }
$Report = [ordered]@{
  schemaVersion=1; productVersion=$ExpectedVersion; checkedAt=[DateTimeOffset]::Now.ToString('o')
  environment=[ordered]@{os='Windows (verify actual version manually)';browser='PowerShell public HTTP check';browserVersion=$PSVersionTable.PSVersion.ToString();mode='browser'}
  autoChecks=@($Results.ToArray()); manualChecks=@(); notes='Automatic HTTP checks only. Candidate/public version mismatch is unverified; real OS checks remain not-run. Time is from this machine.'
}
$Json=$Report | ConvertTo-Json -Depth 8
$AbsoluteOutput=[IO.Path]::GetFullPath($OutFile)
[IO.File]::WriteAllText($AbsoluteOutput,$Json,(New-Object Text.UTF8Encoding($false)))
Write-Host ('Public-only report saved to '+$AbsoluteOutput)
