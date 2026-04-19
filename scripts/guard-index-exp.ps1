param(
  [ValidateSet("backup", "verify", "all")]
  [string]$Action = "all",
  [string]$TargetPath = (Join-Path $PSScriptRoot "..\index.exp.html")
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Resolve-TargetPath {
  param([string]$PathValue)
  if (-not (Test-Path -LiteralPath $PathValue)) {
    throw "Target file not found: $PathValue"
  }
  return (Resolve-Path -LiteralPath $PathValue).Path
}

function New-BackupFile {
  param([string]$FilePath)
  $dir = Split-Path -Path $FilePath -Parent
  $name = [System.IO.Path]::GetFileNameWithoutExtension($FilePath)
  $ext = [System.IO.Path]::GetExtension($FilePath)
  $stamp = Get-Date -Format "yyyyMMdd-HHmmss"
  $backupPath = Join-Path $dir ("{0}.bak.{1}{2}" -f $name, $stamp, $ext)
  Copy-Item -LiteralPath $FilePath -Destination $backupPath -Force
  Write-Output ("[backup] {0}" -f $backupPath)
}

function Test-GuardRules {
  param([string]$FilePath)

  $raw = Get-Content -LiteralPath $FilePath -Raw -Encoding UTF8
  $bytes = [System.IO.File]::ReadAllBytes($FilePath)
  $errors = New-Object System.Collections.Generic.List[string]

  if ($bytes.Length -ge 3 -and $bytes[0] -eq 0xEF -and $bytes[1] -eq 0xBB -and $bytes[2] -eq 0xBF) {
    $errors.Add("UTF-8 BOM detected at file start")
  }

  # Build mojibake markers without embedding non-ASCII literals in this script.
  $mojibakeRegex = @(
    ([string]([char]0x7E5D)), # commonly appears as broken fragment
    ([string]([char]0x7E3A)),
    ([string]([char]0x8757)),
    ([string]([char]0x90A8) + [char]0xFF71),
    ([string]([char]0xFFFD)),
    '`r`n'
  )
  foreach ($pattern in $mojibakeRegex) {
    if ($raw -match $pattern) {
      $errors.Add("Mojibake marker detected: $pattern")
    }
  }

  # Guard critical Vue handlers and sections used by the main template.
  $requiredSnippets = @(
    "watch: {",
    "methods: {",
    "handleCombinationCellClick: function () {",
    "combinationDialog: function () {",
    "this.dispButtonName = value%2 === 0 ?"
  )
  foreach ($snippet in $requiredSnippets) {
    if (-not $raw.Contains($snippet)) {
      $errors.Add("Required snippet missing: $snippet")
    }
  }

  if ($errors.Count -gt 0) {
    Write-Error ("[verify] FAILED`n - " + ($errors -join "`n - "))
  } else {
    Write-Output "[verify] OK"
  }
}

$target = Resolve-TargetPath -PathValue $TargetPath

switch ($Action) {
  "backup" {
    New-BackupFile -FilePath $target | Out-Host
    break
  }
  "verify" {
    Test-GuardRules -FilePath $target
    break
  }
  "all" {
    New-BackupFile -FilePath $target | Out-Host
    Test-GuardRules -FilePath $target
    break
  }
}
