#!/bin/bash
# Run DST compatibility tests under multiple timezone environments
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
cd "$PROJECT_DIR"

TEST_FILE="test/timezone-dst-subproc.test.ts"

echo "=== DST Compatibility Tests ==="
echo ""

TZS=(
  "America/New_York"
  "Europe/Berlin"
  "Asia/Tokyo"
  "Australia/Sydney"
  "America/Los_Angeles"
)

all_pass=true

for tz in "${TZS[@]}"; do
  echo "--- TZ=$tz ---"
  if TZ="$tz" bun test "$TEST_FILE" 2>&1; then
    echo "  ✅ PASS"
  else
    echo "  ❌ FAIL"
    all_pass=false
  fi
  echo ""
done

if $all_pass; then
  echo "✅ All DST tests pass across all timezones"
else
  echo "❌ Some DST tests failed"
  exit 1
fi
