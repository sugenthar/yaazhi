# Yaazhi — யாழி

**Tamil programming language used to build games, servers, applications, and more**, with a native C11 compiler, C11 runtime, package manager, VS Code extension, and standard library.

```yaazhi
அச்சிடு("வணக்கம், யாழி!")
```

```sh
yaazhi --version        # Yaazhi 0.1.0
yaazhi run வணக்கம்.ழி   # compile + run
```

## Features

- Tamil syntax and identifiers, `.ழி` sources, indentation blocks
- Native toolchain: Lexer → Parser → AST → Semantic analysis → IR → NBC bytecode → C11 VM + GC
- Functions (defaults, recursion, lambdas), lists, dicts, classes, `முயற்சி/பிழை/இறுதியில்/எறி`
- Projects via `yaazhi.toml` + `yaazhi.lock`; `init / install / remove / update / list / search / pack / clean / doctor`
- Standard library (`கணிதம்`, `தரவு`, `கோப்பு`, `வலை`, `தரவுத்தளம்`, …)
- Native HTTP server/client, WebSocket, JSON, file I/O, SQLite
- VS Code extension (`yaazhi-language` 0.1.0): highlighting, IntelliSense, Run/Build/Check
- 2D game library `2பரிமாணவிளையாட்டு` v1.0.0 (terminal backend + native `y2d-1` backend)

## Installation

Linux x86_64 (verified release):

```sh
tar -xzf Download/yaazhi-0.1.0-linux-x86_64.tar.gz
./yaazhi-0.1.0-linux-x86_64/install.sh --prefix ~/.local
export PATH="$HOME/.local/bin:$PATH"
yaazhi --version
sha256sum -c Download/yaazhi-0.1.0-linux-x86_64.tar.gz.sha256
```

Windows: provisional (`Download/windows/install.ps1`, unverified) — Coming Soon.
macOS: Coming Soon. Full guide: `website/docs/installation.html`.

## Quick Start

```sh
yaazhi new வணக்கம் && cd வணக்கம்
yaazhi run
yaazhi check
yaazhi build
```

## Examples / Package Manager / VS Code / 2D Games

- Examples: `examples/` (01-basics → 16-real-world, plus 17-concurrency, 18-database) — see `website/examples.html`
- Packages: `yaazhi.toml` manifest, `YAAZHI_REGISTRY` (`http://`/`file://` work; `https://` explicitly unsupported) — see `website/docs/package-manager.html`
- VS Code: `code --install-extension vscode-extension/yaazhi-language-0.1.0.vsix` — see `website/vscode.html`
- 2D games: `external_library/2பரிமாணவிளையாட்டு` + `projects/2d_games` — see `website/docs/game.html`

## Documentation

Public site source: `website/` (static, GitHub Pages-ready, no build step).
Start at `website/index.html`, then `website/docs/`.

## Contributing / Security / Conduct / License

- `CONTRIBUTING.md` · `SECURITY.md` · `CODE_OF_CONDUCT.md` · `RELEASE_CHECKLIST.md`
- Source of truth for the implementation: <https://github.com/sugenthar/yaazhi-code>
- License: **MIT** — © 2026 Yaazhi (`LICENSE`)

## Status

Under active development. Current release **0.1.0**. Honest limits: inheritance (`சேர்தல்`), interfaces and enums are rejected by the compiler (Planned); HTTPS unsupported (HTTP only); Windows installer unverified.
