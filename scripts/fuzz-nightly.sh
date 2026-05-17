#!/bin/bash
# fuzz-nightly.sh — Nightly fuzzing workflow
#
# Extended fuzzing + corpus maintenance + coverage heatmap.
# Designed for nightly CI or manual runs.
#
# Usage: bash scripts/fuzz-nightly.sh [duration_seconds]
#   Default duration: 120 seconds per fuzz target

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
cd "$PROJECT_DIR"

DURATION="${1:-120}"
START_TIME=$(date +%s)

echo "============================================"
echo " Nightly Fuzzing Workflow"
echo " Duration: ${DURATION}s per target"
echo " Started:  $(date)"
echo "============================================"
echo ""

# 1. Build
echo "=== Step 1: Build ==="
bun run build
echo ""

# 2. Long fuzzing per target
echo "=== Step 2: Extended Fuzzing ==="
FUZZ_TARGETS=(
  "test/fuzz/parse.fuzz.js:parse:64"
  "test/fuzz/format.fuzz.js:format:64"
  "test/fuzz/duration.fuzz.js:duration:32"
  "test/fuzz/operations.fuzz.js:operations:32"
  "test/fuzz/array-input.fuzz.js:array-input:32"
  "test/fuzz/utc.fuzz.js:utc:64"
  "test/fuzz/object-input.fuzz.js:object-input:32"
  "test/fuzz/reltime.fuzz.js:reltime:48"
  "test/fuzz/grammar.fuzz.js:grammar:48"
)

for entry in "${FUZZ_TARGETS[@]}"; do
  IFS=":" read -r harness corpus maxlen <<< "$entry"
  CORPUS_DIR="test/fuzz/corpus/${corpus}"
  mkdir -p "$CORPUS_DIR"

  echo "--- Fuzzing: ${corpus} ---"
  # Use existing corpus as seed, run for duration
  if [ -d "$CORPUS_DIR" ] && [ "$(ls -A "$CORPUS_DIR" 2>/dev/null | wc -l)" -gt 0 ]; then
    jazzer "$harness" --sync -i dist/ -- \
      -max_total_time="$DURATION" \
      -max_len="$maxlen" \
      -minimize_crash=1 \
      -print_pcs=1 \
      -print_final_stats=1 \
      "$CORPUS_DIR/"
  else
    jazzer "$harness" --sync -i dist/ -- \
      -max_total_time="$DURATION" \
      -max_len="$maxlen" \
      -minimize_crash=1 \
      -print_pcs=1 \
      -print_final_stats=1
  fi

  # Collect any new crash files
  for crash in crash-*; do
    if [ -f "$crash" ]; then
      mkdir -p test/fuzz/crashes
      mv "$crash" "test/fuzz/crashes/${corpus}-${crash}"
      echo "  ↪ Crash saved: test/fuzz/crashes/${corpus}-${crash}"
    fi
  done
  echo ""
done

# 3. Grammar fuzz with extra iterations
echo "--- Grammar fuzz (extended) ---"
jazzer test/fuzz/grammar.fuzz.js --sync -i dist/ -- \
  -max_total_time="$DURATION" \
  -max_len=48 \
  -minimize_crash=1 \
  test/fuzz/corpus/grammar/ 2>/dev/null || true
for crash in crash-*; do
  if [ -f "$crash" ]; then
    mkdir -p test/fuzz/crashes
    mv "$crash" "test/fuzz/crashes/grammar-${crash}"
  fi
done
echo ""

# 4. Cross-lib diff fuzzing
echo "--- Cross-lib diff fuzzing ---"
for harness in test/fuzz/diff-datefns.fuzz.js test/fuzz/diff-luxon.fuzz.js test/fuzz/diff-dayjs.fuzz.js; do
  name=$(basename "$harness" .fuzz.js)
  jazzer "$harness" --sync -i dist/ -- \
    -max_total_time=$((DURATION / 2)) \
    -max_len=16 \
    -minimize_crash=1
  for crash in crash-*; do
    if [ -f "$crash" ]; then
      mkdir -p test/fuzz/crashes
      mv "$crash" "test/fuzz/crashes/${name}-${crash}"
    fi
  done
done
echo ""

# 5. Corpus minimization
echo "=== Step 3: Corpus Minimization ==="
bun run scripts/fuzz-corpus-minimize.ts
echo ""

# 6. Run coverage + heatmap
echo "=== Step 4: Coverage Heatmap ==="
TZ=UTC bun test --coverage --coverage-reporter=lcov --coverage-dir=coverage \
  ./test/properties/ \
  ./test/branch-targeted.test.ts \
  ./test/stateful-model.test.ts \
  2>/dev/null || true

bun run scripts/fuzz-coverage-heatmap.ts
echo ""

# 7. Replay corpus for validation
echo "=== Step 5: Corpus Replay ==="
bun run scripts/fuzz-corpus-replay.ts 2>/dev/null || true
echo ""

ELAPSED=$(( $(date +%s) - START_TIME ))
echo "============================================"
echo " Nightly Fuzzing Complete"
echo " Elapsed: ${ELAPSED}s"
echo " Finished: $(date)"
echo "============================================"
