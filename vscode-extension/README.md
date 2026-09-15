# Yaazhi Language

Yaazhi (யாழி) language support for Visual Studio Code — Tamil-first syntax
highlighting, IntelliSense, diagnostics, build, run, and check via the native
Yaazhi compiler. This extension is an integration layer; it uses the native
C11 Yaazhi compiler (`bin/yaazhi` in an installed distribution, or
`compiler/build/yaazhi` in a development checkout) and the shared C11 runtime.

## Features

- **Syntax highlighting** for Tamil-first Yaazhi source files (`.ழி`)
- **IntelliSense**: completions, hover docs, and symbol navigation
- **Diagnostics** from the real native compiler, shown in the Problems panel
- **Build & Run**: compile `.ழி` files and execute them with `yaazhi run`
- **Project support**: workspace manifests (`yazhi.toml` / `திட்டம்.json`)
  with auto-discovery
- **Terminal**: dedicated **Yaazhi** terminal with Unicode Tamil output

## Requirements

- Visual Studio Code 1.90+
- The native Yaazhi compiler executable (`yaazhi`) and the matching runtime
  host. Install the Yaazhi distribution (`bin/yaazhi` + `lib/yaazhi/library`)
  or use a development checkout (`compiler/build/yaazhi` + `library/`).

## Installation

This extension is available on the VS Code Marketplace. Search for **Yaazhi
Language** and install directly.

## Configuration

| Setting                 | Default | Meaning                                                        |
| ----------------------- | ------- | -------------------------------------------------------------- |
| `yaazhi.home`         | `""`    | Yaazhi home dir (contains `bin/yaazhi` or `compiler/build/yaazhi`). When empty, the extension discovers it from the installed distribution, the workspace layout, and the `YAAZHI_HOME` environment variable |
| `yaazhi.compiler`     | `""`    | Full path to the native `yaazhi` executable. Derived from `yaazhi.home` |
| `yaazhi.runtime`      | `""`    | Full path to `yaazhi_run`. When empty, `yaazhi run` resolves it internally |
| `yaazhi.compilerArgs` | `[]`    | Extra arguments appended to every compiler invocation             |

## Compiler discovery

1. `yaazhi.home` setting → native compiler beneath it (`bin/yaazhi` then
   `compiler/build/yaazhi`)
2. `YAAZHI_HOME` environment variable
3. Installed distribution (`yaazhi` on `PATH` at `<home>/bin/yaazhi`)
4. Workspace layout (a folder containing the native compiler, walking upward)

Failure shows: **"Yaazhi compiler was not found."**

## Running a file

1. Open a `.ழி` file. 2. Save it. 3. Run **Yaazhi: Run File**
   (`Ctrl+F5`) from the Command Palette or the editor title bar.
   `yaazhi run <file>` compiles the file and executes it on the native
   runtime host; output streams into the **Yaazhi** terminal, ending with
   `Process exited with code: N`.

## Building

**Yaazhi: Build** compiles the current file only
(`yaazhi build <file>.ழி -o <file>.ழி.nbc`) and populates the **Problems**
panel from real compiler errors.

## Checking

**Yaazhi: Check** validates the current file with `yaazhi check <file>`
(compile-only, nothing is executed, no artifacts are produced).

## Project support

**Yaazhi: Run Project** walks upward from the active file to find
`yazhi.toml` (or `திட்டம்.json`), reads its `entry` (falling back to
`முதன்மை.ழி` → `நிரல்.ழி` → `main.ழி`), compiles the whole project, and
runs it. Without a manifest it reports **"Could not find yazhi.toml."**

## Supported extension

`.ழி` only. Legacy `.அ` sources are rejected with a clear message.

## Troubleshooting

- **"Yaazhi compiler was not found."** — set `yaazhi.home` or `YAAZHI_HOME`.
- **"Please save the current .ழி file before running."** — save first
  (or let the extension auto-save the dirty editor).
- Diagnostics use the compiler's `(வரி N)` line info; columns are not
  invented. See the **Yaazhi** output channel for full logs.
- **Debugging is not available** in the native-only toolchain: the extension
  has no debug adapter. Use **Build** + **Run (File/Project)** instead.

## Terminal Font Recommendation

The Yaazhi extension generates correct Unicode Tamil output, but the VS Code
integrated terminal uses a font that must support Tamil shaping.

### Recommended terminal font family

Add this to your **workspace** `.vscode/settings.json`:

```json
{
  "terminal.integrated.fontFamily": "Nirmala UI, Noto Sans Tamil, Consolas"
}
```

### Why a font family list?

- `Nirmala UI` is a Windows font with reliable Tamil support.
- `Noto Sans Tamil` is a high-quality open-source Tamil font.
- `Consolas` is a monospace fallback for code.
- VS Code accepts a comma-separated font family list; it tries each in order.

### If Tamil glyphs still appear broken

1. Ensure the recommended fonts are installed on Windows.
2. Restart VS Code after installing a new font.
3. The extension cannot install or force fonts automatically.

### Verifying Tamil output

Run **Yaazhi: Diagnose Tamil Terminal** from the Command Palette.
The diagnostic shows the platform, shell, code page, and toolchain settings.
If the output program's Tamil text appears correctly in the terminal after
applying the font recommendation, the setup is working.

## Yaazhi syntax notes

- Comments start with `#`.
- Numbers and booleans use the `$` prefix: `$௧`, `$௨.௫`, `$மெய்`, `$பொய்`.
- Keywords are Tamil: `செயல் … கொடு`, `… என்றால்:`, `ஒவ்வொரு … இல் …:`.

## License

MIT — see [LICENSE](LICENSE).