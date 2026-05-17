/* oxlint-disable no-explicit-any */
import _moment from "mmntjs";
import { installTimezone } from "../src/install";
import { BUILTIN_TZDATA } from "../src/builtin-data.generated";
import _momentTimezone from "moment-timezone";

installTimezone(_moment as any, BUILTIN_TZDATA);

const moment = _moment as any;
const momentTimezone = _momentTimezone as any;

/* ------------------------------------------------------------------ */
/*  Benchmark helpers                                                  */
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

/* ------------------------------------------------------------------ */
/*  Shared data                                                       */
/* ------------------------------------------------------------------ */

const TS = Date.UTC(2024, 5, 15, 12, 30, 45, 123);
const WALL_STR = "2024-01-15 12:34:56";
const WALL_SUMMER = "2024-06-15 12:34:56";

/* ------------------------------------------------------------------ */
/*  Benchmark cases                                                    */
/* ------------------------------------------------------------------ */

interface BenchCase {
  name: string;
  mmntjs: () => void;
  momentTz: () => void;
}

const ZONES = ["Asia/Tokyo", "America/New_York", "Europe/London", "Europe/Berlin"];

const CASES: BenchCase[] = [
  // 1. Convert existing instant to zone
  ...ZONES.map((zone) => ({
    name: `moment.utc(ts).tz("${zone}")`,
    mmntjs: () => moment.utc(TS).tz(zone),
    momentTz: () => momentTimezone.utc(TS).tz(zone),
  })),

  // 2. Parse wall-clock in zone
  {
    name: `moment.tz("${WALL_STR}", "Asia/Tokyo")`,
    mmntjs: () => moment.tz(WALL_STR, "Asia/Tokyo"),
    momentTz: () => momentTimezone.tz(WALL_STR, "Asia/Tokyo"),
  },
  {
    name: `moment.tz("${WALL_STR}", "America/New_York")`,
    mmntjs: () => moment.tz(WALL_STR, "America/New_York"),
    momentTz: () => momentTimezone.tz(WALL_STR, "America/New_York"),
  },
  {
    name: `moment.tz("${WALL_SUMMER}", "America/New_York")`,
    mmntjs: () => moment.tz(WALL_SUMMER, "America/New_York"),
    momentTz: () => momentTimezone.tz(WALL_SUMMER, "America/New_York"),
  },

  // 3. DST boundary
  {
    name: 'moment.tz("2012-03-11 02:30:00", "America/New_York")',
    mmntjs: () => moment.tz("2012-03-11 02:30:00", "America/New_York"),
    momentTz: () => momentTimezone.tz("2012-03-11 02:30:00", "America/New_York"),
  },
  {
    name: 'moment.tz("2012-11-04 01:30:00", "America/New_York")',
    mmntjs: () => moment.tz("2012-11-04 01:30:00", "America/New_York"),
    momentTz: () => momentTimezone.tz("2012-11-04 01:30:00", "America/New_York"),
  },

  // 4. Zone object
  {
    name: 'moment.tz.zone("America/New_York")',
    mmntjs: () => moment.tz.zone("America/New_York"),
    momentTz: () => momentTimezone.tz.zone("America/New_York"),
  },
  {
    name: "zone.offset(ts)",
    mmntjs: () => {
      const z = moment.tz.zone("America/New_York");
      z.offset(TS);
    },
    momentTz: () => {
      const z = momentTimezone.tz.zone("America/New_York");
      z.offset(TS);
    },
  },
  {
    name: "zone.abbr(ts)",
    mmntjs: () => {
      const z = moment.tz.zone("America/New_York");
      z.abbr(TS);
    },
    momentTz: () => {
      const z = momentTimezone.tz.zone("America/New_York");
      z.abbr(TS);
    },
  },

  // 5. Format with timezone
  {
    name: 'tz("Europe/Berlin").format("YYYY-MM-DDTHH:mm:ss.SSSZ")',
    mmntjs: () => moment.utc(TS).tz("Europe/Berlin").format("YYYY-MM-DDTHH:mm:ss.SSSZ"),
    momentTz: () => momentTimezone.utc(TS).tz("Europe/Berlin").format("YYYY-MM-DDTHH:mm:ss.SSSZ"),
  },
  {
    name: 'tz("Europe/Berlin").format("z")',
    mmntjs: () => moment.utc(TS).tz("Europe/Berlin").format("z"),
    momentTz: () => momentTimezone.utc(TS).tz("Europe/Berlin").format("z"),
  },
  {
    name: 'tz("Europe/Berlin").format("YYYY-MM-DD HH:mm:ss z")',
    mmntjs: () => moment.utc(TS).tz("Europe/Berlin").format("YYYY-MM-DD HH:mm:ss z"),
    momentTz: () => momentTimezone.utc(TS).tz("Europe/Berlin").format("YYYY-MM-DD HH:mm:ss z"),
  },

  // Self-regression baseline — convert to fixed zones
  {
    name: 'moment.utc(ts).tz("UTC")',
    mmntjs: () => moment.utc(TS).tz("UTC"),
    momentTz: () => momentTimezone.utc(TS).tz("UTC"),
  },
  {
    name: 'moment.utc(ts).tz("Asia/Kolkata")',
    mmntjs: () => moment.utc(TS).tz("Asia/Kolkata"),
    momentTz: () => momentTimezone.utc(TS).tz("Asia/Kolkata"),
  },
];

/* ------------------------------------------------------------------ */
/*  Main                                                              */
/* ------------------------------------------------------------------ */

const WARM_ITER = 2000;
const WARM_RUNS = 7;

console.log("\ntimezone benchmark (warm, median of 7 runs x 2000 iter each):\n");
console.log(
  "Operation".padEnd(55) + "mmntjs-tz".padStart(12) + "moment-tz".padStart(12) + "  %".padStart(7),
);

for (const c of CASES) {
  const mmntjsRuns: number[] = [];
  const momentTzRuns: number[] = [];

  for (let r = 0; r < WARM_RUNS; r++) {
    mmntjsRuns.push(run(c.mmntjs, WARM_ITER));
    momentTzRuns.push(run(c.momentTz, WARM_ITER));
  }

  mmntjsRuns.sort((a, b) => a - b);
  momentTzRuns.sort((a, b) => a - b);

  const mmMed = mmntjsRuns[Math.floor(WARM_RUNS / 2)];
  const mtMed = momentTzRuns[Math.floor(WARM_RUNS / 2)];

  const ratio = mtMed === 0 ? "  N/A" : `${((mmMed / mtMed) * 100).toFixed(1)}%`.padStart(7);

  console.log(
    `${c.name.padEnd(55)} ${micros(mmMed).padStart(10)} ${micros(mtMed).padStart(10)}  ${ratio}`,
  );
}
