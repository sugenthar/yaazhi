#!/bin/bash
# 2பரிமாணவிளையாட்டு — test runner.
# Runs every library test, the examples, and the project-game scenarios.
# Usage: ./tests/run_tests.sh   (from anywhere)
# Env overrides: YAAZHI (compiler path), YAAZHI_VM (runtime host),
#                YAAZHI_HOME (install root; auto-shadowed for dev checkouts).

LIB_DIR="$(cd "$(dirname "$0")/.." && pwd)"
REPO_DIR="$(cd "$LIB_DIR/../.." && pwd)"
YAAZHI="${YAAZHI:-$REPO_DIR/compiler/build/yaazhi}"
export YAAZHI_VM="${YAAZHI_VM:-$REPO_DIR/runtime/build/yaazhi_run.lnx}"

# In a dev checkout the repo root itself is the install root (it holds
# library/), so dependencies under external_librarys/ are rejected by the
# install-boundary check. Shadow the install root in a temp dir (symlinked
# stdlib) unless the caller already provided one (real installs need this).
if [ -z "${YAAZHI_HOME:-}" ] && [ -d "$REPO_DIR/library" ]; then
    SHADOW="$(mktemp -d)"
    ln -s "$REPO_DIR/library" "$SHADOW/library"
    cp "$REPO_DIR/VERSION" "$SHADOW/VERSION"
    export YAAZHI_HOME="$SHADOW"
    trap 'rm -rf "$SHADOW"' EXIT
fi

PASS=0
FAIL=0

ok()   { PASS=$((PASS+1)); echo "PASS: $1"; }
bad()  { FAIL=$((FAIL+1)); echo "FAIL: $1"; }

# run_test <name> <file> [stdin-file]
run_test() {
    local name="$1" file="$2" input="${3:-/dev/null}"
    local out rc okc
    out="$("$YAAZHI" run "$file" < "$input" 2>&1)"
    rc=$?
    if [ $rc -ne 0 ]; then bad "$name (exit $rc) :: $(echo "$out" | tail -1)"; return; fi
    if echo "$out" | grep -q "தோல்வி"; then bad "$name (தோல்வி in output)"; return; fi
    okc=$(echo "$out" | grep -c "சரி:")
    if [ "$okc" -lt 1 ]; then bad "$name (no சரி lines)"; return; fi
    ok "$name ($okc சரி)"
}

# run_fail_test <name> <file>  — must exit non-zero
run_fail_test() {
    local name="$1" file="$2"
    if "$YAAZHI" run "$file" >/dev/null 2>&1; then bad "$name (expected failure, got success)"; else ok "$name (fails as expected)"; fi
}

cd "$LIB_DIR" || exit 1

