# Run on Windows PowerShell 5.1; no HTTP calls, credentials, profile or business data.
$ErrorActionPreference = 'Stop'
$ProjectRoot=Split-Path -Parent $PSScriptRoot
$SourcePath=Join-Path $ProjectRoot 'tools/acceptance/windows/check-public.ps1'
$ParseTokens=$null
$ParseErrors=$null
$Ast=[System.Management.Automation.Language.Parser]::ParseFile($SourcePath,[ref]$ParseTokens,[ref]$ParseErrors)
if ($ParseErrors.Count -gt 0) { throw 'Production checker contains PowerShell parse errors.' }
# Load the actual production helpers, without evaluating its HTTP/report entrypoint.
foreach ($Name in @('Get-ResponseText','ConvertFrom-PublicJson','Get-Sha256')) {
  $Found=$Ast.FindAll({param($Node) $Node -is [System.Management.Automation.Language.FunctionDefinitionAst]},$true) | Where-Object { $_.Name -eq $Name }
  if (@($Found).Count -ne 1) { throw ('Missing unique production helper: '+$Name) }
  . ([ScriptBlock]::Create($Found.Extent.Text))
}
function Assert-Equal($Actual,$Expected,[string]$Message) {
  if ($Actual -cne $Expected) { throw $Message }
}
$Bytes=[IO.File]::ReadAllBytes((Join-Path $ProjectRoot 'manifest.webmanifest'))
$Text=[Text.Encoding]::UTF8.GetString($Bytes)
$WithBom=[byte[]](@(0xEF,0xBB,0xBF)+$Bytes)
$Cases=@(
  [pscustomobject]@{Content=$Bytes},
  [pscustomobject]@{Content=$Text},
  [pscustomobject]@{Content=$WithBom},
  [pscustomobject]@{Content=([string][char]0xFEFF+$Text)}
)
foreach ($Response in $Cases) {
  $Decoded=Get-ResponseText $Response
  Assert-Equal $Decoded $Text 'UTF8 byte[], string or BOM response decoded differently.'
  $Manifest=ConvertFrom-PublicJson $Response
  Assert-Equal $Manifest.id '/paw-diary/' 'Decoded manifest app identity was wrong.'
  Assert-Equal $Manifest.start_url './#home' 'Decoded manifest launch URL was wrong.'
  Assert-Equal $Manifest.scope './' 'Decoded manifest scope was wrong.'
  Assert-Equal $Manifest.display 'standalone' 'Decoded manifest display was wrong.'
  Assert-Equal $Manifest.prefer_related_applications $false 'Decoded manifest boolean was wrong.'
  Assert-Equal $Manifest.name ((-join @([char]0x722A,[char]0x722A,[char]0x65E5,[char]0x8BB0))) 'Chinese UTF8 content was corrupted.'
}
$Index='<script src="assets/app-TEST.js"></script>'
foreach ($Content in @($Index,[Text.Encoding]::UTF8.GetBytes($Index))) {
  if (-not (Get-ResponseText ([pscustomobject]@{Content=$Content})).Contains('assets/app-TEST.js')) { throw 'Index byte/string reference matching failed.' }
}
$InvalidRejected=$false
try { ConvertFrom-PublicJson ([pscustomobject]@{Content=[Text.Encoding]::UTF8.GetBytes('{invalid-json')}) | Out-Null }
catch { $InvalidRejected=$true }
if (-not $InvalidRejected) { throw 'Malformed JSON must remain rejected.' }
$UnsupportedRejected=$false
try { Get-ResponseText ([pscustomobject]@{Content=123}) | Out-Null }
catch { $UnsupportedRejected=$true }
if (-not $UnsupportedRejected) { throw 'Unsupported content types must not be cast into metadata.' }
$Hasher=[Security.Cryptography.SHA256]::Create()
try {
  $ExpectedHash=([BitConverter]::ToString($Hasher.ComputeHash($WithBom))).Replace('-','').ToLowerInvariant()
  $Stream=New-Object IO.MemoryStream(,$WithBom)
  try { Assert-Equal (Get-Sha256 ([pscustomobject]@{Content=$WithBom;RawContentStream=$Stream})) $ExpectedHash 'SHA256 must hash original bytes including BOM.' }
  finally { $Stream.Dispose() }
} finally { $Hasher.Dispose() }
Write-Host 'PASS actual production helpers: UTF8 byte[]/string/BOM JSON, Chinese text, index references, malformed rejection and original-byte SHA256.'
