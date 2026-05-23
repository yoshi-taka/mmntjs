import mmntjs from "mmntjs";
import moment from "../moment/moment.js";
import { run, micros, WARM_RUNS, ITERATIONS, WARMUP, type BenchStats } from "./lib/harness";

// ─────────────────────────────────────────────────────────
// Developer microbenchmarks
//
// These benchmarks target specific internal code paths for
// optimization work.  They are NOT representative of
// real-world usage patterns.
//
// Contents:
//   - Specialized setter variants (D<=28, D>28, UTC/local)
//   - p.d hot path (hour/minute/second setters with pre-existing date data)
//   - Clone fast paths
//   - Duration fast path internals
//   - Chain microbenchmarks (varying setter counts)
//   - Cache interaction patterns (warm after setter, dirty flag)
//
// Results should be interpreted as developer diagnostics,
// not as a basis for library comparison claims.
// ─────────────────────────────────────────────────────────

interface BenchCase {
  name: string;
  run: () => [() => void, () => void]; // [mmntjs, moment]
}

// Helper: fresh moment object per iteration for mutating ops.
const M = (s: string) => () => moment(s);
const M2 = (s: string) => () => mmntjs(s);

const CASES: BenchCase[] = [
  // ── Specialized setters ──
  {
    name: "set year UTC [fresh]",
    run: () => [
      () => { mmntjs.utc("2024-06-15").year(2020); },
      () => { moment.utc("2024-06-15").year(2020); },
    ],
  },
  {
    name: "set year local D<=28 [fresh]",
    run: () => [
      () => { mmntjs("2024-06-15").year(2020); },
      () => { moment("2024-06-15").year(2020); },
    ],
  },
  {
    name: "set year local D>28 (Jan31→Feb) [fresh]",
    run: () => [
      () => { mmntjs("2024-01-31").year(2023); },
      () => { moment("2024-01-31").year(2023); },
    ],
  },
  {
    name: "set month UTC [fresh]",
    run: () => [
      () => { mmntjs.utc("2024-06-15").month(0); },
      () => { moment.utc("2024-06-15").month(0); },
    ],
  },
  {
    name: "set month local D<=28 [fresh]",
    run: () => [
      () => { mmntjs("2024-06-15").month(0); },
      () => { moment("2024-06-15").month(0); },
    ],
  },
  {
    name: "set date D<=28 UTC [fresh]",
    run: () => [
      () => { mmntjs.utc("2024-06-15").date(15); },
      () => { moment.utc("2024-06-15").date(15); },
    ],
  },
  {
    name: "set date D<=28 local [fresh]",
    run: () => [
      () => { mmntjs("2024-06-15").date(15); },
      () => { moment("2024-06-15").date(15); },
    ],
  },
  {
    name: "set date D>28 UTC [fresh]",
    run: () => [
      () => { mmntjs.utc("2024-01-31").date(31); },
      () => { moment.utc("2024-01-31").date(31); },
    ],
  },
  {
    name: "set date D>28 local [fresh]",
    run: () => [
      () => { mmntjs("2024-01-31").date(31); },
      () => { moment("2024-01-31").date(31); },
    ],
  },

  // ── p.d hot path (hour setter with pre-existing parsed date) ──
  {
    name: "set hour UTC (p.d hot) [fresh]",
    run: () => [
      () => { mmntjs.utc("2024-06-15").hour(12); },
      () => { moment.utc("2024-06-15").hour(12); },
    ],
  },
  {
    name: "set hour local (p.d hot) [fresh]",
    run: () => [
      () => { mmntjs("2024-06-15").hour(12); },
      () => { moment("2024-06-15").hour(12); },
    ],
  },
  {
    name: "set minute UTC [fresh]",
    run: () => [
      () => { mmntjs.utc("2024-06-15 10:30:00").minute(0); },
      () => { moment.utc("2024-06-15 10:30:00").minute(0); },
    ],
  },
  {
    name: "set second local [fresh]",
    run: () => [
      () => { mmntjs("2024-06-15 10:30:45").second(0); },
      () => { moment("2024-06-15 10:30:45").second(0); },
    ],
  },
  {
    name: "set ms local [fresh]",
    run: () => [
      () => { mmntjs("2024-06-15 10:30:45.123").millisecond(0); },
      () => { moment("2024-06-15 10:30:45.123").millisecond(0); },
    ],
  },

  // ── Chained setters ──
  {
    name: "chained y+M+d (3 setters) [fresh]",
    run: () => [
      () => { mmntjs("2024-06-15").year(2020).month(0).date(1); },
      () => { moment("2024-06-15").year(2020).month(0).date(1); },
    ],
  },
  {
    name: "chained H+m+s+ms (4 setters) [fresh]",
    run: () => [
      () => mmntjs("2024-06-15 10:30:45.123").hour(0).minute(0).second(0).millisecond(0),
      () => moment("2024-06-15 10:30:45.123").hour(0).minute(0).second(0).millisecond(0),
    ],
  },
  {
    name: "chained y+M+d+H+m+s (6 setters) [fresh]",
    run: () => [
      () => mmntjs("2024-06-15 10:30:45").year(2020).month(0).date(1).hour(0).minute(0).second(0),
      () => moment("2024-06-15 10:30:45").year(2020).month(0).date(1).hour(0).minute(0).second(0),
    ],
  },

  // ── startOf / endOf variants ──
  {
    name: "startOf('day') UTC [fresh]",
    run: () => [
      () => mmntjs.utc("2024-06-15").startOf("day"),
      () => moment.utc("2024-06-15").startOf("day"),
    ],
  },
  {
    name: "startOf('day') local [fresh]",
    run: () => [
      () => mmntjs("2024-06-15").startOf("day"),
      () => moment("2024-06-15").startOf("day"),
    ],
  },
  {
    name: "startOf('week').startOf('year') [fresh]",
    run: () => [
      () => mmntjs("2024-06-15").startOf("week").startOf("year"),
      () => moment("2024-06-15").startOf("week").startOf("year"),
    ],
  },
  {
    name: "startOf('month').endOf('month') [fresh]",
    run: () => [
      () => { mmntjs("2024-06-15").startOf("month").endOf("month"); },
      () => { moment("2024-06-15").startOf("month").endOf("month"); },
    ],
  },
  {
    name: "startOf('year') [fresh]",
    run: () => [
      () => mmntjs("2024-06-15").startOf("year"),
      () => moment("2024-06-15").startOf("year"),
    ],
  },
  {
    name: "endOf('year') [fresh]",
    run: () => [
      () => mmntjs("2024-06-15").endOf("year"),
      () => moment("2024-06-15").endOf("year"),
    ],
  },

  // ── Cache interaction patterns ──
  {
    name: "startOf day after setter [reused]",
    run: () => {
      const a = moment("2024-06-15 10:30:00"), b = mmntjs("2024-06-15 10:30:00");
      return [
        () => { a.hour(5); a.startOf("day"); },
        () => { b.hour(5); b.startOf("day"); },
      ];
    },
  },
  {
    name: "startOf day (no-op boundary) [reused]",
    run: () => {
      const a = moment(new Date(2024, 0, 15, 0, 0, 0, 0));
      const b = mmntjs(new Date(2024, 0, 15, 0, 0, 0, 0));
      return [() => a.startOf("day"), () => b.startOf("day")];
    },
  },

  // ── Clone ──
  {
    name: "clone [reused]",
    run: () => {
      const a = moment("2024-06-15"), b = mmntjs("2024-06-15");
      return [() => b.clone(), () => a.clone()];
    },
  },
  {
    name: "clone + format [reused]",
    run: () => {
      const a = moment("2024-06-15"), b = mmntjs("2024-06-15");
      return [
        () => b.clone().format("YYYY-MM-DD"),
        () => a.clone().format("YYYY-MM-DD"),
      ];
    },
  },

  // ── Duration ──
  {
    name: "duration(ms) constr [fresh]",
    run: () => [
      () => mmntjs.duration(15000),
      () => moment.duration(15000),
    ],
  },
  {
    name: "duration(7,'days') [fresh]",
    run: () => [
      () => mmntjs.duration(7, "days"),
      () => moment.duration(7, "days"),
    ],
  },

  // ── subtract + chain ──
  {
    name: "subtract(7,'days').add(1,'month') [fresh]",
    run: () => [
      () => mmntjs("2024-06-15").subtract(7, "days").add(1, "month"),
      () => moment("2024-06-15").subtract(7, "days").add(1, "month"),
    ],
  },

  // ── isBetween ──
  {
    name: "isBetween (3 calls) [reused]",
    run: () => {
      const a = moment("2024-06-15"), b = mmntjs("2024-06-15");
      const c = moment("2024-01-01"), d = mmntjs("2024-01-01");
      const e = moment("2024-12-31"), f = mmntjs("2024-12-31");
      return [
        () => { b.isBetween(d, f); b.isBetween(d, f, "month"); b.isBetween(d, f, undefined, "()"); },
        () => { a.isBetween(c, e); a.isBetween(c, e, "month"); a.isBetween(c, e, undefined, "()"); },
      ];
    },
  },

  // ── daysInMonth / isLeapYear ──
  {
    name: "daysInMonth + isLeapYear [reused]",
    run: () => {
      const a = moment("2024-06-15"), b = mmntjs("2024-06-15");
      return [
        () => { b.daysInMonth(); b.isLeapYear(); },
        () => { a.daysInMonth(); a.isLeapYear(); },
      ];
    },
  },
];