run_test "மோதல்"      tests/சோதனை_மோதல்.ழி
run_test "அடிப்படை"    tests/சோதனை_அடிப்படை.ழி
run_test "நேரம்"       tests/சோதனை_நேரம்.ழி
run_test "சாளரம்"      tests/சோதனை_சாளரம்.ழி
run_test "படம்"        tests/சோதனை_படம்.ழி
run_test "சொத்து"       tests/சோதனை_சொத்து.ழி
run_test "உருப்படி"     tests/சோதனை_உருப்படி.ழி
run_test "பொருள்"       tests/சோதனை_பொருள்.ழி
run_test "பார்வை"       tests/சோதனை_பார்வை.ழி
run_test "அசைவு"        tests/சோதனை_அசைவு.ழி
run_test "நிறம்"         tests/சோதனை_நிறம்.ழி
run_test "அடுக்கு"       tests/சோதனை_அடுக்கு.ழி
run_test "காட்சி"        tests/சோதனை_காட்சி.ழி
run_test "கட்டம்"        tests/சோதனை_கட்டம்.ழி
run_test "துகள்"         tests/சோதனை_துகள்.ழி
run_test "இயற்பியல்"     tests/சோதனை_இயற்பியல்.ழி
run_test "இடைமாற்று"     tests/சோதனை_இடைமாற்று.ழி
run_test "எழுத்து"       tests/சோதனை_எழுத்து.ழி
printf 'ஆ\nமேல்\n' > /tmp/vilai_ctrl.txt
run_test "கட்டுப்பாடு"   tests/சோதனை_கட்டுப்பாடு.ழி /tmp/vilai_ctrl.txt
rm -f /tmp/vilai_save_test.txt /tmp/vilai_save_dict.txt
run_test "சேமிப்பு"      tests/சோதனை_சேமிப்பு.ழி
run_test "செயல்திறன்"    tests/சோதனை_செயல்திறன்.ழி
run_test "அமைப்பு"       tests/சோதனை_அமைப்பு.ழி
run_test "பிழைத்திருத்தம்" tests/சோதனை_பிழைத்திருத்தம்.ழி
run_test "தொகுப்பு"      tests/சோதனை_தொகுப்பு.ழி
run_test "ஒலி-அமைப்பு"   tests/சோதனை_ஒலி_அமைப்பு.ழி
printf 'அ\nஅ\nஆ\nவெளி\n' > /tmp/vilai_keys.txt
run_test "உள்ளீடு"     tests/சோதனை_உள்ளீடு.ழி /tmp/vilai_keys.txt
run_test "சுழற்சி"      tests/சோதனை_சுழற்சி.ழி
run_fail_test "படம்-தவறு" tests/சோதனை_படம்_தவறு.ழி
run_fail_test "நிறம்-தவறு" tests/சோதனை_தவறு_நிறம்.ழி
run_fail_test "அசைவு-தவறு" tests/சோதனை_தவறு_அசைவு.ழி
run_fail_test "தொகுப்பு-தவறு" tests/சோதனை_தவறு_தொகுப்பு.ழி
run_fail_test "தொகுப்பு-சீரற்ற-தவறு" tests/சோதனை_தவறு_தொகுப்பு_சீரற்ற.ழி
run_fail_test "அமைப்பு-தவறு" tests/சோதனை_தவறு_அமைப்பு.ழி
run_fail_test "இடைமாற்று-தவறு" tests/சோதனை_தவறு_இடைமாற்று.ழி
run_fail_test "இடைமாற்று-வகை-தவறு" tests/சோதனை_தவறு_இடைமாற்று_வகை.ழி
run_fail_test "பலகோணம்-தவறு" tests/சோதனை_தவறு_பலகோணம்.ழி
run_fail_test "சேமிப்பு-தவறு" tests/சோதனை_தவறு_சேமிப்பு.ழி
run_fail_test "ஒலி-தவறு" tests/சோதனை_தவறு_ஒலி.ழி

# Mute behavior: muted play emits no BEL, unmuted play emits exactly one.
belc="$("$YAAZHI" run tests/சோதனை_ஒலி_அமைப்பு.ழி 2>/dev/null | grep -a -o $'\a' | wc -l)"
if [ "$belc" -eq 1 ]; then ok "ஒலி-முடக்கம் ($belc BEL)"; else bad "ஒலி-முடக்கம் ($belc BEL)"; fi

# Byte-level checks: ANSI ESC in rendered frame, BEL in sound test.
if "$YAAZHI" run tests/சோதனை_சாளரம்.ழி 2>/dev/null | grep -aq $'\033'; then ok "சாளரம்-ESC"; else bad "சாளரம்-ESC"; fi
if "$YAAZHI" run tests/சோதனை_சுழற்சி.ழி 2>/dev/null | grep -aq $'\a'; then ok "ஒலி-BEL"; else bad "ஒலி-BEL"; fi

# ---- native backend (needs built binary + display; else honest SKIP) ----
NATIVE_DIR="$LIB_DIR/native"
NATIVE_SKIP=0
if [ ! -x "$NATIVE_DIR/build/y2d_backend" ]; then
    if ! "$NATIVE_DIR/build.sh" >/dev/null 2>&1; then NATIVE_SKIP=1; fi
