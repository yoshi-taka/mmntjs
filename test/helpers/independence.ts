// -------------------------------------------------------------------------
// INDEPENDENCE — matroid-inspired test/bench/fuzz selection utilities
//
// No runtime matroid objects. No graph structures.
// Greedy set-cover basis selection, coverage classification, redundancy
// detection, and equivalence partitioning for mmntjs test infrastructure.
//
// USAGE (test-only):
//   import { selectBasis, classifyParseSeed } from "./helpers/independence";
// -------------------------------------------------------------------------

/** A minimal element with a label and coverage dimensions */
export interface CoverageElement {
  label: string;
  covers: Set<string>;
  cost?: number;
}

/** Greedy basis selection (maximum coverage per unit cost).
 *
 *  matroid analogue: given a set system (E, F) where F ⊆ 2^E are the
 *  "independent" sets (no redundant coverage), this computes a basis:
 *  a maximal independent set. For coverage functions the greedy
 *  algorithm is optimal (submodularity).
 */
export function selectBasis(
  elements: CoverageElement[],
  _allDimensions?: Set<string>,
  maxElements?: number,
): CoverageElement[] {
  const remaining = elements.map((e) => ({
    ...e,
    covers: new Set(e.covers),
  }));
  const selected: CoverageElement[] = [];
  const uncovered = new Set<string>();
  for (const e of elements) {
    for (const d of e.covers) {
      uncovered.add(d);
    }
  }

  while (uncovered.size > 0 && remaining.length > 0 && (maxElements === undefined || selected.length < maxElements)) {
    let bestIdx = -1;
    let bestScore = -1;
    for (let i = 0; i < remaining.length; i++) {
      let newCovered = 0;
      for (const d of remaining[i].covers) {
        if (uncovered.has(d)) {
          newCovered++;
        }
      }
      const cost = remaining[i].cost ?? 1;
      const score = cost > 0 ? newCovered / cost : newCovered;
      if (score > bestScore) {
        bestScore = score;
        bestIdx = i;
      }
    }
    if (bestIdx < 0 || bestScore <= 0) {
      break;
    }
    const best = remaining.splice(bestIdx, 1)[0];
    for (const d of best.covers) {
      uncovered.delete(d);
    }
    selected.push({ label: best.label, covers: new Set(best.covers) });
  }

  return selected;
}

// -------------------------------------------------------------------------
// PARSE INPUT CLASSIFICATION — maps a string to the fast path it exercises
// -------------------------------------------------------------------------

/** Category labels for parse fast paths (src/parse.ts) */
export const PARSE_FAST_PATHS = [
  "compact-YYYYMMDD",
  "compact-YYYYDDD",
  "compact-GGGGWww",
  "compact-GGGGWww-wd",
  "ISO-extended-dateonly",
  "ISO-extended-datetime",
  "ISO-extended-datetime-tz",
  "ISO-extended-week",
  "ISO-extended-ordinal",
  "ISO-extended-week-wd",
  "ISO-basic-date",
  "ISO-basic-datetime",
  "ISO-basic-datetime-tz",
  "ISO-basic-week",
  "ISO-basic-week-wd",
  "ISO-basic-ordinal",
  "RFC-2822",
  "JSON-Date",
  "format-based",
  "locale-based",
  "sign-prefixed-year",
  "empty-string",
  "whitespace",
  "non-date-string",
  "numeric-timestamp",
] as const;

export type ParseFastPath = (typeof PARSE_FAST_PATHS)[number];

/** Classify a parse input string by the fast path it triggers.
 *
 *  Maps to the code paths in src/parse.ts parseString() and
 *  parseCommonISOExtended(). Two inputs on the same path are
 *  equivalent for coverage purposes.
 */
