#!/usr/bin/env bash
# Yaazhi installer — copies this distribution into a prefix.
#
#   ./install.sh [--prefix /usr/local] [--uninstall]
#
# Default prefix is /usr/local (may need root); user-local alternative:
#   ./install.sh --prefix ~/.local
# Afterwards ensure <prefix>/bin is on PATH.
set -euo pipefail

PREFIX="/usr/local"
UNINSTALL=0
while [ $# -gt 0 ]; do
    case "$1" in
        --prefix) PREFIX="${2:-}"; shift 2;;
        --prefix=*) PREFIX="${1#--prefix=}"; shift;;
        --uninstall) UNINSTALL=1; shift;;
        *) echo "usage: install.sh [--prefix DIR] [--uninstall]" >&2; exit 2;;
    esac
done

SRC="$(cd "$(dirname "$0")" && pwd)"
FILES="bin/yaazhi bin/yaazhi-run VERSION MANIFEST.txt LICENSE"
DIRS="lib/yaazhi share/yaazhi"

if [ "$UNINSTALL" = "1" ]; then
    for f in $FILES; do rm -f "$PREFIX/$f"; done
    rm -rf "$PREFIX/lib/yaazhi" "$PREFIX/share/yaazhi"
    # Drop directories only when left empty (never touch user content).
    rmdir "$PREFIX/bin" 2>/dev/null || true
    rmdir "$PREFIX/lib" 2>/dev/null || true
    rmdir "$PREFIX/share" 2>/dev/null || true
    echo "Yaazhi removed from $PREFIX (user projects untouched)."
    exit 0
fi

mkdir -p "$PREFIX/bin" "$PREFIX/lib/yaazhi" "$PREFIX/share/yaazhi"
for f in $FILES; do cp "$SRC/$f" "$PREFIX/$f"; done
cp -r "$SRC/lib/yaazhi/library" "$PREFIX/lib/yaazhi/"
cp -r "$SRC/share/yaazhi/examples" "$PREFIX/share/yaazhi/"
chmod +x "$PREFIX/bin/yaazhi" "$PREFIX/bin/yaazhi-run"
cp "$SRC/install.sh" "$PREFIX/lib/yaazhi/install.sh" 2>/dev/null || true

echo "Yaazhi installed to $PREFIX."
case ":$PATH:" in
    *":$PREFIX/bin:"*) ;;
    *) echo "Add to PATH: export PATH=\"$PREFIX/bin:\$PATH\"";;
esac
# Post-install sanity: the installed tree must answer on its own (any cwd,
# no repository, no YAAZHI_VM). Failure here is fatal: never leave a
# half-working installation behind silently.
if ! (cd /tmp && "$PREFIX/bin/yaazhi" --version >/dev/null 2>&1); then
    echo "யாழி பிழை: installed yaazhi failed to run (--version)" >&2
    exit 1
fi
echo "Try: yaazhi --version && yaazhi run $PREFIX/share/yaazhi/examples/09-modules/import-basic.ழி"
