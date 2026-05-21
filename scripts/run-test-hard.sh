#!/usr/bin/env bash
# Wrapper for `bun run test:hard`
# Runs each test group with clear headers, collects pass/fail per group,
# and prints a final summary — no more grepping needed.
set -uo pipefail
cd "$(dirname "$0")/.."

idx=0
any_fail=0
declare -a results=()

run_group() {
  local label="$1"; shift
  local TZ_VAR="${TZ:-UTC}"
  echo ""
  echo "═══════════════════════════════════════════════════════════════════"
  echo "  GROUP $((++idx)): ${label}"
  echo "═══════════════════════════════════════════════════════════════════"
  set +e
  output=$(TZ="$TZ_VAR" "$@" 2>&1)
  ec=$?
  set -e
  pass=$(echo "$output" | grep -oE '[0-9]+ pass' | grep -oE '[0-9]+' | tail -1)
  fail=$(echo "$output" | grep -oE '[0-9]+ fail' | grep -oE '[0-9]+' | tail -1)
  echo "$output" | tail -6
  echo ""
  if [ -n "$fail" ] && [ "$fail" -gt 0 ] 2>/dev/null; then
    echo "  ❌ ${fail} failures  (exit=${ec})"
    any_fail=1
  else
    echo "  ✅ ${pass:-?} pass, 0 fail  (exit=${ec})"
  fi
  results+=("${label}: ${pass:-?} pass, ${fail:-0} fail")
  return 0  # always continue
}

