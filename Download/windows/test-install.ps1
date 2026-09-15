# Yaazhi Windows install/CLI regression suite (native only, no Pester).
#
#   test-install.ps1 [-DistributionDir <dir>] [-TestRoot <dir>]
#
# Runs the full matrix against an ISOLATED prefix under $env:TEMP (never
# the real user install): fresh install, reinstall/upgrade, PATH
# exactness (no duplicates, preservation, spaces, Unicode), --version,
# --help, -c/--code, run/check/build, repl, Tamil source/filenames,
# Unicode paths, outside-directory execution, runtime discovery,
# uninstall (files + own PATH entry only; user projects preserved).
#
# The user PATH registry value is saved on entry and restored in
# `finally`, even on failure. Requires no Python/Node/Git/CMake.
# Exit 0 only when every check passes.
param(
  [string]$DistributionDir = (Split-Path -Parent $MyInvocation.MyCommand.Path),
  [string]$TestRoot = (Join-Path ([System.IO.Path]::GetTempPath()) "yaazhi-install-test")
)

$ErrorActionPreference = "Stop"

$script:pass = 0
$script:fail = 0
$script:fails = @()

function Ok { param([string]$Name) $script:pass++; Write-Host "ok: $Name" }
function Bad { param([string]$Name, [string]$Detail = "") $script:fail++; $script:fails += $Name; Write-Host "FAIL: $Name $Detail" }

