// @ts-expect-error: no types for ../mmntjs
import mmntjs from "../mmntjs";
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
  differenceInCalendarDays,
} from "date-fns";
import { fr, enUS } from "date-fns/locale";
import type { Locale } from "date-fns";
import Benchmark from "benchmark";

const suite = new Benchmark.Suite({ minSamples: 20 });

const date = new Date();
const isoStr = date.toISOString();
const dateA = new Date(1989, 6, 10);
const dateB = new Date(1987, 1, 11);

const momentForLocale = (locale: string) => mmntjs(date).locale(locale);
const dfLocalePP = (loc: Locale) => () => format(date, "PP", { locale: loc });
const dfLocalep = (loc: Locale) => () => format(date, "p", { locale: loc });
const dfLocalePPp = (loc: Locale) => () => format(date, "PPp", { locale: loc });

// pre-create date-fns format closures with locale baked in
const dfFrPP = dfLocalePP(fr);
const dfFrp = dfLocalep(fr);
const dfFrPPp = dfLocalePPp(fr);
const dfEnPP = dfLocalePP(enUS);
const dfEnp = dfLocalep(enUS);
const dfEnPPp = dfLocalePPp(enUS);

suite
  .add("mmntjs#parse ISO string", () => {
    mmntjs(isoStr);
  })
  .add("date-fns#parseISO", () => {
    parseISO(isoStr);
  })

  .add("mmntjs#format YYYY-MM-DD", () => {
    mmntjs(date).format("YYYY-MM-DD");
  })
  .add("date-fns#format yyyy-MM-dd", () => {
    format(date, "yyyy-MM-dd");
  })
  .add("date-fns#lightFormat yyyy-MM-dd", () => {
    lightFormat(date, "yyyy-MM-dd");
  })
  .add("mmntjs#format HH:mm:ss", () => {
    mmntjs(date).format("HH:mm:ss");
  })
  .add("date-fns#format HH:mm:ss", () => {
    format(date, "HH:mm:ss");
  })
  .add("date-fns#lightFormat HH:mm:ss", () => {
    lightFormat(date, "HH:mm:ss");
  })

  .add("mmntjs#format LL (fr locale)", () => {
    momentForLocale("fr").format("LL");
  })
  .add("date-fns#format PP (fr locale)", dfFrPP)
  .add("mmntjs#format LT (fr locale)", () => {
    momentForLocale("fr").format("LT");
  })
  .add("date-fns#format p (fr locale)", dfFrp)
  .add("mmntjs#format LLL (fr locale)", () => {
    momentForLocale("fr").format("LLL");
  })
  .add("date-fns#format PPp (fr locale)", dfFrPPp)
  .add("mmntjs#format LL (en locale)", () => {
    mmntjs(date).format("LL");
  })
  .add("date-fns#format PP (en locale)", dfEnPP)
  .add("mmntjs#format LT (en locale)", () => {
    mmntjs(date).format("LT");
  })
  .add("date-fns#format p (en locale)", dfEnp)
  .add("mmntjs#format LLL (en locale)", () => {
    mmntjs(date).format("LLL");
  })
  .add("date-fns#format PPp (en locale)", dfEnPPp)

  .add("mmntjs#dayOfYear", () => {
    mmntjs(date).dayOfYear();
  })
  .add("date-fns#getDayOfYear", () => {
    getDayOfYear(date);
  })

  .add("mmntjs#add 1 day", () => {
    mmntjs(date).add(1, "day");
  })
  .add("date-fns#addDays", () => {
    addDays(date, 1);
  })

  .add("mmntjs#isAfter", () => {
    mmntjs(dateA).isAfter(dateB);
  })
  .add("date-fns#isAfter", () => {
    isAfter(dateA, dateB);
  })

  .add("mmntjs#startOfDay", () => {
    mmntjs(date).startOf("day");
  })
  .add("date-fns#startOfDay", () => {
    startOfDay(date);
  })

  .add("mmntjs#setMonth", () => {
    mmntjs(date).month(3);
  })
  .add("date-fns#setMonth", () => {
    setMonth(date, 3);
  })

  .add("mmntjs#setYear", () => {
    mmntjs(date).year(2000);
  })
  .add("date-fns#setYear", () => {
    setYear(date, 2000);
  })

  .add("mmntjs#diff days", () => {
    mmntjs(dateA).diff(dateB, "days");
  })
  .add("date-fns#differenceInCalendarDays", () => {
    differenceInCalendarDays(dateA, dateB);
  })

  .on("cycle", (event: unknown) => {
    console.log(String((event as { target: { toString(): string } }).target));
  })
  .on("complete", function (this: Record<string, unknown>) {
    const fastest = (this.filter as (s: string) => { map: (s: string) => unknown })("fastest");
    console.log(`\nFastest is ${(fastest.map as (s: string) => string)("name")}`);
  })
  .run({ async: true });
