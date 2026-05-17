/**
 * Timezone performance comparison: mmntjs-timezone vs moment-timezone vs date-fns-tz vs @date-fns/tz.
 *
 * Semantic notes (do not draw false equivalence):
 * - moment-timezone (mtz) and mmntjs-timezone (mmtz) return timezone-aware Moment wrappers
 * - date-fns-tz (dft) `toZonedTime`/`fromZonedTime` return plain Date objects (weaker API)
 * - date-fns-tz `formatInTimeZone` combines conversion + formatting in one call
 * - @date-fns/tz (adft) `TZDate` is a Date subclass with timezone awareness
 * - None of the date-fns variants support timezone abbreviation lookup or zone objects
 * - "z" format token (abbreviation) is only available in moment-based libs
 *
 * Run: bun packages/timezone/test/bench-compare.ts
 */
/* oxlint-disable no-explicit-any */
import _moment from "mmntjs";
import { installTimezone } from "../src/install";
import { BUILTIN_TZDATA } from "../src/builtin-data.generated";
import _momentTimezone from "moment-timezone";
import {
  toZonedTime as dfToZonedTime,
  fromZonedTime as dfFromZonedTime,
  formatInTimeZone as dfFormatInTimeZone,
  getTimezoneOffset as dfGetTimezoneOffset,
} from "date-fns-tz";
import { TZDate, tzOffset as adftTzOffset } from "@date-fns/tz";
import { format as dfFormat } from "date-fns";

installTimezone(_moment as any, BUILTIN_TZDATA);

const moment = _moment as any;
const momentTimezone = _momentTimezone as any;

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function run(fn: () => void, iterations: number): number {
  for (let i = 0; i < Math.min(iterations, 100); i++) {
    fn();
  }
  const start = process.hrtime.bigint();
  for (let i = 0; i < iterations; i++) {
    fn();
  }
  const end = process.hrtime.bigint();
  return Number(end - start) / iterations;
}

function micros(ns: number): string {
  if (ns < 1000) {
    return `${ns.toFixed(0)}ns`;
  }
  if (ns < 1_000_000) {
    return `${(ns / 1000).toFixed(2)}μs`;
  }
  return `${(ns / 1_000_000).toFixed(3)}ms`;
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
}

/* ------------------------------------------------------------------ */
/*  Shared data                                                        */
/* ------------------------------------------------------------------ */

const TS = Date.UTC(2024, 5, 15, 12, 30, 45, 123);
const TS_WINTER = Date.UTC(2024, 0, 15, 12, 0, 0, 0);
const TS_DST_SPRING = Date.UTC(2024, 2, 10, 6, 59, 59, 0); // just before EST→EDT
const TS_DST_FALL = Date.UTC(2024, 10, 3, 5, 59, 59, 0); // just before EDT→EST
const WALL_STR = "2024-01-15 12:34:56";
const WALL_SPRING = "2024-03-11 02:30:00";
const WALL_FALL = "2024-11-03 01:30:00";
const ISO_FMT = "YYYY-MM-DDTHH:mm:ss.SSSZ";
const DF_ISO_FMT = "yyyy-MM-dd'T'HH:mm:ss.SSSxxx";

/* ------------------------------------------------------------------ */
/*  Library-case builder                                               */
/* ------------------------------------------------------------------ */

interface LibCase {
  label: string;
  cold: () => void;
  warm: () => void;
}

function sample(label: string, fn: () => void): LibCase {
  return {
    label,
    cold: fn,
    warm: fn,
  };
}

/* ------------------------------------------------------------------ */
/*  Benchmark categories                                               */
/* ------------------------------------------------------------------ */

interface BenchGroupCase {
  name: string;
  note?: string;
  cases: LibCase[];
}

