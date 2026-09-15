# Yaazhi installer (Windows, PowerShell 5.1+ / 7+).
#
#   install.ps1 [-Prefix "$env:LOCALAPPDATA\Yaazhi"] [-Uninstall] [-Verify]
#
# Copies this Windows distribution into a prefix and registers
# <prefix>\bin on the *user* PATH (no Administrator rights required).
# Afterwards open a NEW terminal:
#
#   where.exe yaazhi
#   yaazhi --version
#   yaazhi -c 'அச்சிடு($"வணக்கம், யாழி!")'
#
# Expected distribution layout next to this script (mirrors the Linux
# tarball, with .exe hosts):
#
#   bin\yaazhi.exe          native compiler CLI
#   bin\yaazhi-run.exe      NBC runtime host (used internally by `run`)
#   lib\yaazhi\library\     standard library (index.json + .ழி sources)
#   VERSION                 canonical version (single source of truth)
#   MANIFEST.txt            release manifest
#   LICENSE                 MIT license text
#   share\yaazhi\examples\  runnable examples
#
# Safety rules honored here: user-level changes only; PATH entries are
# compared exactly (never substring-matched) so nothing is duplicated
# and nothing unrelated is touched; uninstall removes only Yaazhi-owned
# files and only the Yaazhi PATH entry; user projects and the
# ~/.yaazhi package cache are never deleted. No Invoke-Expression, no
# shell-string construction from paths, no registry writes outside the
# current-user Environment key (via .NET, which handles spaces/Unicode).
#
# NOTE: this script is staged for Windows release but has not yet been
# executed on a Windows machine (see docs/DISTRIBUTION.md). Windows
# results must be reported as NOT RUN until a tested install exists.
param(
  [string]$Prefix = (Join-Path $env:LOCALAPPDATA "Yaazhi"),
  [switch]$Uninstall,
  [switch]$Verify
)

$ErrorActionPreference = "Stop"
$Src = Split-Path -Parent $MyInvocation.MyCommand.Path

function Split-PathEntries {
  param([string]$PathValue)
  if ([string]::IsNullOrEmpty($PathValue)) { return @() }
  return $PathValue.Split(';')
}

