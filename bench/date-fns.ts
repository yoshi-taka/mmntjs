import mmntjs from "mmntjs";
import {
  parseISO,
  addDays,
  addMonths,
  addSeconds,
  addMilliseconds,
  subDays,
  format as dfFormat,
  lightFormat,
  isAfter,
  isBefore,
  startOfMonth,
  startOfYear,
  endOfMonth,
  startOfDay,
  differenceInCalendarDays,
  differenceInCalendarMonths,
  getDaysInMonth,
  isLeapYear,
  setYear as dfSetYear,
  setMonth as dfSetMonth,
  setDate as dfSetDate,
  setHours,
  setMinutes,
  setSeconds,
  setMilliseconds,
  getDayOfYear,
} from "date-fns";
import { run, runCold, micros, ratioLabel, COLD_RUNS, WARM_RUNS, ITERATIONS, WARMUP, type BenchStats } from "./lib/harness";

// ─────────────────────────────────────────────────────────
// mmntjs vs date-fns
//
// Only semantically equivalent operations are compared.
//
// NOTE: date-fns operates on native Date utilities, while
// mmntjs preserves Moment-compatible mutable object
// semantics.  date-fns functions create new Date instances
// (immutable style); mmntjs mutates in-place.  The
// comparison apples-to-oranges factor is documented here
// for fairness.
//
// NOT compared:
//   - clone (no date-fns equivalent)
//   - locale-heavy Moment features (LL, LT, etc.)
//   - mutable chain semantics
// ─────────────────────────────────────────────────────────

type BenchCase = { name: string; run: () => [() => void, () => void] };

const CASES: BenchCase[] = [
  // ── CREATE ──
  {
    name: "parse ISO string",
    run: () => [
      () => mmntjs("2024-01-15T10:30:45.123Z"),
      () => parseISO("2024-01-15T10:30:45.123Z"),
    ],
  },
  {
    name: "moment() / new Date()",
    run: () => [() => mmntjs(), () => new Date()],
  },
  {
    name: "moment([y,M,d]) / new Date(y,m,d)",
    run: () => [() => mmntjs([2024, 5, 15]), () => new Date(2024, 5, 15)],
  },

  // ── FORMAT ──
  {
    name: "format YYYY-MM-DD",
    run: () => {
      const m = mmntjs("2024-06-15");
      const d = new Date(2024, 5, 15);
      return [() => m.format("YYYY-MM-DD"), () => dfFormat(d, "yyyy-MM-dd")];
    },
  },
  {
    name: "lightFormat YYYY-MM-DD",
    run: () => {
      const m = mmntjs("2024-06-15");
      const d = new Date(2024, 5, 15);
      return [() => m.format("YYYY-MM-DD"), () => lightFormat(d, "yyyy-MM-dd")];
    },
  },
  {
    name: "format HH:mm:ss",
    run: () => {
      const m = mmntjs("2024-06-15 10:30:45");
      const d = new Date(2024, 5, 15, 10, 30, 45);
      return [() => m.format("HH:mm:ss"), () => dfFormat(d, "HH:mm:ss")];
    },
  },

  // ── ADD (fresh object for mutating ops) ──
  {
    name: "add 1 day",
    run: () => [
      () => mmntjs("2024-06-15").add(1, "day"),
      () => addDays(new Date(2024, 5, 15), 1),
    ],
  },
  {
    name: "add 1 month",
    run: () => [
      () => mmntjs("2024-06-15").add(1, "month"),
      () => addMonths(new Date(2024, 5, 15), 1),
    ],
  },
  {
    name: "add 1 second",
    run: () => [
      () => mmntjs("2024-06-15 10:30:45.123").add(1, "second"),
      () => addSeconds(new Date(2024, 5, 15, 10, 30, 45, 123), 1),
    ],
  },
  {
    name: "add 1 ms",
    run: () => [
      () => mmntjs("2024-06-15 10:30:45.123").add(1, "millisecond"),
      () => addMilliseconds(new Date(2024, 5, 15, 10, 30, 45, 123), 1),
    ],
  },

  // ── SUBTRACT ──
  {
    name: "sub 1 day",
    run: () => [
      () => mmntjs("2024-06-15").add(-1, "day"),
      () => subDays(new Date(2024, 5, 15), 1),
    ],
  },

  // ── COMPARE (read-only, may reuse) ──
  {
    name: "isAfter",
    run: () => {
      const a = mmntjs("2024-06-15"), b = mmntjs("2024-07-01");
      const c = new Date(2024, 5, 15), d = new Date(2024, 6, 1);
      return [() => a.isAfter(b), () => isAfter(c, d)];
    },
  },
  {
    name: "isBefore",
    run: () => {
      const a = mmntjs("2024-06-15"), b = mmntjs("2024-07-01");
      const c = new Date(2024, 5, 15), d = new Date(2024, 6, 1);
      return [() => a.isBefore(b), () => isBefore(c, d)];
    },
  },
  {
    name: "diff in days",
    run: () => {
      const a = mmntjs("2024-06-15"), b = mmntjs("2024-07-01");
      const c = new Date(2024, 5, 15), d = new Date(2024, 6, 1);
      return [() => a.diff(b, "days"), () => differenceInCalendarDays(d, c)];
    },
  },
  {
    name: "diff in months",
    run: () => {
      const a = mmntjs("2024-01-15"), b = mmntjs("2024-12-01");
      const c = new Date(2024, 0, 15), d = new Date(2024, 11, 1);
      return [() => a.diff(b, "months"), () => differenceInCalendarMonths(d, c)];
    },
  },

  // ── START / END (fresh object) ──
  {
    name: "startOf month",
    run: () => [
      () => mmntjs("2024-06-15").startOf("month"),
      () => startOfMonth(new Date(2024, 5, 15)),
    ],
  },
  {
    name: "startOf year",
    run: () => [
      () => mmntjs("2024-06-15").startOf("year"),
      () => startOfYear(new Date(2024, 5, 15)),
    ],
  },
  {
    name: "startOf day",
    run: () => [
      () => mmntjs("2024-06-15 10:30:00").startOf("day"),
      () => startOfDay(new Date(2024, 5, 15, 10, 30)),
    ],
  },
  {
    name: "endOf month",
    run: () => [
      () => mmntjs("2024-06-15").endOf("month"),
      () => endOfMonth(new Date(2024, 5, 15)),
    ],
  },
  {
    name: "dayOfYear",
    run: () => {
      const m = mmntjs("2024-06-15");
      const d = new Date(2024, 5, 15);
      return [() => m.dayOfYear(), () => getDayOfYear(d)];
    },
  },

  // ── PROPERTY-LIKE (read-only, may reuse) ──
  {
    name: "daysInMonth",
    run: () => {
      const m = mmntjs("2024-06-15");
      const d = new Date(2024, 5, 15);
      return [() => m.daysInMonth(), () => getDaysInMonth(d)];
    },
  },
  {
    name: "isLeapYear",
    run: () => {
      const m = mmntjs("2024-06-15");
      const d = new Date(2024, 5, 15);
      return [() => m.isLeapYear(), () => isLeapYear(d)];
    },
  },

  // ── SETTERS (fresh object) ──
  {
    name: "set year",
    run: () => [
      () => { mmntjs("2024-06-15").year(2020); },
      () => { dfSetYear(new Date(2024, 5, 15), 2020); },
    ],
  },
  {
    name: "set month",
    run: () => [
      () => { mmntjs("2024-06-15").month(3); },
      () => { dfSetMonth(new Date(2024, 5, 15), 3); },
    ],
  },
  {
    name: "set date",
    run: () => [
      () => { mmntjs("2024-06-15").date(15); },
      () => { dfSetDate(new Date(2024, 5, 15), 15); },
    ],
  },
  {
    name: "set hour",
    run: () => [
      () => { mmntjs("2024-06-15 10:30:00").hour(0); },
      () => { setHours(new Date(2024, 5, 15, 10, 30), 0); },
    ],
  },
  {
    name: "set minute",
    run: () => [
      () => { mmntjs("2024-06-15 10:30:00").minute(0); },
      () => { setMinutes(new Date(2024, 5, 15, 10, 30), 0); },
    ],
  },
  {
    name: "set second",
    run: () => [
      () => { mmntjs("2024-06-15 10:30:45").second(0); },
      () => { setSeconds(new Date(2024, 5, 15, 10, 30, 45), 0); },
    ],
  },
  {
    name: "set millisecond",
    run: () => [
      () => { mmntjs("2024-06-15 10:30:45.123").millisecond(0); },
      () => { setMilliseconds(new Date(2024, 5, 15, 10, 30, 45, 123), 0); },
    ],
  },
];

