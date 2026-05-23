import mmntjs from "mmntjs";
import moment from "../moment/moment.js";
import { run, runCold, micros, ratioLabel, fmtRatio, COLD_RUNS, WARM_RUNS, ITERATIONS, WARMUP, type BenchStats } from "./lib/harness";

// ─────────────────────────────────────────────────────────
// Public-facing table: representative operations only.
//   - Read-only ops reuse a shared instance (format, getters,
//     valueOf, diff, comparison).
//   - Mutating ops (add, subtract, setters, startOf, endOf)
//     create a fresh object per iteration to avoid accumulated
//     state bias.
// ─────────────────────────────────────────────────────────

const PUBLIC: { name: string; run: () => [() => void, () => void] }[] = [
  // ── CREATE ──
  {
    name: "moment()",
    run: () => [() => moment(), () => mmntjs()],
  },
  {
    name: "moment(Date)",
    run: () => {
      const d = new Date();
      return [() => moment(d), () => mmntjs(d)];
    },
  },
  {
    name: "moment('ISO string')",
    run: () => [() => moment("2024-01-15T10:30:45.123Z"), () => mmntjs("2024-01-15T10:30:45.123Z")],
  },

  // ── FORMAT ──
  {
    name: "format('YYYY-MM-DD')",
    run: () => {
      const a = moment("2024-06-15"), b = mmntjs("2024-06-15");
      return [() => a.format("YYYY-MM-DD"), () => b.format("YYYY-MM-DD")];
    },
  },
  {
    name: "format('HH:mm:ss')",
    run: () => {
      const a = moment("2024-06-15 10:30:45"), b = mmntjs("2024-06-15 10:30:45");
      return [() => a.format("HH:mm:ss"), () => b.format("HH:mm:ss")];
    },
  },
  {
    name: "format('LL')",
    run: () => {
      const a = moment("2024-06-15"), b = mmntjs("2024-06-15");
      return [() => a.format("LL"), () => b.format("LL")];
    },
  },

  // ── MUTATE (fresh object per iteration) ──
  {
    name: "add(1,'day')",
    run: () => [() => moment("2024-06-15").add(1, "day"), () => mmntjs("2024-06-15").add(1, "day")],
  },
  {
    name: "add(1,'month')",
    run: () => [() => moment("2024-06-15").add(1, "month"), () => mmntjs("2024-06-15").add(1, "month")],
  },
  {
    name: "startOf('day')",
    run: () => [() => moment("2024-06-15").startOf("day"), () => mmntjs("2024-06-15").startOf("day")],
  },
  {
    name: "startOf('month')",
    run: () => [() => moment("2024-06-15").startOf("month"), () => mmntjs("2024-06-15").startOf("month")],
  },

  // ── COMPARE (read-only, may reuse) ──
  {
    name: "diff('days')",
    run: () => {
      const a = moment("2024-06-15"), b = mmntjs("2024-06-15");
      const c = moment("2024-07-01"), d = mmntjs("2024-07-01");
      return [() => a.diff(c, "days"), () => b.diff(d, "days")];
    },
  },
  {
    name: "diff('months')",
    run: () => {
      const a = moment("2024-01-15"), b = mmntjs("2024-01-15");
      const c = moment("2024-12-01"), d = mmntjs("2024-12-01");
      return [() => a.diff(c, "months"), () => b.diff(d, "months")];
    },
  },
  {
    name: "isBefore / isAfter / isSame",
    run: () => {
      const a = moment("2024-06-15"), b = mmntjs("2024-06-15");
      const c = moment("2024-07-01"), d = mmntjs("2024-07-01");
      return [
        () => { a.isBefore(c); a.isAfter(c); a.isSame(c); },
        () => { b.isBefore(d); b.isAfter(d); b.isSame(d); },
      ];
    },
  },

  // ── CHAIN (mutating, fresh object) ──
  {
    name: "startOf('month').endOf('month')",
    run: () => [
      () => { moment("2024-06-15").startOf("month").endOf("month"); },
      () => { mmntjs("2024-06-15").startOf("month").endOf("month"); },
    ],
  },
];

// ─────────────────────────────────────────────────────────
// Detailed appendix: all remaining operations.
// Same fresh-object discipline for mutating ops.
// ─────────────────────────────────────────────────────────