function Normalize-PathEntry {
  param([string]$Entry)
  if ($null -eq $Entry) { return "" }
  $t = $Entry.Trim()
  if ($t.Length -eq 0) { return "" }
  # Exact-entry comparison: trailing slashes/backslashes ignored, case
  # ignored (Windows filesystems), inner spaces/Unicode preserved.
  return $t.TrimEnd('\', '/')
}

function Test-PathEntryPresent {
  param([string]$PathValue, [string]$Dir)
  $want = (Normalize-PathEntry $Dir).ToLowerInvariant()
  foreach ($e in (Split-PathEntries $PathValue)) {
    if ((Normalize-PathEntry $e).ToLowerInvariant() -eq $want) { return $true }
  }
  return $false
}

function Add-PathEntry {
  param([string]$Dir)
  $current = [Environment]::GetEnvironmentVariable("Path", "User")
  if (Test-PathEntryPresent $current $Dir) {
    Write-Host "PATH already contains: $Dir"
    return $false
  }
  if ([string]::IsNullOrEmpty($current)) {
    $updated = $Dir
  } else {
    $updated = "$current;$Dir"
  }
  [Environment]::SetEnvironmentVariable("Path", $updated, "User")
  Write-Host "Added to user PATH: $Dir (open a NEW terminal)"
  return $true
}

function Remove-PathEntry {
  param([string]$Dir)
  $current = [Environment]::GetEnvironmentVariable("Path", "User")
  if ([string]::IsNullOrEmpty($current)) { return $false }
  $want = (Normalize-PathEntry $Dir).ToLowerInvariant()
  $kept = @()
  $removed = $false
  foreach ($e in (Split-PathEntries $current)) {
    if ((Normalize-PathEntry $e).ToLowerInvariant() -eq $want) {
      $removed = $true
    } else {
      $kept += $e
    }
  }
  if ($removed) {
    [Environment]::SetEnvironmentVariable("Path", ($kept -join ';'), "User")
  }
  return $removed
}

function Remove-IfEmpty {
  param([string]$Dir)
  if (Test-Path $Dir) {
    $items = Get-ChildItem $Dir -Force -ErrorAction SilentlyContinue
    if ($null -eq $items) { Remove-Item $Dir -Force -ErrorAction SilentlyContinue }
  }
}

if ([string]::IsNullOrWhiteSpace($Prefix)) {
  Write-Host "error: Prefix must not be empty." -ForegroundColor Red
  exit 2
}

$BinDir = Join-Path $Prefix "bin"

if ($Uninstall) {
  $removedSomething = $false
  foreach ($rel in @("bin", "lib\yaazhi", "share\yaazhi")) {
    $p = Join-Path $Prefix $rel
    if (Test-Path $p) {
      Remove-Item -Recurse -Force $p
      $removedSomething = $true
    }
  }
  foreach ($rel in @("VERSION", "MANIFEST.txt", "LICENSE")) {
    $p = Join-Path $Prefix $rel
    if (Test-Path $p) {
      Remove-Item -Force $p
      $removedSomething = $true
    }
  }
  if (Remove-PathEntry $BinDir) {
    Write-Host "Removed from user PATH: $BinDir"
    $removedSomething = $true
  }
  # Drop directories only when left empty (never touch user content).
  Remove-IfEmpty (Join-Path $Prefix "lib")
  Remove-IfEmpty (Join-Path $Prefix "share")
  Remove-IfEmpty $Prefix
  if ($removedSomething) {
    Write-Host "Yaazhi removed from $Prefix (user projects and ~/.yaazhi untouched)."
  } else {
    Write-Host "Yaazhi was not installed at $Prefix (nothing to remove)."
  }
  exit 0
}

if ($Verify) {
  $failures = 0
  $cmd = Get-Command yaazhi -ErrorAction SilentlyContinue
  if ($null -eq $cmd) {
    Write-Host "verify FAILED: 'yaazhi' not found on PATH (open a NEW terminal after install)." -ForegroundColor Red
    exit 1
  }
  Write-Host "verify: yaazhi resolves to $($cmd.Source)"
  $ver = (& yaazhi --version 2>&1)
  if ($LASTEXITCODE -ne 0 -or $ver -notlike "Yaazhi *") {
    Write-Host "verify FAILED: 'yaazhi --version' (rc=$LASTEXITCODE): $ver" -ForegroundColor Red
    $failures++
  } else {
    Write-Host "verify: $ver"
  }
  $out = (& yaazhi -c 'அச்சிடு($"வணக்கம், யாழி!")' 2>&1)
  if ($LASTEXITCODE -ne 0 -or "$out" -ne "வணக்கம், யாழி!") {
    Write-Host "verify FAILED: 'yaazhi -c' (rc=$LASTEXITCODE): $out" -ForegroundColor Red
    $failures++
  } else {
    Write-Host "verify: -c Tamil greeting OK"
  }
  if ($failures -gt 0) { exit 1 }
  Write-Host "Yaazhi verification passed."
  exit 0
}

# ---- install / upgrade / reinstall ------------------------------------
# Fail fast BEFORE touching anything: every required release file must
# be present beside this script (a partial copy is never installed).
$RequiredFiles = @(
  "bin\yaazhi.exe",
  "bin\yaazhi-run.exe",
  "VERSION",
  "MANIFEST.txt",
  "LICENSE"
)
$RequiredDirs = @(
  "lib\yaazhi\library",
  "share\yaazhi\examples"
)
$missing = @()
foreach ($rel in $RequiredFiles) {
  if (-not (Test-Path (Join-Path $Src $rel))) { $missing += $rel }
}
foreach ($rel in $RequiredDirs) {
  if (-not (Test-Path (Join-Path $Src $rel))) { $missing += $rel }
}
if ($missing.Count -gt 0) {
  Write-Host ("error: distribution incomplete beside install.ps1, missing: " + ($missing -join ", ")) -ForegroundColor Red
  exit 1
}

$wasInstalled = Test-Path (Join-Path $Prefix "bin\yaazhi.exe")

New-Item -ItemType Directory -Force -Path (Join-Path $Prefix "bin") | Out-Null
New-Item -ItemType Directory -Force -Path (Join-Path $Prefix "lib\yaazhi") | Out-Null
New-Item -ItemType Directory -Force -Path (Join-Path $Prefix "share\yaazhi") | Out-Null

Copy-Item (Join-Path $Src "bin\yaazhi.exe") (Join-Path $Prefix "bin\") -Force
Copy-Item (Join-Path $Src "bin\yaazhi-run.exe") (Join-Path $Prefix "bin\") -Force
Copy-Item (Join-Path $Src "VERSION") (Join-Path $Prefix "VERSION") -Force
Copy-Item (Join-Path $Src "MANIFEST.txt") (Join-Path $Prefix "MANIFEST.txt") -Force
Copy-Item (Join-Path $Src "LICENSE") (Join-Path $Prefix "LICENSE") -Force
Copy-Item -Recurse (Join-Path $Src "lib\yaazhi\library") (Join-Path $Prefix "lib\yaazhi\") -Force
Copy-Item -Recurse (Join-Path $Src "share\yaazhi\examples") (Join-Path $Prefix "share\yaazhi\") -Force

Add-PathEntry $BinDir | Out-Null

$installedVersion = (Get-Content (Join-Path $Prefix "VERSION") -TotalCount 1).Trim()
if ($wasInstalled) {
  Write-Host "Yaazhi upgraded/reinstalled at $Prefix (version $installedVersion)."
} else {
  Write-Host "Yaazhi installed to $Prefix (version $installedVersion)."
}
Write-Host "Open a NEW terminal, then try: yaazhi --version"
Write-Host "Verify any time with: install.ps1 -Verify"
