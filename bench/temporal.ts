import mmntjs from "../dist/index.js";

// Helper functions inlined for Node compatibility (no TS loader needed).
function micros(ns: number): string {
  if (ns < 1000) return `${ns.toFixed(0)}ns`;
  if (ns < 1_000_000) return `${(ns / 1000).toFixed(2)}\u00B5s`;
  return `${(ns / 1_000_000).toFixed(3)}ms`;
}

function run(fn: () => void, iterations: number, warmup = 1000): number {
  for (let i = 0; i < warmup; i++) fn();
  const start = process.hrtime.bigint();
  for (let i = 0; i < iterations; i++) fn();
  const end = process.hrtime.bigint();
  return Number(end - start) / iterations;
}

interface BenchStats { median: number; min: number; max: number }

const WARM_RUNS = 5;
const ITERATIONS = 5000;
const WARMUP = 1000;

// ─────────────────────────────────────────────────────────
// mmntjs vs Temporal
//
// Temporal prioritizes immutable correctness and semantic
// richness.  Every Temporal operation creates new objects;
// mmntjs mutates in-place.  This comparison is informative,
// not adversarial.
//
// A) PlainDateTime — civil arithmetic (no timezone)
// B) ZonedDateTime — timezone semantics (if available)
//
// NOT compared:
//   - mutable chain semantics (no Temporal equivalent)
//   - locale formatting (Temporal uses Intl)
//   - clone (immutable by design)
// ─────────────────────────────────────────────────────────

type BenchCase = { name: string; run: () => [() => void, () => void] };

// Lazy Temporal accessor — Temporal may not exist in all runtimes.
function getTemporal(): typeof Temporal {
  const T = (globalThis as unknown as { Temporal?: typeof Temporal }).Temporal;
  if (!T) throw new Error("Temporal API not available (need Node 26+ or polyfill)");
  return T;
}

// ── Shared fixtures ──
const ISO_DATE = "2024-06-15";
const ISO_DT = "2024-06-15T10:30:00";
const dateA = new Date(2024, 5, 15);
const dateB = new Date(2024, 7, 1);

// ─────────────────────────────────────────────────────────
// A) PlainDateTime (civil arithmetic)
// ─────────────────────────────────────────────────────────

const PLAIN_DT_CASES: BenchCase[] = [
  // CREATE
  {
    name: "now (create)",
    run: () => {
      const T = getTemporal();
      return [() => mmntjs(), () => T.Now.plainDateTimeISO()];
    },
  },
  {
    name: "parse date-only ISO",
    run: () => {
      const T = getTemporal();
      return [() => mmntjs(ISO_DATE), () => T.PlainDate.from(ISO_DATE)];
    },
  },
  {
    name: "parse datetime ISO",
    run: () => {
      const T = getTemporal();
      return [() => mmntjs(ISO_DT), () => T.PlainDateTime.from(ISO_DT)];
    },
  },
  {
    name: "parse [y,M,d]",
    run: () => {
      const T = getTemporal();
      return [() => mmntjs([2024, 5, 15]), () => new T.PlainDate(2024, 6, 15)];
    },
  },

  // GETTERS
  {
    name: "get year",
    run: () => {
      const T = getTemporal();
      const m = mmntjs(dateA);
      const pd = new T.PlainDate(2024, 6, 15);
      return [() => m.year(), () => pd.year];
    },
  },
  {
    name: "get year+month+day (3 reads)",
    run: () => {
      const T = getTemporal();
      const m = mmntjs(dateA);
      const pd = new T.PlainDate(2024, 6, 15);
      return [
        () => { m.year(); m.month(); m.date(); },
        () => { pd.year; pd.month; pd.day; },
      ];
    },
  },

  // ADD (immutable for Temporal, mutable for mmntjs)
  {
    name: "add 1 day",
    run: () => {
      const T = getTemporal();
      let pd: any = new T.PlainDateTime(2024, 6, 15, 10, 30, 0, 0);
      return [
        () => mmntjs(dateA).add(1, "day"),
        () => { pd = pd.add({ days: 1 }); },
      ];
    },
  },
  {
    name: "add 1 month",
    run: () => {
      const T = getTemporal();
      let pd: any = new T.PlainDateTime(2024, 6, 15, 10, 30, 0, 0);
      return [
        () => mmntjs(dateA).add(1, "month"),
        () => { pd = pd.add({ months: 1 }); },
      ];
    },
  },
  {
    name: "add 1 day (immutable both)",
    run: () => {
      const T = getTemporal();
      let pd: any = new T.PlainDateTime(2024, 6, 15, 10, 30, 0, 0);
      return [
        () => mmntjs(dateA).clone().add(1, "day"),
        () => { pd = pd.add({ days: 1 }); },
      ];
    },
  },

  // DIFF
  {
    name: "diff in days",
    run: () => {
      const T = getTemporal();
      const m = mmntjs(dateA);
      const mB = mmntjs(dateB);
      const pa: any = new T.PlainDateTime(2024, 6, 15, 0, 0, 0, 0);
      const pb: any = new T.PlainDateTime(2024, 8, 1, 0, 0, 0, 0);
      return [() => m.diff(mB, "days"), () => pa.since(pb).days];
    },
  },

  // STRINGIFY
  {
    name: "toISOString",
    run: () => {
      const T = getTemporal();
      const m = mmntjs("2024-06-15T10:30:00");
      const pd: any = new T.PlainDateTime(2024, 6, 15, 10, 30, 0, 0);
      return [() => m.toISOString(), () => pd.toString()];
    },
  },

  // startOf equivalent
  {
    name: "startOf month (mut vs immutable)",
    run: () => {
      const T = getTemporal();
      const pd: any = new T.PlainDate(2024, 6, 15);
      return [
        () => mmntjs("2024-06-15").startOf("month"),
        () => pd.with({ day: 1 }),
      ];
    },
  },

  // PROPERTY-LIKE
  {
    name: "daysInMonth (method vs property)",
    run: () => {
      const T = getTemporal();
      const m = mmntjs(dateA);
      const pd: any = new T.PlainDate(2024, 6, 15);
      return [() => m.daysInMonth(), () => pd.daysInMonth];
    },
  },

  // SET (with equivalent)
  {
    name: "set year",
    run: () => {
      const T = getTemporal();
      const pd: any = new T.PlainDate(2024, 6, 15);
      return [
        () => { mmntjs("2024-06-15").year(2020); },
        () => { pd.with({ year: 2020 }); },
      ];
    },
  },
  {
    name: "set month+day",
    run: () => {
      const T = getTemporal();
      const pd: any = new T.PlainDate(2024, 6, 15);
      return [
        () => { mmntjs("2024-06-15").month(0).date(1); },
        () => { pd.with({ month: 1, day: 1 }); },
      ];
    },
  },
];