const DETAILED: { name: string; run: () => [() => void, () => void] }[] = [
  {
    name: "moment([y,M,d])",
    run: () => [() => moment([2024, 0, 15]), () => mmntjs([2024, 0, 15])],
  },
  {
    name: "moment([y,M,d,h,m,s,ms])",
    run: () => [
      () => moment([2024, 0, 15, 10, 30, 45, 123]),
      () => mmntjs([2024, 0, 15, 10, 30, 45, 123]),
    ],
  },
  {
    name: "format('dddd, MMMM Do YYYY, h:mm:ss a')",
    run: () => {
      const a = moment("2024-06-15"), b = mmntjs("2024-06-15");
      return [
        () => a.format("dddd, MMMM Do YYYY, h:mm:ss a"),
        () => b.format("dddd, MMMM Do YYYY, h:mm:ss a"),
      ];
    },
  },
  {
    name: "getters (y+M+d+H+m+s+ms)",
    run: () => {
      const a = moment("2024-06-15 10:30:45.123"), b = mmntjs("2024-06-15 10:30:45.123");
      return [
        () => { a.year(); a.month(); a.date(); a.hour(); a.minute(); a.second(); a.millisecond(); },
        () => { b.year(); b.month(); b.date(); b.hour(); b.minute(); b.second(); b.millisecond(); },
      ];
    },
  },
  {
    name: "setters (year+month+date) [fresh]",
    run: () => [
      () => { const m = moment("2024-06-15"); m.year(2020); m.month(0); m.date(1); },
      () => { const m = mmntjs("2024-06-15"); m.year(2020); m.month(0); m.date(1); },
    ],
  },
  {
    name: "subtract(7,'days').add(1,'month') [fresh]",
    run: () => [
      () => moment("2024-06-15").subtract(7, "days").add(1, "month"),
      () => mmntjs("2024-06-15").subtract(7, "days").add(1, "month"),
    ],
  },
  {
    name: "isBetween",
    run: () => {
      const a = moment("2024-06-15"), b = mmntjs("2024-06-15");
      const c = moment("2024-01-01"), d = mmntjs("2024-01-01");
      const e = moment("2024-12-31"), f = mmntjs("2024-12-31");
      return [
        () => { a.isBetween(c, e); a.isBetween(c, e, "month"); a.isBetween(c, e, undefined, "()"); },
        () => { b.isBetween(d, f); b.isBetween(d, f, "month"); b.isBetween(d, f, undefined, "()"); },
      ];
    },
  },
  {
    name: "startOf('week').startOf('year') [fresh]",
    run: () => [
      () => moment("2024-06-15").startOf("week").startOf("year"),
      () => mmntjs("2024-06-15").startOf("week").startOf("year"),
    ],
  },
  {
    name: "clone",
    run: () => {
      const a = moment("2024-06-15"), b = mmntjs("2024-06-15");
      return [() => a.clone(), () => b.clone()];
    },
  },
  {
    name: "moment.duration(12345)",
    run: () => [() => moment.duration(12345), () => mmntjs.duration(12345)],
  },
  {
    name: "moment.duration(7,'days')",
    run: () => [() => moment.duration(7, "days"), () => mmntjs.duration(7, "days")],
  },
  {
    name: "valueOf / unix",
    run: () => {
      const a = moment("2024-06-15"), b = mmntjs("2024-06-15");
      return [
        () => { a.valueOf(); a.unix(); },
        () => { b.valueOf(); b.unix(); },
      ];
    },
  },
  {
    name: "daysInMonth / isLeapYear",
    run: () => {
      const a = moment("2024-06-15"), b = mmntjs("2024-06-15");
      return [
        () => { a.daysInMonth(); a.isLeapYear(); },
        () => { b.daysInMonth(); b.isLeapYear(); },
      ];
    },
  },
  {
    name: "startOf('year') [fresh]",
    run: () => [
      () => moment("2024-06-15").startOf("year"),
      () => mmntjs("2024-06-15").startOf("year"),
    ],
  },
  {
    name: "endOf('year') [fresh]",
    run: () => [
      () => moment("2024-06-15").endOf("year"),
      () => mmntjs("2024-06-15").endOf("year"),
    ],
  },
  {
    name: "moment('ISO string') with format",
    run: () => [
      () => moment("2024-01-15T10:30:45.123Z", "YYYY-MM-DDTHH:mm:ss.SSSZ"),
      () => mmntjs("2024-01-15T10:30:45.123Z", "YYYY-MM-DDTHH:mm:ss.SSSZ"),
    ],
  },
  {
    name: "moment.utc('ISO string')",
    run: () => [() => moment.utc("2024-01-15"), () => mmntjs.utc("2024-01-15")],
  },
  {
    name: "add(1,'year') [fresh]",
    run: () => [
      () => moment("2024-06-15").add(1, "year"),
      () => mmntjs("2024-06-15").add(1, "year"),
    ],
  },
];

