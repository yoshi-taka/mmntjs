// ─────────────────────────────────────────────────────────
// mmntjs/fns vs date-fns
//
// Both operate on plain Date objects (no wrapper overhead).
// This is an apples-to-apples comparison of Date utility
// functions.
// ─────────────────────────────────────────────────────────
import {
  format,
  parseISO,
  addDays,
  addMonths,
  addYears,
  startOfDay,
  startOfMonth,
  endOfMonth,
  differenceInDays,
  differenceInMonths,
  daysInMonth,
  isLeapYear,
  dayOfYear,
  quarter,
  setYear,
  setMonth,
  setDate,
  setHours,
  setMinutes,
  setSeconds,
  setMilliseconds,
} from "../src/fns";

import * as df from "date-fns";
import { run, micros, ratioLabel, ITERATIONS, WARMUP } from "./lib/harness";

type BenchCase = { name: string; run: () => [() => void, () => void] };

const d = new Date(2024, 5, 15, 10, 30, 45, 123);
const d2 = new Date(2024, 0, 1);

const CASES: BenchCase[] = [
  // ── CREATE ──
  {
    name: "parse ISO string",
    run: () => [
      () => parseISO("2024-01-15T10:30:45.123Z"),
      () => df.parseISO("2024-01-15T10:30:45.123Z"),
    ],
  },
  {
    name: "new Date()",
    run: () => [() => new Date(), () => new Date()],
  },

  // ── FORMAT ──
  {
    name: "format YYYY-MM-DD",
    run: () => [
      () => format(d, "YYYY-MM-DD"),
      () => df.format(d, "yyyy-MM-dd"),
    ],
  },
  {
    name: "format HH:mm:ss",
    run: () => [
      () => format(d, "HH:mm:ss"),
      () => df.format(d, "HH:mm:ss"),
    ],
  },
  {
    name: "format YYYY-MM-DD HH:mm:ss.SSS",
    run: () => [
      () => format(d, "YYYY-MM-DD HH:mm:ss.SSS"),
      () => df.format(d, "yyyy-MM-dd HH:mm:ss.SSS"),
    ],
  },

  // ── ADD / SUB ──
  {
    name: "addDays +1",
    run: () => [() => addDays(d, 1), () => df.addDays(d, 1)],
  },
  {
    name: "addDays -30",
    run: () => [() => addDays(d, -30), () => df.subDays(d, 30)],
  },
  {
    name: "addMonths +1",
    run: () => [() => addMonths(d, 1), () => df.addMonths(d, 1)],
  },
  {
    name: "addMonths -12",
    run: () => [() => addMonths(d, -12), () => df.subMonths(d, 12)],
  },
  {
    name: "addYears +1",
    run: () => [() => addYears(d, 1), () => df.addYears(d, 1)],
  },

  // ── BOUNDARY ──
  {
    name: "startOfDay",
    run: () => [() => startOfDay(d), () => df.startOfDay(d)],
  },
  {
    name: "startOfMonth",
    run: () => [() => startOfMonth(d), () => df.startOfMonth(d)],
  },
  {
    name: "endOfMonth",
    run: () => [() => endOfMonth(d), () => df.endOfMonth(d)],
  },

  // ── DIFF ──
  {
    name: "differenceInDays",
    run: () => [() => differenceInDays(d, d2), () => df.differenceInCalendarDays(d, d2)],
  },
  {
    name: "differenceInMonths",
    run: () => [() => differenceInMonths(d, d2), () => df.differenceInCalendarMonths(d, d2)],
  },

  // ── CALENDAR HELPERS ──
  {
    name: "daysInMonth",
    run: () => [() => daysInMonth(d), () => df.getDaysInMonth(d)],
  },
  {
    name: "isLeapYear",
    run: () => [() => isLeapYear(d), () => df.isLeapYear(d)],
  },
  {
    name: "dayOfYear",
    run: () => [() => dayOfYear(d), () => df.getDayOfYear(d)],
  },
  {
    name: "quarter",
    run: () => [() => quarter(d), () => df.getQuarter(d)],
  },

  // ── SETTERS ──
  {
    name: "setYear",
    run: () => [() => setYear(d, 2020), () => df.setYear(d, 2020)],
  },
  {
    name: "setMonth",
    run: () => [() => setMonth(d, 0), () => df.setMonth(d, 0)],
  },
  {
    name: "setDate",
    run: () => [() => setDate(d, 1), () => df.setDate(d, 1)],
  },
  {
    name: "setHours",
    run: () => [() => setHours(d, 0), () => df.setHours(d, 0)],
  },
  {
    name: "setMinutes",
    run: () => [() => setMinutes(d, 0), () => df.setMinutes(d, 0)],
  },
  {
    name: "setSeconds",
    run: () => [() => setSeconds(d, 0), () => df.setSeconds(d, 0)],
  },
  {
    name: "setMilliseconds",
    run: () => [() => setMilliseconds(d, 0), () => df.setMilliseconds(d, 0)],
  },
];

// ── RUNNER ──
function main(): void {
  console.log(`\n  mmntjs/fns  vs  date-fns  (${(ITERATIONS / 1000).toFixed(0)}k iterations each)\n`);
  console.log("  ".padEnd(40) + "fns (µs)".padStart(12) + "date-fns (µs)".padStart(14) + "ratio");
  console.log("  " + "─".repeat(70));

  for (const c of CASES) {
    const [fnsFn, dfFn] = c.run();
    const fnsNs = run(fnsFn, ITERATIONS, WARMUP);
    const dfNs = run(dfFn, ITERATIONS, WARMUP);
    const fnsUs = micros(fnsNs);
    const dfUs = micros(dfNs);
    const ratio = dfNs / fnsNs;
    const label = ratio >= 1
      ? `${ratio.toFixed(2)}x faster`
      : `${(1 / ratio).toFixed(2)}x slower`;
    console.log(
      `  ${c.name.padEnd(38)} ${fnsUs.padStart(10)} ${dfUs.padStart(12)}  ${label}`,
    );
  }
  console.log("");
}

main();
