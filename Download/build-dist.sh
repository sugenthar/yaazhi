#!/usr/bin/env bash
# Yaazhi native distribution builder (Linux).
#
# Reproducible release artifact from a clean checkout:
#   dist/build-dist.sh [--no-rebuild]
#
# Produces:
#   dist/yaazhi-<version>-linux-<arch>.tar.gz
#   dist/yaazhi-<version>-linux-<arch>.tar.gz.sha256
#
# Layout inside the tarball (<top>/):
#   bin/yaazhi            native compiler CLI (run/check/build/repl/-c/--code/...)
#   bin/yaazhi-run        NBC runtime host (used internally by `yaazhi run`)
#   lib/yaazhi/library/   standard library (.ழி sources + index.json)
#   VERSION               single source of truth for `yaazhi --version`
#   MANIFEST.txt          release manifest (version/os/arch/builds)
#   LICENSE             MIT license text
#   install.sh            installs to a prefix (default /usr/local)
#   share/yaazhi/examples/  curated runnable examples
#
# No Python, Git, CMake, or toolchain ships or is required at runtime.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
VERSION="$(tr -d ' \t\r\n' < "$ROOT/VERSION")"
ARCH="$(uname -m)"
OS="linux"
TOP="yaazhi-${VERSION}-${OS}-${ARCH}"
STAGE="$ROOT/dist/${TOP}"
TARBALL="$ROOT/dist/${TOP}.tar.gz"

REBUILD=1
if [ "${1:-}" = "--no-rebuild" ]; then
    REBUILD=0
fi

if [ "$REBUILD" = "1" ]; then
    echo "==> building native compiler (Release)"
    cmake -S "$ROOT/compiler" -B "$ROOT/compiler/build" -DCMAKE_BUILD_TYPE=Release
    cmake --build "$ROOT/compiler/build" --config Release
    echo "==> building runtime host (Release)"
    cmake -S "$ROOT/runtime" -B "$ROOT/runtime/build-dist" -DCMAKE_BUILD_TYPE=Release -DYAAZHI_WITH_TLS=ON -DYAAZHI_WITH_SQLITE=ON
    cmake --build "$ROOT/runtime/build-dist" --target yaazhi_run --config Release
fi

YAAZHI_BIN="$ROOT/compiler/build/yaazhi"
HOST_BIN="$ROOT/runtime/build-dist/yaazhi-run"
[ -x "$YAAZHI_BIN" ] || { echo "missing $YAAZHI_BIN" >&2; exit 1; }
[ -x "$HOST_BIN" ] || { echo "missing $HOST_BIN" >&2; exit 1; }