// ── Cold-path setters & startOf (first-call diagnostic) ──

const COLD_DIAG: { name: string; run: () => [() => void, () => void] }[] = [
  {
    name: "startOf('day') UTC",
    run: () => [() => moment.utc("2024-06-15").startOf("day"), () => mmntjs.utc("2024-06-15").startOf("day")],
  },
  {
    name: "startOf('day') local",
    run: () => [() => moment("2024-06-15").startOf("day"), () => mmntjs("2024-06-15").startOf("day")],
  },
  {
    name: "set year UTC [fresh]",
    run: () => [
      () => { moment.utc("2024-06-15").year(2020); },
      () => { mmntjs.utc("2024-06-15").year(2020); },
    ],
  },
  {
    name: "set year local D<=28 [fresh]",
    run: () => [
      () => { moment("2024-06-15").year(2020); },
      () => { mmntjs("2024-06-15").year(2020); },
    ],
  },
  {
    name: "set year local D>28 (Jan31→Feb) [fresh]",
    run: () => [
      () => { moment("2024-01-31").year(2023); },
      () => { mmntjs("2024-01-31").year(2023); },
    ],
  },
  {
    name: "set month UTC [fresh]",
    run: () => [
      () => { moment.utc("2024-06-15").month(0); },
      () => { mmntjs.utc("2024-06-15").month(0); },
    ],
  },
  {
    name: "set month local D<=28 [fresh]",
    run: () => [
      () => { moment("2024-06-15").month(0); },
      () => { mmntjs("2024-06-15").month(0); },
    ],
  },
  {
    name: "set date D<=28 UTC [fresh]",
    run: () => [
      () => { moment.utc("2024-06-15").date(15); },
      () => { mmntjs.utc("2024-06-15").date(15); },
    ],
  },
  {
    name: "set date D<=28 local [fresh]",
    run: () => [
      () => { moment("2024-06-15").date(15); },
      () => { mmntjs("2024-06-15").date(15); },
    ],
  },
  {
    name: "set date D>28 UTC [fresh]",
    run: () => [
      () => { moment.utc("2024-01-31").date(31); },
      () => { mmntjs.utc("2024-01-31").date(31); },
    ],
  },
  {
    name: "set date D>28 local [fresh]",
    run: () => [
      () => { moment("2024-01-31").date(31); },
      () => { mmntjs("2024-01-31").date(31); },
    ],
  },
  {
    name: "set hour UTC (p.d hot) [fresh]",
    run: () => [
      () => { moment.utc("2024-06-15").hour(12); },
      () => { mmntjs.utc("2024-06-15").hour(12); },
    ],
  },
  {
    name: "set hour local (p.d hot) [fresh]",
    run: () => [
      () => { moment("2024-06-15").hour(12); },
      () => { mmntjs("2024-06-15").hour(12); },
    ],
  },
  {
    name: "chained y+M+d (3 setters) local [fresh]",
    run: () => [
      () => { moment("2024-06-15").year(2020).month(0).date(1); },
      () => { mmntjs("2024-06-15").year(2020).month(0).date(1); },
    ],
  },
  {
    name: "chained y+M+d+H+m+s (6 setters) local [fresh]",
    run: () => [
      () => moment("2024-06-15 10:30:45").year(2020).month(0).date(1).hour(0).minute(0).second(0),
      () => mmntjs("2024-06-15 10:30:45").year(2020).month(0).date(1).hour(0).minute(0).second(0),
    ],
  },
];

// ─────────────────────────────────────────────────────────
// Warm measurement
// ─────────────────────────────────────────────────────────