const GROUPS: BenchGroupCase[] = [
  // ================================================================
  //  1. Convert instant to timezone
  // ================================================================
  {
    name: "1a. Convert instant → Asia/Tokyo",
    cases: [
      sample("mmntjs-timezone", () => moment.utc(TS).tz("Asia/Tokyo")),
      sample("moment-timezone", () => momentTimezone.utc(TS).tz("Asia/Tokyo")),
      sample("date-fns-tz toZonedTime", () => dfToZonedTime(new Date(TS), "Asia/Tokyo")),
      sample("@date-fns/tz TZDate", () => new TZDate(TS, "Asia/Tokyo")),
    ],
  },
  {
    name: "1b. Convert instant → America/New_York",
    cases: [
      sample("mmntjs-timezone", () => moment.utc(TS).tz("America/New_York")),
      sample("moment-timezone", () => momentTimezone.utc(TS).tz("America/New_York")),
      sample("date-fns-tz toZonedTime", () => dfToZonedTime(new Date(TS), "America/New_York")),
      sample("@date-fns/tz TZDate", () => new TZDate(TS, "America/New_York")),
    ],
  },

  // ================================================================
  //  2. Parse wall-clock in timezone
  // ================================================================
  {
    name: "2a. Parse wall-clock → Asia/Tokyo",
    note: "date-fns-tz fromZonedTime returns plain Date (no zone wrapper). @date-fns/tz uses constructor args.",
    cases: [
      sample("mmntjs-timezone", () => moment.tz(WALL_STR, "Asia/Tokyo")),
      sample("moment-timezone", () => momentTimezone.tz(WALL_STR, "Asia/Tokyo")),
      sample("date-fns-tz fromZonedTime", () => dfFromZonedTime(WALL_STR, "Asia/Tokyo")),
      sample("@date-fns/tz TZDate ctor", () => new TZDate(2024, 0, 15, 12, 34, 56, "Asia/Tokyo")),
    ],
  },
  {
    name: "2b. Parse wall-clock → America/New_York",
    cases: [
      sample("mmntjs-timezone", () => moment.tz(WALL_STR, "America/New_York")),
      sample("moment-timezone", () => momentTimezone.tz(WALL_STR, "America/New_York")),
      sample("date-fns-tz fromZonedTime", () => dfFromZonedTime(WALL_STR, "America/New_York")),
      sample(
        "@date-fns/tz TZDate ctor",
        () => new TZDate(2024, 0, 15, 12, 34, 56, "America/New_York"),
      ),
    ],
  },

  // ================================================================
  //  3. Format with timezone
  // ================================================================
  {
    name: "3a. Format zoned datetime (ISO+offset)",
    note: "date-fns-tz formatInTimeZone combines convert+format in one call, no intermediate object.",
    cases: [
      sample("mmntjs-timezone", () => moment.utc(TS).tz("Europe/Berlin").format(ISO_FMT)),
      sample("moment-timezone", () => momentTimezone.utc(TS).tz("Europe/Berlin").format(ISO_FMT)),
      sample("date-fns-tz formatInTimeZone", () =>
        dfFormatInTimeZone(TS, "Europe/Berlin", DF_ISO_FMT),
      ),
      sample("@date-fns/tz TZDate+format", () =>
        dfFormat(new TZDate(TS, "Europe/Berlin"), DF_ISO_FMT),
      ),
    ],
  },
  {
    name: "3b. Format timezone abbreviation (format 'z')",
    note: "Only moment-based libs support timezone abbreviation lookup. date-fns variants show GMT offset instead.",
    cases: [
      sample("mmntjs-timezone", () => moment.utc(TS).tz("Europe/Berlin").format("z")),
      sample("moment-timezone", () => momentTimezone.utc(TS).tz("Europe/Berlin").format("z")),
    ],
  },
  {
    name: "3c. Format full datetime + abbreviation",
    note: "Only moment-based libs include timezone abbreviation ('z' token).",
    cases: [
      sample("mmntjs-timezone", () =>
        moment.utc(TS).tz("Europe/Berlin").format("YYYY-MM-DD HH:mm:ss z"),
      ),
      sample("moment-timezone", () =>
        momentTimezone.utc(TS).tz("Europe/Berlin").format("YYYY-MM-DD HH:mm:ss z"),
      ),
    ],
  },

  // ================================================================
  //  4. DST boundary
  // ================================================================
  {
    name: "4a. Spring-forward gap parse",
    note: "moment.tz resolves gap to post-transition time. date-fns-tz fromZonedTime may differ.",
    cases: [
      sample("mmntjs-timezone", () => moment.tz(WALL_SPRING, "America/New_York")),
      sample("moment-timezone", () => momentTimezone.tz(WALL_SPRING, "America/New_York")),
      sample("date-fns-tz fromZonedTime", () => dfFromZonedTime(WALL_SPRING, "America/New_York")),
    ],
  },
  {
    name: "4b. Fall-back overlap parse",
    note: "moment.tz picks first occurrence (EDT). date-fns-tz fromZonedTime picks later (EST).",
    cases: [
      sample("mmntjs-timezone", () => moment.tz(WALL_FALL, "America/New_York")),
      sample("moment-timezone", () => momentTimezone.tz(WALL_FALL, "America/New_York")),
      sample("date-fns-tz fromZonedTime", () => dfFromZonedTime(WALL_FALL, "America/New_York")),
    ],
  },

  // ================================================================
  //  5. Repeated hot-loop operations
  // ================================================================
  {
    name: "5a. Repeated same-zone conversion (×20)",
    note: "Tests same-zone cache hit rate.",
    cases: [
      sample("mmntjs-timezone", () => {
        moment.utc(TS).tz("Asia/Tokyo");
        moment.utc(TS).tz("Asia/Tokyo");
        moment.utc(TS).tz("Asia/Tokyo");
        moment.utc(TS).tz("Asia/Tokyo");
        moment.utc(TS).tz("Asia/Tokyo");
      }),
      sample("moment-timezone", () => {
        momentTimezone.utc(TS).tz("Asia/Tokyo");
        momentTimezone.utc(TS).tz("Asia/Tokyo");
        momentTimezone.utc(TS).tz("Asia/Tokyo");
        momentTimezone.utc(TS).tz("Asia/Tokyo");
        momentTimezone.utc(TS).tz("Asia/Tokyo");
      }),
      sample("date-fns-tz toZonedTime", () => {
        dfToZonedTime(new Date(TS), "Asia/Tokyo");
        dfToZonedTime(new Date(TS), "Asia/Tokyo");
        dfToZonedTime(new Date(TS), "Asia/Tokyo");
        dfToZonedTime(new Date(TS), "Asia/Tokyo");
        dfToZonedTime(new Date(TS), "Asia/Tokyo");
      }),
      sample("@date-fns/tz TZDate", () => {
        new TZDate(TS, "Asia/Tokyo");
        new TZDate(TS, "Asia/Tokyo");
        new TZDate(TS, "Asia/Tokyo");
        new TZDate(TS, "Asia/Tokyo");
        new TZDate(TS, "Asia/Tokyo");
      }),
    ],
  },
  {
    name: "5b. Repeated mixed-zone conversion (×20)",
    note: "Tests multi-zone cache behavior.",
    cases: [
      sample("mmntjs-timezone", () => {
        moment.utc(TS).tz("Asia/Tokyo");
        moment.utc(TS).tz("America/New_York");
        moment.utc(TS).tz("Europe/Berlin");
        moment.utc(TS).tz("Asia/Kolkata");
        moment.utc(TS).tz("Pacific/Auckland");
      }),
      sample("moment-timezone", () => {
        momentTimezone.utc(TS).tz("Asia/Tokyo");
        momentTimezone.utc(TS).tz("America/New_York");
        momentTimezone.utc(TS).tz("Europe/Berlin");
        momentTimezone.utc(TS).tz("Asia/Kolkata");
        momentTimezone.utc(TS).tz("Pacific/Auckland");
      }),
      sample("date-fns-tz toZonedTime", () => {
        dfToZonedTime(new Date(TS), "Asia/Tokyo");
        dfToZonedTime(new Date(TS), "America/New_York");
        dfToZonedTime(new Date(TS), "Europe/Berlin");
        dfToZonedTime(new Date(TS), "Asia/Kolkata");
        dfToZonedTime(new Date(TS), "Pacific/Auckland");
      }),
      sample("@date-fns/tz TZDate", () => {
        new TZDate(TS, "Asia/Tokyo");
        new TZDate(TS, "America/New_York");
        new TZDate(TS, "Europe/Berlin");
        new TZDate(TS, "Asia/Kolkata");
        new TZDate(TS, "Pacific/Auckland");
      }),
    ],
  },
  {
    name: "5c. Offset lookup (via zone.offset / getTimezoneOffset / tzOffset)",
    note: "mmtz/mtz return wrapper with methods. dft/adft return plain number.",
    cases: [
      sample("mmntjs-timezone zone.offset", () => {
        const z = moment.tz.zone("America/New_York");
        z.offset(TS);
        z.offset(TS_WINTER);
        z.offset(TS_DST_SPRING);
        z.offset(TS_DST_FALL);
      }),
      sample("moment-timezone zone.offset", () => {
        const z = momentTimezone.tz.zone("America/New_York");
        z.offset(TS);
        z.offset(TS_WINTER);
        z.offset(TS_DST_SPRING);
        z.offset(TS_DST_FALL);
      }),
      sample("date-fns-tz getTimezoneOffset", () => {
        dfGetTimezoneOffset("America/New_York", TS);
        dfGetTimezoneOffset("America/New_York", TS_WINTER);
        dfGetTimezoneOffset("America/New_York", TS_DST_SPRING);
        dfGetTimezoneOffset("America/New_York", TS_DST_FALL);
      }),
      sample("@date-fns/tz tzOffset", () => {
        adftTzOffset("America/New_York", TS);
        adftTzOffset("America/New_York", TS_WINTER);
        adftTzOffset("America/New_York", TS_DST_SPRING);
        adftTzOffset("America/New_York", TS_DST_FALL);
      }),
    ],
  },
  {
    name: "5d. Zone object fetch (moment.tz.zone / IANA name lookup)",
    note: "Only moment-based libs expose zone objects. mmtz caches them. date-fns has no equivalent.",
    cases: [
      sample("mmntjs-timezone", () => {
        moment.tz.zone("America/New_York");
        moment.tz.zone("Asia/Tokyo");
        moment.tz.zone("Europe/Berlin");
        moment.tz.zone("Asia/Kolkata");
        moment.tz.zone("Pacific/Auckland");
      }),
      sample("moment-timezone", () => {
        momentTimezone.tz.zone("America/New_York");
        momentTimezone.tz.zone("Asia/Tokyo");
        momentTimezone.tz.zone("Europe/Berlin");
        momentTimezone.tz.zone("Asia/Kolkata");
        momentTimezone.tz.zone("Pacific/Auckland");
      }),
    ],
  },
];