function NormEntry {
  param([string]$Entry)
  if ($null -eq $Entry) { return "" }
  return $Entry.Trim().TrimEnd('\', '/').ToLowerInvariant()
}

function Count-PathOccurrences {
  param([string]$Dir)
  $want = NormEntry $Dir
  $n = 0
  $cur = [Environment]::GetEnvironmentVariable("Path", "User")
  if ([string]::IsNullOrEmpty($cur)) { return 0 }
  foreach ($e in $cur.Split(';')) {
    if ((NormEntry $e) -eq $want) { $n++ }
  }
  return $n
}

function Sync-ProcessPath {
  $env:Path = [Environment]::GetEnvironmentVariable("Path", "Machine") + ";" + [Environment]::GetEnvironmentVariable("Path", "User")
}

function Write-Utf8NoBom {
  param([string]$Path, [string]$Text)
  [System.IO.File]::WriteAllText($Path, $Text, [System.Text.UTF8Encoding]::new($false))
}

function Native-Out {
  # Runs a native command by argument array (no shell), returns
  # @{ Rc; Text } with combined stdout+stderr as one trimmed string.
  param([string]$Exe, [string[]]$Args)
  $raw = & $Exe @Args 2>&1
  $text = ($raw -join "`n").Trim()
  return @{ Rc = $LASTEXITCODE; Text = $text }
}

$origUserPath = [Environment]::GetEnvironmentVariable("Path", "User")
$origProcPath = $env:Path

try {
  # ---- fixtures -------------------------------------------------------
  if (Test-Path $TestRoot) { Remove-Item -Recurse -Force $TestRoot }
  New-Item -ItemType Directory -Force -Path $TestRoot | Out-Null
  # Prefix with spaces exercises space-safe PATH/file handling.
  $Prefix = Join-Path $TestRoot "Yaazhi Test"
  # Tamil prefix exercises Unicode installation paths.
  $UniPrefix = Join-Path $TestRoot "யாழி-சோதனை"
  $SeedA = Join-Path $TestRoot "seed-a"
  $SeedB = Join-Path $TestRoot "seed b"
  $Decoy = Join-Path $TestRoot "YaazhiOld\bin"
  $Project = Join-Path $TestRoot "myproject"
  New-Item -ItemType Directory -Force -Path $SeedA, $SeedB, $Decoy, $Project | Out-Null
  Set-Content (Join-Path $Project "keep.txt") "user data" -Encoding utf8
  # Seed PATH with entries that must survive install/uninstall untouched
  # ($Decoy resembles, but is not, the Yaazhi bin dir: exact matching
  # must neither merge with it nor delete it).
  [Environment]::SetEnvironmentVariable("Path", "$SeedA;$SeedB;$Decoy", "User")
  Sync-ProcessPath

  $Installer = Join-Path $DistributionDir "install.ps1"
  if (-not (Test-Path $Installer)) { Bad "installer present" $Installer; throw "missing installer" }
  Ok "installer present"

  # Static security self-check: no shell-eval of paths, no machine scope.
  $src = Get-Content $Installer -Raw
  if ($src -match "Invoke-Expression") { Bad "no Invoke-Expression"; } else { Ok "no Invoke-Expression" }
  if ($src -match '"Machine"') { Bad "user scope only"; } else { Ok "user scope only" }

  # ---- 1. fresh install ----------------------------------------------
  & $Installer -Prefix $Prefix
  if ($LASTEXITCODE -ne 0) { Bad "fresh install" "rc=$LASTEXITCODE"; throw "install failed" }
  $wantVersion = (Get-Content (Join-Path $DistributionDir "VERSION") -TotalCount 1).Trim()
  foreach ($rel in @("bin\yaazhi.exe", "bin\yaazhi-run.exe", "VERSION", "MANIFEST.txt", "LICENSE",
                     "lib\yaazhi\library\index.json", "share\yaazhi\examples")) {
    if (-not (Test-Path (Join-Path $Prefix $rel))) { Bad "fresh install files" "missing $rel" }
  }
  $gotVersion = (Get-Content (Join-Path $Prefix "VERSION") -TotalCount 1).Trim()
  if ($gotVersion -ceq $wantVersion) { Ok "fresh install (version $gotVersion)" } else { Bad "fresh install version" "$gotVersion vs $wantVersion" }
  Sync-ProcessPath

  # ---- PATH exactness --------------------------------------------------
  if ((Count-PathOccurrences (Join-Path $Prefix "bin")) -eq 1) { Ok "PATH added exactly once" } else { Bad "PATH added exactly once" }
  $cur = [Environment]::GetEnvironmentVariable("Path", "User")
  $okSeed = ($cur -like "*$SeedA*") -and ($cur -like "*$SeedB*") -and ($cur -like "*$Decoy*")
  if ($okSeed) { Ok "PATH preservation" } else { Bad "PATH preservation" $cur }

  # ---- 2. reinstall: idempotent, still exactly one entry ---------------
  & $Installer -Prefix $Prefix
  if ($LASTEXITCODE -ne 0) { Bad "reinstall" "rc=$LASTEXITCODE" }
  Sync-ProcessPath
  if ((Count-PathOccurrences (Join-Path $Prefix "bin")) -eq 1) { Ok "reinstall: no duplicate PATH" } else { Bad "reinstall: no duplicate PATH" }
  $h1 = (Get-FileHash (Join-Path $Prefix "bin\yaazhi.exe") -Algorithm SHA256).Hash
  $h2 = (Get-FileHash (Join-Path $DistributionDir "bin\yaazhi.exe") -Algorithm SHA256).Hash
  if ($h1 -ceq $h2) { Ok "reinstall: binaries consistent" } else { Bad "reinstall: binaries consistent" }

  # ---- CLI matrix (outside install dir, spaces in cwd) -----------------
  $WorkDir = Join-Path $TestRoot "work dir"
  New-Item -ItemType Directory -Force -Path $WorkDir | Out-Null
  Push-Location $WorkDir
  try {
    $r = Native-Out "yaazhi" @("--version")
    if ($r.Rc -eq 0 -and $r.Text -ceq "Yaazhi $wantVersion") { Ok "--version" } else { Bad "--version" "$($r.Rc): $($r.Text)" }
    $r = Native-Out "yaazhi" @("version")
    if ($r.Rc -eq 0 -and $r.Text -ceq "Yaazhi $wantVersion") { Ok "version" } else { Bad "version" "$($r.Rc): $($r.Text)" }
    $r = Native-Out "yaazhi" @("--help")
    if ($r.Rc -eq 0 -and $r.Text -like "*-c, --code*") { Ok "--help documents -c" } else { Bad "--help documents -c" }
    $r = Native-Out "yaazhi" @("-c", 'அச்சிடு($"வணக்கம், யாழி!")')
    if ($r.Rc -eq 0 -and $r.Text -ceq "வணக்கம், யாழி!") { Ok "-c Tamil greeting" } else { Bad "-c Tamil greeting" "$($r.Rc): $($r.Text)" }
    $r = Native-Out "yaazhi" @("--code", 'அச்சிடு($"வணக்கம், யாழி!")')
    if ($r.Rc -eq 0 -and $r.Text -ceq "வணக்கம், யாழி!") { Ok "--code Tamil greeting" } else { Bad "--code Tamil greeting" "$($r.Rc): $($r.Text)" }
    # Tamil numerals via -c must equal file-based run (parity).
    Write-Utf8NoBom (Join-Path $WorkDir "num.ழி") 'அச்சிடு($௨௦)'
    $f = Native-Out "yaazhi" @("run", (Join-Path $WorkDir "num.ழி"))
    $c = Native-Out "yaazhi" @("-c", 'அச்சிடு($௨௦)')
    if ($c.Rc -eq 0 -and $f.Rc -eq 0 -and $c.Text -ceq $f.Text) { Ok "Tamil numerals parity ($($c.Text))" } else { Bad "Tamil numerals parity" "file=$($f.Text) code=$($c.Text)" }
    # Tamil filename + Tamil source through run/check/build.
    $hello = Join-Path $WorkDir "வணக்கம்.ழி"
    Write-Utf8NoBom $hello 'அச்சிடு($"வணக்கம், யாழி!")'
    $r = Native-Out "yaazhi" @("run", $hello)
    if ($r.Rc -eq 0 -and $r.Text -ceq "வணக்கம், யாழி!") { Ok "run Tamil file" } else { Bad "run Tamil file" "$($r.Rc): $($r.Text)" }
    $r = Native-Out "yaazhi" @("check", $hello)
    if ($r.Rc -eq 0) { Ok "check Tamil file" } else { Bad "check Tamil file" "$($r.Rc): $($r.Text)" }
    $nbc = Join-Path $WorkDir "out.nbc"
    $r = Native-Out "yaazhi" @("build", $hello, "-o", $nbc)
    if ($r.Rc -eq 0 -and (Test-Path $nbc)) { Ok "build Tamil file" } else { Bad "build Tamil file" "$($r.Rc): $($r.Text)" }
    # Compiler error / runtime error / missing arg: non-zero, Tamil error.
    $r = Native-Out "yaazhi" @("-c", 'அச்சிடு($')
    if ($r.Rc -ne 0 -and $r.Text -like "*யாழி பிழை*") { Ok "-c compiler error" } else { Bad "-c compiler error" "$($r.Rc): $($r.Text)" }
    $r = Native-Out "yaazhi" @("-c", 'அச்சிடு(வரையறுக்கப்படாதது)')
    if ($r.Rc -ne 0) { Ok "-c runtime error rc" } else { Bad "-c runtime error rc" }
    $r = Native-Out "yaazhi" @("-c")
    if ($r.Rc -ne 0 -and $r.Text -like "*குறியீடு காணப்படவில்லை*") { Ok "-c missing arg" } else { Bad "-c missing arg" "$($r.Rc): $($r.Text)" }
    # repl stays functional.
    [Console]::InputEncoding = [System.Text.UTF8Encoding]::new($false)
    [Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false)
    $replIn = 'அச்சிடு($"repl-ok")' + "`n" + ".exit`n"
    $r = @{ Rc = 0; Text = "" }
    $raw = $replIn | & yaazhi repl 2>&1
    $r = @{ Rc = $LASTEXITCODE; Text = ($raw -join "`n").Trim() }
    if ($r.Text -like "*repl-ok*") { Ok "repl" } else { Bad "repl" $r.Text }
    # No droppings in the working directory.
    $stray = Get-ChildItem $WorkDir -Filter "*.nbc" | Where-Object { $_.Name -ne "out.nbc" }
    $stray += Get-ChildItem $WorkDir -Filter "yaazhi_run_*" -ErrorAction SilentlyContinue
    if ($null -eq $stray -or $stray.Count -eq 0) { Ok "no temp droppings" } else { Bad "no temp droppings" }
  } finally {
    Pop-Location
  }

  # ---- Unicode install prefix ------------------------------------------
  & $Installer -Prefix $UniPrefix
  if ($LASTEXITCODE -ne 0) { Bad "unicode prefix install" "rc=$LASTEXITCODE" }
  Sync-ProcessPath
  Push-Location $env:TEMP
  try {
    $r = Native-Out "yaazhi" @("--version")
    if ($r.Rc -eq 0) { Ok "unicode prefix --version" } else { Bad "unicode prefix --version" "$($r.Rc): $($r.Text)" }
  } finally {
    Pop-Location
  }
  & $Installer -Prefix $UniPrefix -Uninstall
  if ($LASTEXITCODE -ne 0) { Bad "unicode prefix uninstall" "rc=$LASTEXITCODE" } else { Ok "unicode prefix uninstall" }

  # ---- -Verify ----------------------------------------------------------
  & $Installer -Prefix $Prefix -Verify
  if ($LASTEXITCODE -eq 0) { Ok "-Verify" } else { Bad "-Verify" "rc=$LASTEXITCODE" }

  # ---- package manager present ------------------------------------------
  Push-Location $TestRoot
  try {
    $r = Native-Out "yaazhi" @("list")
    if ($r.Rc -eq 0) { Ok "pm list" } else { Bad "pm list" "$($r.Rc): $($r.Text)" }
  } finally {
    Pop-Location
  }

  # ---- uninstall: files + own PATH only ---------------------------------
  & $Installer -Prefix $Prefix -Uninstall
  if ($LASTEXITCODE -ne 0) { Bad "uninstall" "rc=$LASTEXITCODE" }
  Sync-ProcessPath
  $left = @( "bin\yaazhi.exe", "bin\yaazhi-run.exe", "VERSION", "MANIFEST.txt", "LICENSE" |
    Where-Object { Test-Path (Join-Path $Prefix $_) } )
  if ($left.Count -eq 0) { Ok "uninstall removes files" } else { Bad "uninstall removes files" ($left -join ",") }
  if ((Count-PathOccurrences (Join-Path $Prefix "bin")) -eq 0) { Ok "uninstall removes own PATH" } else { Bad "uninstall removes own PATH" }
  $cur = [Environment]::GetEnvironmentVariable("Path", "User")
  $okSeed = ($cur -like "*$SeedA*") -and ($cur -like "*$SeedB*") -and ($cur -like "*$Decoy*")
  if ($okSeed) { Ok "uninstall preserves other PATH" } else { Bad "uninstall preserves other PATH" $cur }
  if (Test-Path (Join-Path $Project "keep.txt")) { Ok "uninstall preserves user projects" } else { Bad "uninstall preserves user projects" }
  # Uninstall when absent: safe no-op.
  & $Installer -Prefix $Prefix -Uninstall
  if ($LASTEXITCODE -eq 0) { Ok "uninstall idempotent" } else { Bad "uninstall idempotent" "rc=$LASTEXITCODE" }
} finally {
  [Environment]::SetEnvironmentVariable("Path", $origUserPath, "User")
  $env:Path = $origProcPath
  Write-Host "user PATH restored"
}

Write-Host "Yaazhi Windows install regression: $($script:pass) passed, $($script:fail) failed"
if ($script:fail -gt 0) {
  Write-Host "FAILED:"
  foreach ($f in $script:fails) { Write-Host "  - $f" }
  exit 1
}
Write-Host "ALL Yaazhi WINDOWS INSTALL TESTS PASSED"