fi
if [ "$NATIVE_SKIP" -eq 0 ] && [ -x "$NATIVE_DIR/build/y2d_backend" ]; then
    if ! DISPLAY="${DISPLAY:-:0}" "$NATIVE_DIR/build/y2d_backend" --probe 2>/dev/null | grep -q "VIDEO_OK=1"; then
        NATIVE_SKIP=1
    fi
fi
if [ "$NATIVE_SKIP" -eq 1 ]; then
    echo "SKIP: native backend tests (NATIVE_ENVIRONMENT_REQUIRED)"
else
    cd "$LIB_DIR/tests" || exit 1
    pkill -f "y2d_backend --serve 47832" 2>/dev/null
    sleep 0.5
    DISPLAY="${DISPLAY:-:0}" "$NATIVE_DIR/build/y2d_backend" --serve 47832 2>/dev/null &
    Y2D_SRV=$!
    trap 'kill -9 $Y2D_SRV 2>/dev/null; rm -rf "$SHADOW" 2>/dev/null' EXIT
    for i in $(seq 1 20); do
        if "$YAAZHI" run சோதனை_பின்தளம்_இணைப்பு.ழி >/dev/null 2>&1; then break; fi
        sleep 0.5
    done
    pkill -f "y2d_backend --serve 47834" 2>/dev/null
    DISPLAY="${DISPLAY:-:0}" "$NATIVE_DIR/build/y2d_backend" --serve 47834 2>/dev/null &
    Y2D_SRV2=$!
    sleep 1.5
    run_test "பின்தளம்-நிறுத்தம்" சோதனை_பின்தளம்_நிறுத்தம்.ழி
    kill -9 $Y2D_SRV2 2>/dev/null
    run_test "பின்தளம்-இணைப்பு" சோதனை_பின்தளம்_இணைப்பு.ழி
    run_test "பின்தளம்-வரைதல்" சோதனை_பின்தளம்_வரைதல்.ழி
    run_test "பின்தளம்-எழுத்து" சோதனை_பின்தளம்_எழுத்து.ழி
    run_test "பின்தளம்-படம்" சோதனை_பின்தளம்_படம்.ழி
    run_test "பின்தளம்-உள்ளீடு" சோதனை_பின்தளம்_உள்ளீடு.ழி
    run_test "பின்தளம்-ஒலி" சோதனை_பின்தளம்_ஒலி.ழி
    run_test "பின்தளம்-செயல்திறன்" சோதனை_பின்தளம்_செயல்திறன்.ழி
    if "$YAAZHI" run ../examples/பின்தளம்_எடுத்துக்காட்டு.ழி >/dev/null 2>&1; then ok "example பின்தளம்_எடுத்துக்காட்டு.ழி"; else bad "example பின்தளம்_எடுத்துக்காட்டு.ழி"; fi
    if "$YAAZHI" run ../examples/பின்தளம்_படம்_எடுத்துக்காட்டு.ழி >/dev/null 2>&1; then ok "example பின்தளம்_படம்_எடுத்துக்காட்டு.ழி"; else bad "example பின்தளம்_படம்_எடுத்துக்காட்டு.ழி"; fi
    run_fail_test "பின்தளம்-தவறு-படம்" சோதனை_பின்தளம்_தவறு_படம்.ழி
    run_fail_test "பின்தளம்-தவறு-சிதைவு" சோதனை_பின்தளம்_தவறு_சிதைவு.ழி
    kill -9 $Y2D_SRV 2>/dev/null
    trap 'rm -rf "$SHADOW" 2>/dev/null' EXIT
    rm -f shot_*.bmp
    cd "$LIB_DIR" || exit 1
fi