/* ------------------------------------------------------------------ */
/*  Helpers for cold/warm measurement                                  */
/* ------------------------------------------------------------------ */

/* ------------------------------------------------------------------ */
/*  Warm benchmark                                                     */
/* ------------------------------------------------------------------ */

const WARM_ITER = 2000;
const WARM_RUNS = 7;

function runWarm(): void {
  console.log("\n=== WARM (caches populated, median of 7 runs × 2000 iter) ===\n");

  for (const group of GROUPS) {
    console.log(`\n--- ${group.name} ---`);
    if (group.note) {
      console.log(`  ${group.note}`);
    }
    // Header
    console.log("  Library".padEnd(32) + "  ns/op".padStart(20));

    for (const lib of group.cases) {
      const samples: number[] = [];
      for (let r = 0; r < WARM_RUNS; r++) {
        samples.push(run(lib.warm, WARM_ITER));
      }
      const med = median(samples);
      console.log(`  ${lib.label.padEnd(32)}  ${micros(med).padStart(10)}`);
    }
  }
}

/* ------------------------------------------------------------------ */
/*  Cold benchmark (single call, no pre-warm)                          */
/* ------------------------------------------------------------------ */

const COLD_RUNS = 20;

function runCold(): void {
  console.log("\n=== COLD (first call, median of 20 isolated runs) ===\n");
  console.log("  Note: Cold runs measure first-time cost including Intl formatter construction.");
  console.log("  Each trial starts fresh — no cached Intl formatters from prior runs.\n");

  for (const group of GROUPS) {
    console.log(`\n--- ${group.name} ---`);
    if (group.note) {
      console.log(`  ${group.note}`);
    }
    console.log("  Library".padEnd(32) + "  cold/call".padStart(20));

    for (const lib of group.cases) {
      const samples: number[] = [];
      for (let r = 0; r < COLD_RUNS; r++) {
        // Force fresh state by running in isolation
        const start = process.hrtime.bigint();
        lib.cold();
        const end = process.hrtime.bigint();
        samples.push(Number(end - start));
      }
      const med = median(samples);
      console.log(`  ${lib.label.padEnd(32)}  ${micros(med).padStart(10)}`);
    }
  }
}

