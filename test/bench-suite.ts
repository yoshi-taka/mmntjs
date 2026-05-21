import mmntjs from "mmntjs";
import { defineLocale } from "../src/locale";
import { frLocale } from "../src/locale/fr";
defineLocale("fr", frLocale);
import { setLocale } from "../src/locale";
setLocale("en");

import {
  parseISO,
  format,
  lightFormat,
  getDayOfYear,
  addDays,
  isAfter,
  startOfDay,
  setMonth,
  setYear,
  setHours,
  setMinutes,
  setSeconds,
  setMilliseconds,
  setDate as dfSetDate,
  differenceInCalendarDays,
} from "date-fns";
import { fr, enUS } from "date-fns/locale";
import type { Locale } from "date-fns";
import Benchmark from "benchmark";

const date = new Date();
const isoStr = date.toISOString();
const dateA = new Date(1989, 6, 10);
const dateB = new Date(1987, 1, 11);

const momentForLocale = (locale: string) => mmntjs(date).locale(locale);
const dfLocalePP = (loc: Locale) => () => format(date, "PP", { locale: loc });
const dfLocalep = (loc: Locale) => () => format(date, "p", { locale: loc });
const dfLocalePPp = (loc: Locale) => () => format(date, "PPp", { locale: loc });

const dfFrPP = dfLocalePP(fr);
const dfFrp = dfLocalep(fr);
const dfFrPPp = dfLocalePPp(fr);
const dfEnPP = dfLocalePP(enUS);
const dfEnp = dfLocalep(enUS);
const dfEnPPp = dfLocalePPp(enUS);

// ── Filter: comma-separated groups from BENCH env var ──
const filterArg = process.env.BENCH || "";
const filter = filterArg ? new Set(filterArg.split(",").map((s) => s.trim())) : null;
const match = (group: string): boolean => !filter || filter.has(group);

// ── Help ──
if (filterArg === "help" || filterArg === "--help") {
  console.log("Usage: BENCH=parse,format,locale,add,startof,setter,diff bun test/bench-suite.ts");
  console.log("Groups: parse, format, locale, add, startof, setter, diff");
  process.exit(0);
}

function runGroups(
  groups: { name: string; benches: ((suite: Benchmark.Suite) => Benchmark.Suite)[] }[],
) {
  for (const group of groups) {
    if (!match(group.name)) {
      continue;
    }
    const suite = new Benchmark.Suite({ minSamples: 20 });
    for (const bench of group.benches) {
      bench(suite);
    }
    console.log(`\n### ${group.name} ###`);
    suite
      .on("cycle", (event: unknown) => {
        console.log(String((event as { target: { toString(): string } }).target));
      })
      .on("complete", function (this: Record<string, unknown>) {
        const fastest = (this.filter as (s: string) => { map: (s: string) => unknown })("fastest");
        console.log(`  fastest: ${(fastest.map as (s: string) => string)("name")}`);
      })
      .run({ async: false });
  }
}