# Examples must run clean (நகர்வு/கட்டுப்பாடு need one piped key).
for ex in examples/வணக்கம்_சாளரம்.ழி examples/வடிவங்கள்.ழி examples/மோதல்_எடுத்துக்காட்டு.ழி examples/அசைவு_எடுத்துக்காட்டு.ழி examples/பார்வை_எடுத்துக்காட்டு.ழி examples/சிறுபடம்_எடுத்துக்காட்டு.ழி examples/தொகுப்பு_எடுத்துக்காட்டு.ழி examples/கட்டம்_எடுத்துக்காட்டு.ழி examples/துகள்_எடுத்துக்காட்டு.ழி examples/இயற்பியல்_எடுத்துக்காட்டு.ழி examples/காட்சி_எடுத்துக்காட்டு.ழி examples/ஒலி_எடுத்துக்காட்டு.ழி examples/சொத்து_எடுத்துக்காட்டு.ழி; do
    if "$YAAZHI" run "$ex" >/dev/null 2>&1; then ok "example $(basename "$ex")"; else bad "example $(basename "$ex")"; fi
done
printf 'ஆ\n' | "$YAAZHI" run examples/நகர்வு.ழி >/dev/null 2>&1
if [ $? -eq 0 ]; then ok "example நகர்வு.ழி"; else bad "example நகர்வு.ழி"; fi
printf 'ஆ\n' | "$YAAZHI" run examples/கட்டுப்பாடு_எடுத்துக்காட்டு.ழி >/dev/null 2>&1
if [ $? -eq 0 ]; then ok "example கட்டுப்பாடு_எடுத்துக்காட்டு.ழி"; else bad "example கட்டுப்பாடு_எடுத்துக்காட்டு.ழி"; fi

# project-game scenarios (run from the game dir so assets/ resolves).
cd "$LIB_DIR/../project-game" || exit 1
rm -f best.txt
{ for i in $(seq 1 14); do printf 'ஆ\n'; done; printf 'வெளி\nஇல்லை\n'; } > /tmp/vilai_catch.txt
if "$YAAZHI" run . < /tmp/vilai_catch.txt 2>/dev/null | grep -aq "மதிப்பெண்: 1"; then ok "game-catch"; else bad "game-catch"; fi
rm -f best.txt
{ for i in $(seq 1 50); do printf '\n'; done; printf 'இல்லை\n'; } > /tmp/vilai_miss.txt
if "$YAAZHI" run . < /tmp/vilai_miss.txt 2>/dev/null | grep -aq "மதிப்பெண்: 0"; then ok "game-over"; else bad "game-over"; fi
rm -f best.txt
if [ "$NATIVE_SKIP" -eq 0 ]; then
    cd "$LIB_DIR/tests" || exit 1
    pkill -f "y2d_backend --serve 47832" 2>/dev/null
    sleep 0.5
    DISPLAY="${DISPLAY:-:0}" "$NATIVE_DIR/build/y2d_backend" --serve 47832 2>/dev/null &
    Y2D_GAME_SRV=$!
    sleep 1.5
    "$YAAZHI" run உதவி_செலுத்து_வலது.ழி >/dev/null 2>&1
    cd "$LIB_DIR/../project-game" || exit 1
    printf 'இல்லை\n' | YAAZHI_BACKEND=47832 timeout 30 "$YAAZHI" run . > /tmp/vilai_native.txt 2>&1 &
    Y2D_GAME=$!
    sleep 4
    cd "$LIB_DIR/tests" || exit 1
    "$YAAZHI" run உதவி_செலுத்து_வெளியேறு.ழி >/dev/null 2>&1
    wait $Y2D_GAME 2>/dev/null
    if grep -aq "மதிப்பெண்: 1" /tmp/vilai_native.txt; then ok "game-native"; else bad "game-native"; fi
    kill -9 $Y2D_GAME_SRV 2>/dev/null
    cd "$LIB_DIR/../project-game" || exit 1
    rm -f best.txt
fi

echo "----------------------------------------"
echo "PASS=$PASS FAIL=$FAIL"
[ "$FAIL" -eq 0 ]