// ─────────────────────────────────────────────────────────
// Run
// ─────────────────────────────────────────────────────────

const HEADER = "mmntjs vs date-fns — Benchmark";
const SEP = "=".repeat(HEADER.length);

console.log(HEADER);
console.log(SEP);
console.log("");
console.log("Semantically equivalent operations only.");
console.log("date-fns operates on native Date utilities (immutable style);");
console.log("mmntjs preserves Moment-compatible mutable object semantics.");
console.log("Mutating ops use fresh objects per iteration.");
console.log("");

console.log(
  "Operation                              mmntjs      date-fns    ratio",
);

for (const c of CASES) {
  const runsM2: number[] = [];
  const runsDF: number[] = [];
  for (let r = 0; r < WARM_RUNS; r++) {
    const [fnM2, fnDF] = c.run();
    runsM2.push(run(fnM2, ITERATIONS, WARMUP));
    runsDF.push(run(fnDF, ITERATIONS, WARMUP));
  }
  runsM2.sort((a, b) => a - b);
  runsDF.sort((a, b) => a - b);
  const statsM2: BenchStats = {
    median: runsM2[Math.floor(WARM_RUNS / 2)],
    min: runsM2[0],
    max: runsM2[WARM_RUNS - 1],
  };
  const statsDF: BenchStats = {
    median: runsDF[Math.floor(WARM_RUNS / 2)],
    min: runsDF[0],
    max: runsDF[WARM_RUNS - 1],
  };
  const ratio = ((statsDF.median / statsM2.median) * 100).toFixed(1);
  const verb = Number(ratio) > 100
    ? `  ${(Number(ratio) / 100).toFixed(1)}x faster`
    : `  ${(100 / Number(ratio)).toFixed(1)}x slower`;
  console.log(
    `${c.name.padEnd(35)} ${micros(statsM2.median).padStart(10)} ${micros(statsDF.median).padStart(10)} ${verb}`,
  );
}

console.log("");
console.log(`% = date-fns / mmntjs x 100. >100% = mmntjs faster. <100% = date-fns faster.`);
console.log(`"~" prefix marks noisy short runs.`);