runGroups([
  {
    name: "parse",
    benches: [
      (s) => s.add("mmntjs#parse ISO string", () => mmntjs(isoStr)),
      (s) => s.add("date-fns#parseISO", () => parseISO(isoStr)),
    ],
  },
  {
    name: "format",
    benches: [
      (s) => s.add("mmntjs#format YYYY-MM-DD", () => mmntjs(date).format("YYYY-MM-DD")),
      (s) => s.add("date-fns#format yyyy-MM-dd", () => format(date, "yyyy-MM-dd")),
      (s) => s.add("date-fns#lightFormat yyyy-MM-dd", () => lightFormat(date, "yyyy-MM-dd")),
      (s) => s.add("mmntjs#format HH:mm:ss", () => mmntjs(date).format("HH:mm:ss")),
      (s) => s.add("date-fns#format HH:mm:ss", () => format(date, "HH:mm:ss")),
      (s) => s.add("date-fns#lightFormat HH:mm:ss", () => lightFormat(date, "HH:mm:ss")),
    ],
  },
  {
    name: "locale",
    benches: [
      (s) => s.add("mmntjs#format LL (fr)", () => momentForLocale("fr").format("LL")),
      (s) => s.add("date-fns#format PP (fr)", dfFrPP),
      (s) => s.add("mmntjs#format LT (fr)", () => momentForLocale("fr").format("LT")),
      (s) => s.add("date-fns#format p (fr)", dfFrp),
      (s) => s.add("mmntjs#format LLL (fr)", () => momentForLocale("fr").format("LLL")),
      (s) => s.add("date-fns#format PPp (fr)", dfFrPPp),
      (s) => s.add("mmntjs#format LL (en)", () => mmntjs(date).format("LL")),
      (s) => s.add("date-fns#format PP (en)", dfEnPP),
      (s) => s.add("mmntjs#format LT (en)", () => mmntjs(date).format("LT")),
      (s) => s.add("date-fns#format p (en)", dfEnp),
      (s) => s.add("mmntjs#format LLL (en)", () => mmntjs(date).format("LLL")),
      (s) => s.add("date-fns#format PPp (en)", dfEnPPp),
    ],
  },
  {
    name: "add",
    benches: [
      (s) => s.add("mmntjs#add 1 day", () => mmntjs(date).add(1, "day")),
      (s) => s.add("date-fns#addDays", () => addDays(date, 1)),
    ],
  },
  {
    name: "startof",
    benches: [
      (s) => s.add("mmntjs#startOfDay", () => mmntjs(date).startOf("day")),
      (s) => s.add("date-fns#startOfDay", () => startOfDay(date)),
      (s) => s.add("mmntjs#startOfYear", () => mmntjs(date).startOf("year")),
      (s) => s.add("mmntjs#startOfMonth", () => mmntjs(date).startOf("month")),
      (s) => s.add("mmntjs#startOfHour", () => mmntjs(date).startOf("hour")),
    ],
  },
  {
    name: "setter",
    benches: [
      (s) => s.add("mmntjs#setYear (→2000)", () => mmntjs(date).year(2000)),
      (s) => s.add("date-fns#setYear", () => setYear(date, 2000)),
      (s) => s.add("mmntjs#setMonth (→3)", () => mmntjs(date).month(3)),
      (s) => s.add("date-fns#setMonth", () => setMonth(date, 3)),
      (s) => s.add("mmntjs#setDate (→15)", () => mmntjs(date).date(15)),
      (s) => s.add("date-fns#setDate", () => dfSetDate(date, 15)),
      (s) => s.add("mmntjs#setHour (→0)", () => mmntjs(date).hour(0)),
      (s) => s.add("date-fns#setHours", () => setHours(date, 0)),
      (s) => s.add("mmntjs#setMinute (→0)", () => mmntjs(date).minute(0)),
      (s) => s.add("date-fns#setMinutes", () => setMinutes(date, 0)),
      (s) => s.add("mmntjs#setSecond (→0)", () => mmntjs(date).second(0)),
      (s) => s.add("date-fns#setSeconds", () => setSeconds(date, 0)),
      (s) => s.add("mmntjs#setMs (→0)", () => mmntjs(date).millisecond(0)),
      (s) => s.add("date-fns#setMilliseconds", () => setMilliseconds(date, 0)),
    ],
  },
  {
    name: "diff",
    benches: [
      (s) => s.add("mmntjs#dayOfYear", () => mmntjs(date).dayOfYear()),
      (s) => s.add("date-fns#getDayOfYear", () => getDayOfYear(date)),
      (s) => s.add("mmntjs#isAfter", () => mmntjs(dateA).isAfter(dateB)),
      (s) => s.add("date-fns#isAfter", () => isAfter(dateA, dateB)),
      (s) => s.add("mmntjs#diff days", () => mmntjs(dateA).diff(dateB, "days")),
      (s) =>
        s.add("date-fns#differenceInCalendarDays", () => differenceInCalendarDays(dateA, dateB)),
    ],
  },
]);