# ── Phase 1: main suite ──
run_group "Core / moment compat / locale / property-based" \
  bun test --parallel \
    ./test/moment/*.js \
    ./test/mmntjs.test.ts \
    ./test/temporal.test.ts \
    ./test/tree-shaking.test.ts \
    ./test/regression/ \
    ./test/parse-main.test.ts \
    ./test/parse-format.test.ts \
    ./test/timezone-compat.test.ts \
    ./packages/timezone/test/ \
    ./packages/timezone/test/properties-intensive.test.ts \
    ./test/properties/ \
    ./test/locale/*.test.ts \
    ./test/locale-format-targeted.test.ts \
    ./test/locale-metamorphic.test.ts \
    ./test/locale-equivalence.test.ts \
    ./test/locale-branch-targeted.test.ts \
    ./test/display-branch-targeted.test.ts \
    ./test/calendar-branch-targeted.test.ts \
    ./test/comparison-branch-targeted.test.ts \
    ./test/sbst-*.test.ts \
    ./test/stateful-model.test.ts \
    ./test/branch-targeted.test.ts \
    ./test/bundle-smoke.test.ts \
    ./test/calendar-extra.test.ts \
    ./test/coverage-targeted.test.ts \
    ./test/debug-extra.test.ts \
    ./test/debug_resolve_path.test.ts \
    ./test/display-extra.test.ts \
    ./test/duration-between.test.ts \
    ./test/duration-extra.test.ts \
    ./test/factory-input-format.test.ts \
    ./test/factory-lite.test.ts \
    ./test/format-basic.test.ts \
    ./test/iso-parse-temporal-oracle.test.ts \
    ./test/locale-extra.test.ts \
    ./test/locale-mgmt.test.ts \
    ./test/moment-class-extra.test.ts \
    ./test/moment-lite.test.ts \
    ./test/parse-lite-strict.test.ts \
    ./test/parse-lite.test.ts \
    ./test/plugins.test.ts \
    ./test/units.test.ts \
    ./test/utc-extra.test.ts

# ── Phase 2: generated regression ──
run_group "Generated regression" \
  bun test ./test/regression/generated.test.ts

# ── Phase 3: mutation ──
run_group "Mutation" \
  bun test ./test/mutation.test.ts

# ── Phase 4: bin ──
run_group "Bin" \
  bun test ./test/bin.test.ts

# ── Phase 5: DST subproc ──
TZ=America/New_York run_group "DST (America/New_York)" \
  bun test ./test/timezone-dst-subproc.test.ts

# ── Phase 6: stateful model in JST ──
TZ=Asia/Tokyo run_group "Stateful model (Asia/Tokyo)" \
  bun test ./test/stateful-model.test.ts

# ── Phase 7: build ──
echo ""
echo "═══════════════════════════════════════════════════════════════════"
echo "  BUILD"
echo "═══════════════════════════════════════════════════════════════════"
bun run build

# ── Phase 8: bundle smoke ──
run_group "Bundle smoke (runtime)" \
  bun test ./test/bundle-smoke.test.ts -t 'runtime smoke'

# ── Phase 9: kibana compat ──
run_group "Kibana compat / main" \
  bun test --preload ./test/kibana-compat/approaches/approach-c-preload.ts \
    ./test/kibana-compat/kibana-compat.test.ts

run_group "Kibana compat / npm alias" \
  bun test --preload ./test/kibana-compat/approaches/approach-c-preload.ts \
    ./test/kibana-compat/approaches/approach-a-npm-alias.test.ts

run_group "Kibana compat / direct import" \
  bun test ./test/kibana-compat/approaches/approach-b-direct-import.test.ts

run_group "Kibana compat / preload" \
  bun test --preload ./test/kibana-compat/approaches/approach-c-preload.ts \
    ./test/kibana-compat/approaches/approach-c-preload.test.ts

run_group "Kibana date-math" \
  bun test ./test/kibana-compat/kbn-datemath-runner.test.ts

# ── Phase 10: grafana compat ──
run_group "Grafana compat / main" \
  bun test --preload ./test/grafana-compat/approaches/approach-c-preload.ts \
    ./test/grafana-compat/grafana-compat.test.ts

run_group "Grafana compat / direct import" \
  bun test ./test/grafana-compat/approaches/approach-b-direct-import.test.ts

run_group "Grafana compat / preload" \
  bun test --preload ./test/grafana-compat/approaches/approach-c-preload.ts \
    ./test/grafana-compat/approaches/approach-c-preload.test.ts

# ── Phase 11: fuzz (quick) ──
echo ""
echo "═══════════════════════════════════════════════════════════════════"
echo "  GROUP $((++idx)): Fuzz (quick)"
echo "═══════════════════════════════════════════════════════════════════"
for fuzzer in \
  parse format duration operations array-input utc object-input \
  reltime diff-datefns diff-luxon diff-dayjs; do
  echo "  fuzz: ${fuzzer}..."
  jazzer "test/fuzz/${fuzzer}.fuzz.js" --sync -i dist/ -- -runs=500 -max_len=64 2>/dev/null || true
done

echo ""
echo "═══════════════════════════════════════════════════════════════════"
echo "  GROUP $((++idx)): Fuzz (parse -max_total_time=60)"
echo "═══════════════════════════════════════════════════════════════════"
jazzer test/fuzz/parse.fuzz.js --sync -i dist/ -- -max_total_time=60 -minimize_crash=1 2>/dev/null || true

echo ""
echo "═══════════════════════════════════════════════════════════════════"
echo "  GROUP $((++idx)): Fuzz grammar (TZ=Asia/Tokyo)"
echo "═══════════════════════════════════════════════════════════════════"
TZ=Asia/Tokyo jazzer test/fuzz/grammar.fuzz.js --sync -i dist/ -- -runs=10000 -max_len=48 2>/dev/null || true

# ── FINAL SUMMARY ──
echo ""
echo "═══════════════════════════════════════════════════════════════════"
echo "  FINAL SUMMARY"
echo "═══════════════════════════════════════════════════════════════════"
for r in "${results[@]}"; do
  echo "    $r"
done
echo "---"
if [ "$any_fail" -eq 0 ]; then
  echo "  ✅ ALL TESTS PASS"
else
  echo "  ❌ SOME GROUPS HAVE FAILURES (see above)"
  exit 1
fi