export function classifyParseSeed(input: string): ParseFastPath {
  if (input === "") {
    return "empty-string";
  }
  const t = input.trim();
  if (t.length === 0) {
    return "whitespace";
  }
  if (/^\/?Date\(-?\d+\)\/?$/.test(t)) {
    return "JSON-Date";
  }
  if (/^\s*\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(t)) {
    return t.includes("Z") || /[+-]\d{2}:\d{2}/.test(t)
      ? "ISO-extended-datetime-tz"
      : "ISO-extended-datetime";
  }
  if (/^\s*\d{4}-\d{2}-\d{2}\s/.test(t)) {
    return "ISO-extended-datetime";
  }
  if (/^\s*\d{4}-\d{2}-\d{2}$/.test(t)) {
    return "ISO-extended-dateonly";
  }
  if (/^\s*\d{4}-\d{3}$/.test(t)) {
    return "ISO-extended-ordinal";
  }
  if (/^\s*\d{4}-W\d{2}/.test(t)) {
    return t.length > 8 ? "ISO-extended-week-wd" : "ISO-extended-week";
  }
  if (/^\s*\d{8}$/.test(t)) {
    return "compact-YYYYMMDD";
  }
  if (/^\s*\d{7}$/.test(t)) {
    return "compact-YYYYDDD";
  }
  if (/^\s*\d{4}W\d{2}\d?$/.test(t)) {
    return t.length === 8 ? "compact-GGGGWww-wd" : "compact-GGGGWww";
  }
  if (/^\s*\d{4}\d{2}\d{2}T\d{2}\d{2}\d{2}/.test(t)) {
    return t.includes("+") || t.includes("-") || t.endsWith("Z")
      ? "ISO-basic-datetime-tz"
      : "ISO-basic-datetime";
  }
  if (/^\s*\d{4}\d{2}\d{2}$/.test(t)) {
    return "ISO-basic-date";
  }
  if (/^\s*\d{4}W\d{3}\d?$/.test(t)) {
    return t.length === 9 ? "ISO-basic-week-wd" : "ISO-basic-week";
  }
  if (/^\s*[+-]\d{6}/.test(t)) {
    return "sign-prefixed-year";
  }
  if (/^\s*(Mon|Tue|Wed|Thu|Fri|Sat|Sun)/i.test(t)) {
    return "RFC-2822";
  }
  if (/^\s*\d+$/.test(t)) {
    return "numeric-timestamp";
  }
  if (/[a-zA-Z]/.test(t)) {
    return "non-date-string";
  }
  return "format-based";
}

// -------------------------------------------------------------------------
// OPERATION CLASSIFICATION — maps an operation+unit to its hot-path group
// -------------------------------------------------------------------------

/** Unit classes as identified in moment-class.ts switch cases */
export const UNIT_CLASSES = [
  "year",
  "month",
  "quarter",
  "date",
  "day",
  "week",
  "isoWeek",
  "hour",
  "minute",
  "second",
  "millisecond",
  "isoWeekday",
  "weekday",
  "dayOfYear",
  "weekYear",
  "isoWeekYear",
] as const;

export type UnitClass = (typeof UNIT_CLASSES)[number];

/** Hot-path code groups in moment-class.ts */
export type CodeGroup = "epoch" | "calendar" | "day" | "calendar-extra";

/** Map from unit to its code group (independence class).
 *
 *  Elements in the same group share a switch-case path; optimizing one
 *  cannot independently affect the other without cross-group risk.
 */
export function unitCodeGroup(unit: UnitClass): CodeGroup {
  switch (unit) {
    case "hour":
    case "minute":
    case "second":
    case "millisecond":
      return "epoch";
    case "year":
    case "month":
    case "quarter":
      return "calendar";
    case "date":
    case "day":
    case "week":
    case "isoWeek":
      return "day";
    default:
      return "calendar-extra";
  }
}

/** Operation families in moment-class.ts */
export type OperationFamily = "add" | "subtract" | "startOf" | "endOf" | "diff" | "set" | "get" | "parse";

