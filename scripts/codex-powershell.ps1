param(
  [Parameter(Mandatory = $true, Position = 0)]
  [ValidateSet(
    "backup-index-exp",
    "verify-index-exp",
    "all-index-exp",
    "screenshot",
    "dump-dom"
  )]
  [string]$Command,

  [Parameter(Position = 1, ValueFromRemainingArguments = $true)]
  [string[]]$Rest
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$scriptRoot = $PSScriptRoot
$remainingArgs = @($Rest)

function Resolve-GuardTargetPath {
  param([string]$PathValue)
  $candidate = if ($PathValue) {
    $PathValue
  } else {
    Join-Path $scriptRoot "..\index.exp.html"
  }
  if (-not (Test-Path -LiteralPath $candidate)) {
    throw "Target file not found: $candidate"
  }
  return (Resolve-Path -LiteralPath $candidate).Path
}

function New-GuardBackupFile {
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

  $mojibakeRegex = @(
    ([string]([char]0x7E5D)),
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
    throw ("[verify] FAILED`n - " + ($errors -join "`n - "))
  }

  Write-Output "[verify] OK"
}

switch ($Command) {
  "backup-index-exp" {
    $rawTargetPath = if ($remainingArgs.Count -ge 1) { $remainingArgs[0] } else { "" }
    $targetPath = Resolve-GuardTargetPath -PathValue $rawTargetPath
    New-GuardBackupFile -FilePath $targetPath
    break
  }
  "verify-index-exp" {
    $rawTargetPath = if ($remainingArgs.Count -ge 1) { $remainingArgs[0] } else { "" }
    $targetPath = Resolve-GuardTargetPath -PathValue $rawTargetPath
    Test-GuardRules -FilePath $targetPath
    break
  }
  "all-index-exp" {
    $rawTargetPath = if ($remainingArgs.Count -ge 1) { $remainingArgs[0] } else { "" }
    $targetPath = Resolve-GuardTargetPath -PathValue $rawTargetPath
    New-GuardBackupFile -FilePath $targetPath
    Test-GuardRules -FilePath $targetPath
    break
  }
  "screenshot" {
    if ($remainingArgs.Count -lt 2) {
      throw "Usage: codex-powershell.ps1 screenshot <Url> <OutputPath> [Width] [Height] [VirtualTimeBudget]"
    }
    $url = $remainingArgs[0]
    $outputPath = $remainingArgs[1]
    $width = if ($remainingArgs.Count -ge 3) { [int]$remainingArgs[2] } else { 390 }
    $height = if ($remainingArgs.Count -ge 4) { [int]$remainingArgs[3] } else { 844 }
    $virtualTimeBudget = if ($remainingArgs.Count -ge 5) { [int]$remainingArgs[4] } else { 12000 }
    & (Join-Path $scriptRoot "run-headless-chrome.ps1") `
      -Url $url `
      -OutputPath $outputPath `
      -Width $width `
      -Height $height `
      -VirtualTimeBudget $virtualTimeBudget
    break
  }
  "dump-dom" {
    if ($remainingArgs.Count -lt 1) {
      throw "Usage: codex-powershell.ps1 dump-dom <Url> [Width] [Height] [VirtualTimeBudget]"
    }
    $url = $remainingArgs[0]
    $width = if ($remainingArgs.Count -ge 2) { [int]$remainingArgs[1] } else { 390 }
    $height = if ($remainingArgs.Count -ge 3) { [int]$remainingArgs[2] } else { 844 }
    $virtualTimeBudget = if ($remainingArgs.Count -ge 4) { [int]$remainingArgs[3] } else { 12000 }
    & (Join-Path $scriptRoot "run-headless-chrome.ps1") `
      -Url $url `
      -Width $width `
      -Height $height `
      -VirtualTimeBudget $virtualTimeBudget `
      -DumpDom
    break
  }
}
