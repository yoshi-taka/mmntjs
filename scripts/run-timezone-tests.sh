#!/bin/bash
# Run all timezone/DST compatibility tests under multiple TZ environments
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
cd "$PROJECT_DIR"

COMPAT_FILE="test/timezone-compat.test.ts"
DST_FILE="test/timezone-dst-subproc.test.ts"

TZS=(
  "UTC"
  "America/New_York"
  "Europe/Berlin"
  "Asia/Tokyo"
  "Australia/Sydney"
  "America/Los_Angeles"
)

echo "============================================"
echo "Timezone / DST Compatibility Test Suite"
echo "============================================"
echo ""

all_pass=true

# Run the main compat tests under all TZs
echo "=== Main Compatibility Tests (${COMPAT_FILE}) ==="
for tz in "${TZS[@]}"; do
  echo "--- TZ=$tz ---"
  if TZ="$tz" bun test "$COMPAT_FILE" 2>&1; then
    echo "  ✅ PASS"
  else
    echo "  ❌ FAIL"
    all_pass=false
  fi
  echo ""
done

# Run the DST-specific tests (which compare against moment.js) under multiple TZs
echo "=== DST Boundary Tests (${DST_FILE}) ==="
for tz in "${TZS[@]}"; do
  echo "--- TZ=$tz ---"
  if TZ="$tz" bun test "$DST_FILE" 2>&1; then
    echo "  ✅ PASS"
  else
    echo "  ❌ FAIL"
    all_pass=false
  fi
  echo ""
done

if $all_pass; then
  echo "============================================"
  echo "✅ ALL TIMEZONE TESTS PASS"
  echo "============================================"
else
  echo "============================================"
  echo "❌ SOME TIMEZONE TESTS FAILED"
  echo "============================================"
  exit 1
fi