export interface OperationCoverage {
  operation: OperationFamily;
  unit: UnitClass;
  mode: "UTC" | "local" | "both";
  boundary: "normal" | "DST" | "month-end" | "leap-year" | "invalid" | "epoch-edge";
}

/** Build coverage dimensions for an operation.
 *
 *  Two operations with the same dimensions exercise identical code paths
 *  (for test-minimization purposes).
 */
export function operationDimensions(op: OperationCoverage): Set<string> {
  const s = new Set<string>();
  s.add(`op:${op.operation}`);
  s.add(`unit-group:${unitCodeGroup(op.unit)}`);
  s.add(`unit:${op.unit}`);
  s.add(`mode:${op.mode}`);
  s.add(`boundary:${op.boundary}`);
  return s;
}

/** Redundant operation pairs (same switch case) */
export const REDUNDANT_UNIT_PAIRS: [UnitClass, UnitClass][] = [
  ["date", "day"],
  ["week", "isoWeek"],
];

/** Returns true if two operations exercise the same hot-path code
 *  for all operations (add/subtract/startOf/endOf/diff/set) */
export function areEquivalentPaths(a: UnitClass, b: UnitClass): boolean {
  if (a === b) {
    return true;
  }
  return REDUNDANT_UNIT_PAIRS.some(
    ([x, y]) => (a === x && b === y) || (a === y && b === x),
  );
}

// -------------------------------------------------------------------------
// FUZZ CORPUS MINIMIZATION
// -------------------------------------------------------------------------

export interface FuzzSeed {
  path: string;
  content: string;
}

/** Build coverage dimensions for a parse fuzz seed */
export function parseSeedDimensions(seed: FuzzSeed): Set<string> {
  const p = classifyParseSeed(seed.content);
  const s = new Set<string>([`parse-path:${p}`]);
  // Also flag boundary variants
  const t = seed.content.trim().toLowerCase();
  if (t.includes("dst") || t.includes("02:30") || t.includes("01:30")) {
    s.add("boundary:DSTRange");
  }
  if (t.includes("02-29") || t.includes("02/29") || t.includes("leap")) {
    s.add("boundary:leap-year");
  }
  if (
    (t.includes("01-31") || t.includes("01/31")) &&
    t.length < 12
  ) {
    s.add("boundary:month-end");
  }
  if (seed.content.length === 0 || seed.content.trim().length === 0) {
    s.add("boundary:empty");
  }
  if (/[a-zA-Z]/.test(t) && !/^(mon|tue|wed|thu|fri|sat|sun)/i.test(t)) {
    s.add("boundary:non-date");
  }
  return s;
}

/** Minimal basis for parse fuzz corpus */
export function minimizeFuzzCorpus(seeds: FuzzSeed[]): FuzzSeed[] {
  const elements: CoverageElement[] = seeds.map((s) => ({
    label: s.path,
    covers: parseSeedDimensions(s),
  }));
  const basis = selectBasis(elements);
  const selected = new Set(basis.map((b) => b.label));
  return seeds.filter((s) => selected.has(s.path));
}

// -------------------------------------------------------------------------
// BENCHMARK SPECIFICATION
// -------------------------------------------------------------------------

export interface BenchmarkSpec {
  label: string;
  operation: string;
  codeGroup: CodeGroup;
  mode: "UTC" | "local";
  boundary: string;
}

