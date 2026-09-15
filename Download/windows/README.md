# Yaazhi — Windows distribution

This directory stages the native Windows release of Yaazhi
(`install.ps1` + `test-install.ps1`). Both scripts are UTF-8 **with BOM**
so Windows PowerShell 5.1 and PowerShell 7 decode the Tamil literals
correctly; do not strip the BOM.

## Producing the Windows release folder

Build the two native binaries on Windows (MSYS2/MinGW-w64 or MSVC;
end users never need this), then assemble the folder this installer
expects:

```
Yaazhi-0.1.0-windows-x86_64\
    bin\yaazhi.exe          <- compiler build output (yaazhi.exe)
    bin\yaazhi-run.exe      <- runtime host build output
    lib\yaazhi\library\     <- copy of <repo>\library\ (index.json + .ழி)
    VERSION                 <- copy of <repo>\VERSION (single source of truth)
    MANIFEST.txt            <- version/OS/arch/build record (same shape as Linux)
    LICENSE                 <- copy of <repo>\LICENSE
    share\yaazhi\examples\  <- curated examples from <repo>\examples\
    install.ps1             <- this directory's installer
    test-install.ps1        <- this directory's test matrix (optional to ship)
```

Example (MinGW-w64, from a checkout):

```powershell
cmake -S compiler -B compiler/build-win -G "MinGW Makefiles" -DCMAKE_BUILD_TYPE=Release
cmake --build compiler/build-win --config Release
cmake -S runtime -B runtime/build-win -G "MinGW Makefiles" -DCMAKE_BUILD_TYPE=Release
cmake --build runtime/build-win --target yaazhi_run --config Release
```

then copy the outputs into the layout above. The CLI locates its host
(`bin\yaazhi-run.exe`), stdlib (`lib\yaazhi\library`), and version
(`VERSION`) relative to its own executable
(`GetModuleFileNameW` walk-up), so the folder is relocatable and works
from any current directory.

A Windows `.exe` pair has **not** been built or executed in this
repository yet (no Windows toolchain on the release machine); the
layout, installer, and tests below are staged for release and must be
reported as NOT RUN until a real Windows install is tested.

## Installing

```powershell
# If downloaded from the web, unblock first (Zone.Identifier):
Unblock-File .\install.ps1

powershell -ExecutionPolicy Bypass -File .\install.ps1
# or: install.ps1 -Prefix "D:\Yaazhi"
```

Default prefix: `%LOCALAPPDATA%\Yaazhi` (user-level, no Administrator
rights). The installer copies release files only, adds `<prefix>\bin`
to the **user** PATH with exact-entry comparison (no duplicates, other
entries untouched, spaces/Unicode safe), then prints the installed
version. Open a **new** terminal afterwards:

```powershell
where.exe yaazhi
yaazhi --version
yaazhi -c 'அச்சிடு($"வணக்கம், யாழி!")'
```

Re-running installs/upgrades in place (same command); user projects and
`~/.yaazhi` are never touched.

## Verify / uninstall

```powershell
install.ps1 -Verify        # PATH resolution + --version + Tamil -c smoke test
install.ps1 -Uninstall     # removes Yaazhi files + only the Yaazhi PATH entry
install.ps1 -Prefix "D:\Yaazhi" -Uninstall
```

Uninstall never deletes user projects, `~/.yaazhi`, or unrelated PATH
entries, and is a safe no-op when nothing is installed.

## Deliberately out of scope

* **No `.ழி` file association.** The project has no file-association
  design (no registry keys, no launcher verbs); inventing one would be a
  product feature, not installer work. Run `.ழி` files explicitly:
  `yaazhi run வணக்கம்.ழி`.
* **No Start Menu / Desktop shortcuts.** Same reason: no existing
  project philosophy supports them; the `bin\` PATH entry is the
  launcher.
* **No machine-wide install / admin elevation.** User-level install
  covers every CLI use; nothing in Yaazhi requires HKLM or
  `C:\Program Files` writes.

## Windows Unicode notes

* The CLI parses its command line as UTF-16 (`wmain`) and converts to
  UTF-8, and sets the console to code page 65001, so
  `yaazhi -c 'அச்சிடு($"...")'` receives intact Tamil (PowerShell passes
  Unicode arguments natively; `cmd.exe` users should `chcp 65001`).
* The runtime host sets the console to UTF-8 as well, so Tamil program
  output prints correctly.
* Known limitation (pre-existing, all commands): narrow-`fopen` file I/O
  goes through the ANSI code page, so `.ழி` *files* should live under
  ASCII-representable paths on Windows until wide-character file I/O
  lands. Tamil *source text* (via `-c`, REPL, or file contents) is
  unaffected. The bundled tests cover Tamil filenames/Unicode install
  prefixes so any regression fails loudly on a Windows run.
* Test fixtures are written UTF-8 **without BOM** (same bytes as every
  other Yaazhi fixture).