/* ------------------------------------------------------------------ */
/*  Self-regression baseline                                           */
/* ------------------------------------------------------------------ */

function runSelfRegression(): void {
  console.log(
    "\n=== SELF-REGRESSION BASELINE (future changes should not slow these hot paths) ===\n",
  );

  const regressionCases: { name: string; fn: () => void }[] = [
    {
      name: "mmtz: utc(ts).tz(Tokyo)",
      fn: () => moment.utc(TS).tz("Asia/Tokyo"),
    },
    {
      name: "mmtz: utc(ts).tz(NY)",
      fn: () => moment.utc(TS).tz("America/New_York"),
    },
    {
      name: "mmtz: parseInZone wall",
      fn: () => moment.tz(WALL_STR, "America/New_York"),
    },
    {
      name: "mmtz: format z",
      fn: () => moment.utc(TS).tz("Europe/Berlin").format("z"),
    },
    {
      name: "mmtz: format full+z",
      fn: () => moment.utc(TS).tz("Europe/Berlin").format("YYYY-MM-DD HH:mm:ss z"),
    },
    {
      name: "mmtz: zone.offset(ts)",
      fn: () => {
        const z = moment.tz.zone("America/New_York");
        z.offset(TS);
      },
    },
    {
      name: "mmtz: zone.abbr(ts)",
      fn: () => {
        const z = moment.tz.zone("America/New_York");
        z.abbr(TS);
      },
    },
    {
      name: "mmtz: zone(name)",
      fn: () => moment.tz.zone("America/New_York"),
    },
    {
      name: "mmtz: repeated same-zone (×5)",
      fn: () => {
        moment.utc(TS).tz("Asia/Tokyo");
        moment.utc(TS).tz("Asia/Tokyo");
        moment.utc(TS).tz("Asia/Tokyo");
        moment.utc(TS).tz("Asia/Tokyo");
        moment.utc(TS).tz("Asia/Tokyo");
      },
    },
  ];

  console.log("  Operation".padEnd(38) + "  ns/op".padStart(20));

  for (const rc of regressionCases) {
    const samples: number[] = [];
    for (let r = 0; r < WARM_RUNS; r++) {
      samples.push(run(rc.fn, WARM_ITER));
    }
    const med = median(samples);
    console.log(`  ${rc.name.padEnd(38)}  ${micros(med).padStart(10)}`);
  }
}

/* ------------------------------------------------------------------ */
/*  Main                                                              */
/* ------------------------------------------------------------------ */

console.log("timezone multi-lib comparison benchmark");
console.log("=".repeat(60));

runWarm();
runCold();
runSelfRegression();

console.log(`\n${"=".repeat(60)}`);
console.log("Semantic notes:");
console.log("  - moment-timezone / mmntjs-timezone return full Moment wrappers with zone info and");
console.log("    abbreviation support. date-fns variants return plain Date or TZDate objects.");
console.log("  - format token 'z' (timezone abbreviation like 'EST'/'CEST') is moment-only.");
console.log("  - date-fns-tz formatInTimeZone uses 'O'/'xxx' tokens (GMT+2 / +02:00).");
console.log(
  "  - DST overlap: moment.tz picks first occurrence (EDT). fromZonedTime picks last (EST).",
);
console.log(
  "  - DST gap: moment.tz adjusts forward. fromZonedTime may return a different instant.",
);
console.log("  - Zone object (zone.offset/abbr/name) is moment-only. No date-fns equivalent.");
console.log("\n  Run with: bun packages/timezone/test/bench-compare.ts");