/** Generate a minimal independent benchmark set covering all code groups */
export function minimalBenchmarkSet(): BenchmarkSpec[] {
  // One per (code-group × mode × operation-family) covering at most one boundary
  const specs: BenchmarkSpec[] = [];
  const ops: OperationFamily[] = ["add", "startOf", "endOf", "diff", "parse"];
  const groups: [CodeGroup, UnitClass, string][] = [
    ["epoch", "hour", 'moment(d).add(1, "hour")'],
    ["day", "day", 'moment(d).add(1, "day")'],
    ["calendar", "month", 'moment(d).add(1, "month")'],
  ];

  for (const op of ops) {
    if (op === "parse") {
      specs.push(
        { label: "parse compact YYYYMMDD", operation: 'moment("20240115")', codeGroup: "epoch", mode: "local", boundary: "normal" },
        { label: "parse ISO extended", operation: 'moment("2024-01-15")', codeGroup: "epoch", mode: "local", boundary: "normal" },
        { label: "parse ISO with tz", operation: 'moment("2024-01-15T12:30:00Z")', codeGroup: "epoch", mode: "UTC", boundary: "normal" },
        { label: "parse RFC 2822", operation: 'moment("Mon, 02 Jan 2017 06:00:00 -0800")', codeGroup: "epoch", mode: "local", boundary: "normal" },
      );
      continue;
    }
    for (const [group, unit] of groups) {
      // local mode
      specs.push({
        label: `${op} ${unit} local`,
        operation: `moment(d).${op}(1, "${unit}")`,
        codeGroup: group,
        mode: "local",
        boundary: "normal",
      });
      // UTC mode
      specs.push({
        label: `${op} ${unit} UTC`,
        operation: `moment.utc(d).${op}(1, "${unit}")`,
        codeGroup: group,
        mode: "UTC",
        boundary: "normal",
      });
    }
  }

  // Boundary-specific variants (only for the calendar group where it matters)
  specs.push(
    { label: "add month month-end clamp", operation: 'moment([2024, 0, 31]).add(1, "month")', codeGroup: "calendar", mode: "local", boundary: "month-end" },
    { label: "add month leap-year", operation: 'moment([2024, 1, 29]).add(1, "year")', codeGroup: "calendar", mode: "local", boundary: "leap-year" },
  );

  return specs;
}

// -------------------------------------------------------------------------
// REDUNDANCY REPORTS
// -------------------------------------------------------------------------

export interface RedundancyReport {
  label: string;
  redundantWith: string;
  reason: string;
}

/** Find redundant unit alias pairs and no-op combinations */
export function findRedundantCombinations(): RedundancyReport[] {
  return [
    {
      label: 'add(1, "date")',
      redundantWith: 'add(1, "day")',
      reason: "same switch case DATE/DAY in _addSimple",
    },
    {
      label: 'add(1, "week")',
      redundantWith: 'add(1, "isoWeek")',
      reason: "same switch case WEEK/ISO_WEEK in _addSimple",
    },
    {
      label: 'add(1, "quarter")',
      redundantWith: 'add(3, "month")',
      reason: "QUARTER computes amount*3 then falls to MONTH",
    },
    {
      label: 'diff(a, "date")',
      redundantWith: 'diff(a, "day")',
      reason: "same switch case DATE/DAY in diff",
    },
    {
      label: 'startOf("date")',
      redundantWith: 'startOf("day")',
      reason: "same switch case DATE/DAY in startOf",
    },
    {
      label: 'endOf("date")',
      redundantWith: 'endOf("day")',
      reason: "same switch case DATE/DAY in endOf",
    },
    {
      label: "add(0, any)",
      redundantWith: "no-op",
      reason: "early return in add() line 1657 and _addSimple 'if (rounded !== 0)'",
    },
    {
      label: "startOf(MONTH) when already start",
      redundantWith: "no-op",
      reason: "early return in startOf() lines 1806-1809",
    },
    {
      label: "startOf(DATE) when midnight",
      redundantWith: "no-op",
      reason: "early return in startOf() lines 1810-1813",
    },
    {
      label: "subtract(1, x)",
      redundantWith: 'add(-1, x)',
      reason: "subtract delegates to add(-amount, unit) line 1780",
    },
    {
      label: "diff no unit",
      redundantWith: "valueOf subtraction",
      reason: "diff() with no unit returns a-b (ms) line 2166-2168",
    },
  ];
}
