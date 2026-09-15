# Yaazhi Distribution

Current release: **0.1.0** (`VERSION` is the single source of truth).

## Artifacts

| Platform | Artifact | Status |
| -------- | -------- | ------ |
| Linux x86_64 | `Download/yaazhi-0.1.0-linux-x86_64.tar.gz` + `.sha256` | Available, SHA-256 `89266c1c…ad80` |
| Windows | — | Coming Soon (installer `Download/windows/install.ps1` unverified) |
| macOS | — | Coming Soon |

Large binaries ship via **GitHub Releases** (see `.github/workflows/release.yml`);
the Pages website links to them and is never used as a binary host.

## Tarball layout

`bin/yaazhi`, `bin/yaazhi-run`, `lib/yaazhi/library/`, `VERSION`,
`MANIFEST.txt`, `install.sh`, `share/yaazhi/examples/`, registry README.

## Install / verify / uninstall

```sh
tar -xzf yaazhi-0.1.0-linux-x86_64.tar.gz
./yaazhi-0.1.0-linux-x86_64/install.sh --prefix ~/.local
export PATH="$HOME/.local/bin:$PATH"
yaazhi --version && yaazhi doctor
sha256sum -c yaazhi-0.1.0-linux-x86_64.tar.gz.sha256
./install.sh --uninstall   # from the extracted tree
```

## Rebuild

`bash Download/build-dist.sh` — Release builds, smoke test (stdlib + pm),
forbidden-name audit, tarball + sha256. See `RELEASE_CHECKLIST.md`.