// ─────────────────────────────────────────────────────────
// B) ZonedDateTime (timezone semantics)
// ─────────────────────────────────────────────────────────

const ZONED_CASES: BenchCase[] = [
  {
    name: "parse ISO to zoned",
    run: () => {
      const T = getTemporal();
      return [
        () => mmntjs("2024-06-15T10:30:00Z"),
        () => T.ZonedDateTime.from("2024-06-15T10:30:00[UTC]"),
      ];
    },
  },
  {
    name: "add 1 day (zoned)",
    run: () => {
      const T = getTemporal();
      let zdt: any = T.ZonedDateTime.from("2024-06-15T10:30:00[America/New_York]");
      return [
        () => mmntjs("2024-06-15 10:30:00").add(1, "day"),
        () => { zdt = zdt.add({ days: 1 }); },
      ];
    },
  },
  {
    name: "startOf day (zoned)",
    run: () => {
      const T = getTemporal();
      let zdt: any = T.ZonedDateTime.from("2024-06-15T10:30:00[America/New_York]");
      return [
        () => mmntjs("2024-06-15 10:30:00").startOf("day"),
        () => { zdt = zdt.withPlainTime("00:00"); },
      ];
    },
  },
  {
    name: "get offset string",
    run: () => {
      const T = getTemporal();
      const m = mmntjs("2024-06-15");
      const zdt: any = T.ZonedDateTime.from("2024-06-15T10:30:00[America/New_York]");
      return [() => m.utcOffset(), () => zdt.offset];
    },
  },
];

// ─────────────────────────────────────────────────────────
// Run
// ─────────────────────────────────────────────────────────

function runSection(
  title: string,
  cases: BenchCase[],
) {
  console.log(`\n--- ${title} ---`);
  console.log(
    "Operation                              mmntjs     Temporal    ratio",
  );
  for (const c of cases) {
    const runsM2: number[] = [];
    const runsT: number[] = [];
    for (let r = 0; r < WARM_RUNS; r++) {
      try {
        const [fnM2, fnT] = c.run();
        runsM2.push(run(fnM2, ITERATIONS, WARMUP));
        runsT.push(run(fnT, ITERATIONS, WARMUP));
      } catch {
        // Temporal not available — skip
        return;
      }
    }
    runsM2.sort((a, b) => a - b);
    runsT.sort((a, b) => a - b);
    const statsM2: BenchStats = {
      median: runsM2[Math.floor(WARM_RUNS / 2)],
      min: runsM2[0],
      max: runsM2[WARM_RUNS - 1],
    };
    const statsT: BenchStats = {
      median: runsT[Math.floor(WARM_RUNS / 2)],
      min: runsT[0],
      max: runsT[WARM_RUNS - 1],
    };
    const ratio = statsT.median === 0
      ? "   -  "
      : ((statsT.median / statsM2.median) * 100).toFixed(1);
    const verb = ratio === "   -  " ? "" : (
      Number(ratio) > 100
        ? `  ${(Number(ratio) / 100).toFixed(1)}x faster`
        : `  ${(100 / Number(ratio)).toFixed(1)}x slower`
    );
    console.log(
      `${c.name.padEnd(35)} ${micros(statsM2.median).padStart(10)} ${micros(statsT.median).padStart(10)} ${verb}`,
    );
  }
}

console.log("mmntjs vs Temporal — Benchmark");
console.log("===============================");
console.log("");
console.log("NOTE: Temporal prioritizes immutable correctness and semantic richness.");
console.log("Every Temporal operation creates new objects; mmntjs mutates in-place.");
console.log("This is an informative comparison, not a contest.");
console.log("");

runSection("A) PlainDateTime (civil arithmetic)", PLAIN_DT_CASES);
runSection("B) ZonedDateTime (timezone semantics)", ZONED_CASES);

console.log("");
console.log(`% = Temporal / mmntjs x 100. >100% = mmntjs faster. <100% = Temporal faster.`);
console.log("Requires Node 26+ or @js-temporal/polyfill.");