echo "==> staging to $STAGE"
rm -rf "$STAGE"
mkdir -p "$STAGE/bin" "$STAGE/lib/yaazhi" "$STAGE/share/yaazhi"
cp "$YAAZHI_BIN" "$STAGE/bin/yaazhi"
cp "$HOST_BIN" "$STAGE/bin/yaazhi-run"
# Minimal production stdlib set: .ழி sources + index (no dev placeholders).
mkdir -p "$STAGE/lib/yaazhi/library"
cp "$ROOT/library/index.json" "$STAGE/lib/yaazhi/library/"
for d in "$ROOT"/library/*/; do
    name="$(basename "$d")"
    mkdir -p "$STAGE/lib/yaazhi/library/$name"
    for f in "$d"*.ழி; do
        [ -f "$f" ] && cp "$f" "$STAGE/lib/yaazhi/library/$name/"
    done
done
cp "$ROOT/VERSION" "$STAGE/VERSION"
cp "$ROOT/LICENSE" "$STAGE/LICENSE"
# Curated runnable examples (deterministic, no servers/DB required to read).
mkdir -p "$STAGE/share/yaazhi/examples"
for ex in 01-basics 02-operators 03-control-flow 04-functions 05-collections \
          06-types 07-oop 08-errors 09-modules 10-standard-library 16-real-world \
          https_client; do
    [ -d "$ROOT/examples/$ex" ] && cp -r "$ROOT/examples/$ex" "$STAGE/share/yaazhi/examples/"
done
cp "$ROOT/dist/install.sh" "$STAGE/install.sh"
chmod +x "$STAGE/install.sh"
# Registry mirror layout note (the client is built in; mirrors are plain
# files — no server code ships with Yaazhi).
mkdir -p "$STAGE/share/yaazhi/registry"
cat > "$STAGE/share/yaazhi/registry/README.md" <<'EOF'
# Yaazhi package registry mirror layout

`YAAZHI_REGISTRY` points at a base URL (`http://...` or `file://...`)
serving this layout (see `docs/PACKAGES.md`):

```
api/v1/packages/<name>.json            latest metadata
api/v1/packages/<name>/<version>.json  pinned metadata
api/v1/packages/                       directory listing (file:// search)
packages/<name>-<version>.yzp          archives (SHA-256 verified)
```

Metadata JSON: `name`, `version`, `archive` (relative or absolute URL),
`sha256` (hex), `size` (bytes), `license`, `dependencies` (name->spec).
EOF

NBC_VER="1"
cat > "$STAGE/MANIFEST.txt" <<EOF
Yaazhi $VERSION
target OS: $OS
target architecture: $ARCH
compiler build: Release (native C11, $(gcc --version | head -1))
runtime build: Release (yaazhi-run host with TLS + SQLite)
stdlib version: $VERSION (library/index.json + .ழி sources)
NBC compatibility: NIRAL v$NBC_VER
requires: C runtime libraries of the target OS, OpenSSL (libssl/libcrypto) for HTTPS
not required: Python, Git, CMake, C toolchain, Yaazhi source repository
EOF

echo "==> smoke-testing staged tree (no source tree, no Python)"
SMOKE="$(mktemp -d)"
mkdir -p "$SMOKE/proj/src"
printf '["திட்டம்"]\n"பெயர்" = "புகை"\n"பதிப்பு" = "0.1.0"\n"நுழைவாயில்" = "src/main.ழி"\n' > "$SMOKE/proj/yaazhi.toml"
printf 'சேர் "உதவி.ழி"\nசேர் கணிதம்\nவகுப்பு பெட்டி:\n    எண் = $௦\n    செயல் உருவாக்கு(வ):\n        இது.எண் = வ\nபெ = பெட்டி(கணிதம்.அடுக்கு($௨, $௩))\nஅச்சிடு(உதவி.இரட்டி(பெ.எண்))\n' > "$SMOKE/proj/src/main.ழி"
printf 'செயல் இரட்டி(அ):\n    கொடு அ * $௨\n' > "$SMOKE/proj/src/உதவி.ழி"
(
    # Hide the repo and python: bare PATH with only the stage + coreutils.
    export PATH="$STAGE/bin:/usr/bin:/bin"
    unset YAAZHI_HOME YAZHI_HOME PYTHONPATH PYTHONHOME
    unset YAAZHI_VM YAZHI_VM
    export HOME="$SMOKE/home"
    mkdir -p "$HOME"
    cd "$SMOKE"
    yaazhi --version
    yaazhi doctor
    yaazhi check proj || exit 1
    yaazhi build proj || exit 1
    OUT="$(yaazhi run proj)" || exit 1
    [ "$OUT" = "16" ] || { echo "smoke output mismatch: $OUT" >&2; exit 1; }
    # Direct source execution (-c/--code): real native pipeline, no project,
    # no repository. Must work from this bare directory.
    OUTC="$(yaazhi -c 'அச்சிடு($"வணக்கம், யாழி!")')" || exit 1
    [ "$OUTC" = "வணக்கம், யாழி!" ] || { echo "smoke -c output mismatch: $OUTC" >&2; exit 1; }
    OUTC2="$(yaazhi --code 'அச்சிடு($"வணக்கம், யாழி!")')" || exit 1
    [ "$OUTC2" = "$OUTC" ] || { echo "smoke --code mismatch: $OUTC2" >&2; exit 1; }
    # Tamil numerals via -c must equal file-based run (parity, not glyphs).
    printf '%s' 'அச்சிடு($௨௦)' > num.ழி
    OUTF="$(yaazhi run num.ழி)" || exit 1
    OUTN="$(yaazhi -c 'அச்சிடு($௨௦)')" || exit 1
    [ "$OUTN" = "$OUTF" ] || { echo "smoke numeral mismatch: $OUTN vs $OUTF" >&2; exit 1; }
    rm -f num.ழி
    # -c failure modes: compiler error and missing argument, both non-zero.
    yaazhi -c 'அச்சிடு($' >/dev/null 2>&1 && { echo "smoke -c should fail on bad source" >&2; exit 1; }
    yaazhi -c >/dev/null 2>&1 && { echo "smoke -c should fail without code" >&2; exit 1; }
    # No temp/source droppings in the working directory.
    if ls ./*.ழி ./*.nbc ./yaazhi_run_* 2>/dev/null | grep -q .; then
        echo "smoke -c left files: $(ls ./*.ழி ./*.nbc ./yaazhi_run_* 2>/dev/null)" >&2; exit 1;
    fi
    # Package manager against a local file:// registry (no network, no git).
    yaazhi init smoke-pkg || exit 1
    mkdir -p libsrc/புகைநூல்/src
    printf '["திட்டம்"]\n"பெயர்" = "புகைநூல்"\n"பதிப்பு" = "1.0.0"\n"நுழைவாயில்" = "src/புகைநூல்.ழி"\n"உரிமம்" = "MIT"\n\n["தொகுதி"]\n"பெயர்" = "புகைநூல்"\n' > libsrc/புகைநூல்/yaazhi.toml
    printf 'செயல் மதிப்பு():\n    கொடு $௪௨\n' > libsrc/புகைநூல்/src/புகைநூல்.ழி
    ( cd libsrc/புகைநூல் && yaazhi pack . ) || exit 1
    mkdir -p reg/api/v1/packages/புகைநூல் reg/packages
    mv libsrc/புகைநூல்/புகைநூல்-1.0.0.yzp reg/packages/
    sha="$(sha256sum reg/packages/புகைநூல்-1.0.0.yzp | cut -d' ' -f1)"
    size="$(stat -c%s reg/packages/புகைநூல்-1.0.0.yzp)"
    meta="{\"name\":\"புகைநூல்\",\"version\":\"1.0.0\",\"archive\":\"packages/புகைநூல்-1.0.0.yzp\",\"sha256\":\"$sha\",\"size\":$size,\"license\":\"MIT\",\"dependencies\":{}}"
    printf '%s' "$meta" > reg/api/v1/packages/புகைநூல்.json
    printf '%s' "$meta" > reg/api/v1/packages/புகைநூல்/1.0.0.json
    export YAAZHI_REGISTRY="file://$SMOKE/reg"
    ( cd smoke-pkg && yaazhi install "புகைநூல்@1.0.0" ) || exit 1
    printf 'சேர் புகைநூல்\n\nஅச்சிடு(புகைநூல்.மதிப்பு())\n' > smoke-pkg/src/main.ழி
    OUT2="$(cd smoke-pkg && yaazhi run src/main.ழி)" || exit 1
    [ "$OUT2" = "42" ] || { echo "smoke pm output mismatch: $OUT2" >&2; exit 1; }
    ( cd smoke-pkg && yaazhi list && yaazhi remove புகைநூல் ) || exit 1
    [ ! -e smoke-pkg/external_librarys/புகைநூல் ] || { echo "smoke remove failed" >&2; exit 1; }
)
rm -rf "$SMOKE"
echo "==> smoke test passed (stdlib + module + class = 16; pm install/run/remove = 42)"

echo "==> auditing release contents"
fail_audit() { echo "RELEASE AUDIT FAILED: $1" >&2; exit 1; }
# Forbidden file names anywhere in the stage. (`yaazhi` itself is the
# product name and always present; the ban covers the legacy ASCII
# alias `yazhi*`, `*niral*` binaries, Python artifacts, VCS, tests,
# stray bytecode, and bundled consumer projects.)
if find "$STAGE" \( -name '*.py' -o -name '*.pyc' -o -name '__pycache__' \
     -o -iname '*niral*' -o -name 'yazhi*' -o -name '*.nbc' \
     -o -name '.git' -o -name 'project-game' -o -name 'tests' \) \
     -print -quit | grep -q .; then
  find "$STAGE" \( -name '*.py' -o -name '*.pyc' -o -name '__pycache__' \
     -o -iname '*niral*' -o -name 'yazhi*' -o -name '*.nbc' \
     -o -name '.git' -o -name 'project-game' -o -name 'tests' \) >&2
  fail_audit "forbidden file/dir name in release"
fi
# No external-library sources bundled (only stdlib .ழி under lib/ + curated examples).
if [ -d "$STAGE/external_librarys" ]; then
  fail_audit "external_librarys/ must not ship in the release"
fi
# No repository-relative paths baked into the binaries.
if grep -a -o '/home/[^ :"]*' "$STAGE/bin/yaazhi" | grep -v '^/home/$' | head -1 | grep -q .; then
  grep -a -o '/home/[^ :"]*' "$STAGE/bin/yaazhi" | head -3 >&2
  fail_audit "repository path baked into bin/yaazhi"
fi
if grep -a -o 'Project/yaazhi-code' "$STAGE/bin/yaazhi" "$STAGE/bin/yaazhi-run" | head -1 | grep -q .; then
  fail_audit "repository path baked into release binaries"
fi
echo "==> release audit passed"

echo "==> packing $TARBALL"
tar -czf "$TARBALL" -C "$ROOT/dist" "$TOP"
sha256sum "$TARBALL" | sed "s|$ROOT/dist/||" > "$TARBALL.sha256"
cat "$TARBALL.sha256"
echo "==> done: $TARBALL"
