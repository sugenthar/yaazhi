#!/bin/bash
# 2பரிமாணவிளையாட்டு native backend — build script.
# Builds native/build/y2d_backend + mkassets from native/src using the
# vendored SDL3/SDL3_ttf headers+libs (native/vendor). Fails clearly when
# the toolchain, CMake, or vendor files are missing.
set -u
NATIVE_DIR="$(cd "$(dirname "$0")" && pwd)"

fail() { echo "BUILD FAIL: $1" >&2; exit 1; }

command -v cmake >/dev/null 2>&1 || fail "cmake not found"
command -v gcc >/dev/null 2>&1 || fail "gcc not found (C11 toolchain required)"
[ -f "$NATIVE_DIR/vendor/include/SDL3/SDL.h" ] || fail "vendor SDL3 headers missing (see native/vendor/PROVENANCE.md)"
[ -f "$NATIVE_DIR/vendor/include/SDL3_ttf/SDL_ttf.h" ] || fail "vendor SDL3_ttf headers missing"
[ -f "$NATIVE_DIR/vendor/lib/libSDL3.so" ] || fail "vendor SDL3 lib missing"

cmake -S "$NATIVE_DIR" -B "$NATIVE_DIR/build" || fail "cmake configure failed"
cmake --build "$NATIVE_DIR/build" || fail "cmake build failed"

[ -x "$NATIVE_DIR/build/y2d_backend" ] || fail "y2d_backend binary missing after build"
[ -x "$NATIVE_DIR/build/mkassets" ] || fail "mkassets binary missing after build"
"$NATIVE_DIR/build/mkassets" "$NATIVE_DIR/test-assets" || fail "test asset generation failed"
echo "BUILD OK: $NATIVE_DIR/build/y2d_backend"