// ─────────────────────────────────────────────────────────
// Run
// ─────────────────────────────────────────────────────────

const HEADER = "Developer Microbenchmarks";
const SEP = "=".repeat(HEADER.length);

console.log(HEADER);
console.log(SEP);
console.log("");
console.log("Internal code path diagnostics — NOT representative of real-world usage.");
console.log("For developer optimization work only.");
console.log("");

console.log(
  "Operation                              mmntjs     moment    ratio",
);

for (const c of CASES) {
  const runsM2: number[] = [];
  const runsMom: number[] = [];
  for (let r = 0; r < WARM_RUNS; r++) {
    const [fnM2, fnMom] = c.run();
    runsM2.push(run(fnM2, ITERATIONS, WARMUP));
    runsMom.push(run(fnMom, ITERATIONS, WARMUP));
  }
  runsM2.sort((a, b) => a - b);
  runsMom.sort((a, b) => a - b);
  const statsM2: BenchStats = {
    median: runsM2[Math.floor(WARM_RUNS / 2)],
    min: runsM2[0],
    max: runsM2[WARM_RUNS - 1],
  };
  const statsMom: BenchStats = {
    median: runsMom[Math.floor(WARM_RUNS / 2)],
    min: runsMom[0],
    max: runsMom[WARM_RUNS - 1],
  };
  const ratio = ((statsM2.median / statsMom.median) * 100).toFixed(1);
  const verb = Number(ratio) <= 100
    ? `  ${(100 / Number(ratio)).toFixed(1)}x faster`
    : `  ${(Number(ratio) / 100).toFixed(1)}x slower`;

  console.log(
    `${c.name.padEnd(42)} ${micros(statsM2.median).padStart(10)} ${micros(statsMom.median).padStart(10)} ${verb}`,
  );
}

console.log("");
console.log(`% = mmntjs / moment x 100. Lower = mmntjs faster.`);