function warmSection(
  label: string,
  cases: { name: string; run: () => [() => void, () => void] }[],
) {
  console.log(`\n--- ${label} ---`);
  for (const c of cases) {
    const runsA: number[] = [];
    const runsB: number[] = [];
    for (let r = 0; r < WARM_RUNS; r++) {
      const [fnA, fnB] = c.run();
      runsA.push(run(fnA, ITERATIONS, WARMUP));
      runsB.push(run(fnB, ITERATIONS, WARMUP));
    }
    runsA.sort((a, b) => a - b);
    runsB.sort((a, b) => a - b);
    const statsA: BenchStats = {
      median: runsA[Math.floor(WARM_RUNS / 2)],
      min: runsA[0],
      max: runsA[WARM_RUNS - 1],
    };
    const statsB: BenchStats = {
      median: runsB[Math.floor(WARM_RUNS / 2)],
      min: runsB[0],
      max: runsB[WARM_RUNS - 1],
    };
    const r = ratioLabel(statsA, statsB);
    console.log(
      `${c.name.padEnd(42)} ${micros(statsA.median).padStart(11)} ${micros(statsB.median).padStart(11)} ${r.padStart(8)}%`,
    );
  }
}

// ─────────────────────────────────────────────────────────
// First-call (cold) measurement
// ─────────────────────────────────────────────────────────

function coldSection(
  label: string,
  cases: { name: string; run: () => [() => void, () => void] }[],
) {
  console.log(`\n--- ${label} (first-call latency) ---`);
  for (const c of cases) {
    const runsA: number[] = [];
    const runsB: number[] = [];
    for (let r = 0; r < COLD_RUNS; r++) {
      const [fnA, fnB] = c.run();
      runsA.push(runCold(fnA));
      runsB.push(runCold(fnB));
    }
    runsA.sort((a, b) => a - b);
    runsB.sort((a, b) => a - b);
    const statsA: BenchStats = {
      median: runsA[Math.floor(COLD_RUNS / 2)],
      min: runsA[0],
      max: runsA[COLD_RUNS - 1],
    };
    const statsB: BenchStats = {
      median: runsB[Math.floor(COLD_RUNS / 2)],
      min: runsB[0],
      max: runsB[COLD_RUNS - 1],
    };
    const r = ratioLabel(statsA, statsB);
    console.log(
      `${c.name.padEnd(42)} ${micros(statsA.median).padStart(11)} ${micros(statsB.median).padStart(11)} ${r.padStart(8)}%`,
    );
  }
}

// ── Main ──

console.log("mmntjs vs moment.js — Benchmark");
console.log("================================");

console.log(`\nPublic table (${WARM_RUNS} runs x ${ITERATIONS} iters, warm; ~ = noisy)`);
console.log("mmntjs vs moment.js — semantically equivalent operations.");
console.log("Mutating ops use fresh objects per iteration.");
console.log("");
console.log(
  "Operation                              mmntjs       moment    ratio",
);
for (const c of PUBLIC) {
  const runsM2: number[] = [];
  const runsMom: number[] = [];
  for (let r = 0; r < WARM_RUNS; r++) {
    const [fnMom, fnM2] = c.run();
    runsMom.push(run(fnMom, ITERATIONS, WARMUP));
    runsM2.push(run(fnM2, ITERATIONS, WARMUP));
  }
  runsMom.sort((a, b) => a - b);
  runsM2.sort((a, b) => a - b);
  const statsMom: BenchStats = {
    median: runsMom[Math.floor(WARM_RUNS / 2)],
    min: runsMom[0],
    max: runsMom[WARM_RUNS - 1],
  };
  const statsM2: BenchStats = {
    median: runsM2[Math.floor(WARM_RUNS / 2)],
    min: runsM2[0],
    max: runsM2[WARM_RUNS - 1],
  };
  const ratio = ((statsM2.median / statsMom.median) * 100).toFixed(1);
  const verb = Number(ratio) <= 100
    ? `  ${(100 / Number(ratio)).toFixed(1)}x faster`
    : `  ${(Number(ratio) / 100).toFixed(1)}x slower`;
  console.log(
    `${c.name.padEnd(35)} ${micros(statsM2.median).padStart(10)} ${micros(statsMom.median).padStart(10)} ${verb}`,
  );
}

console.log(`\n% = mmntjs / moment x 100. Lower = mmntjs faster.`);
console.log(`"~" prefix marks noisy short runs (median < 100ns or spread > 25%).`);

warmSection("Detailed appendix — warm", DETAILED);
warmSection("Cold-path diagnostics — warm", COLD_DIAG);

coldSection("Detailed appendix — first-call", DETAILED);
coldSection("Cold-path setters & startOf — first-call", COLD_DIAG);
