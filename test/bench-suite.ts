// @ts-expect-error
import moment2 from "../moment2";
import { defineLocale } from "../src/locale";
import { frLocale } from "../src/locale/fr";
defineLocale("fr", frLocale);
import { setLocale } from "../src/locale";
setLocale("en");

import {
  parseISO, format, lightFormat, getDayOfYear, addDays, isAfter,
  startOfDay, startOfMonth, setMonth, setYear, isBefore, differenceInCalendarDays,
} from "date-fns";
import { fr, enUS } from "date-fns/locale";
import Benchmark from "benchmark";

const suite = new Benchmark.Suite({ minSamples: 20 });

const date = new Date();
const isoStr = date.toISOString();
const dateA = new Date(1989, 6, 10);
const dateB = new Date(1987, 1, 11);

const momentForLocale = (locale: string) => moment2(date).locale(locale);
const dfLocalePP = (loc: any) => () => format(date, "PP", { locale: loc });
const dfLocalep = (loc: any) => () => format(date, "p", { locale: loc });
const dfLocalePPp = (loc: any) => () => format(date, "PPp", { locale: loc });

// pre-create date-fns format closures with locale baked in
const dfFrPP = dfLocalePP(fr);
const dfFrp = dfLocalep(fr);
const dfFrPPp = dfLocalePPp(fr);
const dfEnPP = dfLocalePP(enUS);
const dfEnp = dfLocalep(enUS);
const dfEnPPp = dfLocalePPp(enUS);

suite
  .add("moment2#parse ISO string", () => { moment2(isoStr); })
  .add("date-fns#parseISO", () => { parseISO(isoStr); })

  .add("moment2#format YYYY-MM-DD", () => { moment2(date).format("YYYY-MM-DD"); })
  .add("date-fns#format yyyy-MM-dd", () => { format(date, "yyyy-MM-dd"); })
  .add("date-fns#lightFormat yyyy-MM-dd", () => { lightFormat(date, "yyyy-MM-dd"); })
  .add("moment2#format HH:mm:ss", () => { moment2(date).format("HH:mm:ss"); })
  .add("date-fns#format HH:mm:ss", () => { format(date, "HH:mm:ss"); })
  .add("date-fns#lightFormat HH:mm:ss", () => { lightFormat(date, "HH:mm:ss"); })

  .add("moment2#format LL (fr locale)", () => { momentForLocale("fr").format("LL"); })
  .add("date-fns#format PP (fr locale)", dfFrPP)
  .add("moment2#format LT (fr locale)", () => { momentForLocale("fr").format("LT"); })
  .add("date-fns#format p (fr locale)", dfFrp)
  .add("moment2#format LLL (fr locale)", () => { momentForLocale("fr").format("LLL"); })
  .add("date-fns#format PPp (fr locale)", dfFrPPp)
  .add("moment2#format LL (en locale)", () => { moment2(date).format("LL"); })
  .add("date-fns#format PP (en locale)", dfEnPP)
  .add("moment2#format LT (en locale)", () => { moment2(date).format("LT"); })
  .add("date-fns#format p (en locale)", dfEnp)
  .add("moment2#format LLL (en locale)", () => { moment2(date).format("LLL"); })
  .add("date-fns#format PPp (en locale)", dfEnPPp)

  .add("moment2#dayOfYear", () => { moment2(date).dayOfYear(); })
  .add("date-fns#getDayOfYear", () => { getDayOfYear(date); })

  .add("moment2#add 1 day", () => { moment2(date).add(1, "day"); })
  .add("date-fns#addDays", () => { addDays(date, 1); })

  .add("moment2#isAfter", () => { moment2(dateA).isAfter(dateB); })
  .add("date-fns#isAfter", () => { isAfter(dateA, dateB); })

  .add("moment2#startOfDay", () => { moment2(date).startOf("day"); })
  .add("date-fns#startOfDay", () => { startOfDay(date); })

  .add("moment2#setMonth", () => { moment2(date).month(3); })
  .add("date-fns#setMonth", () => { setMonth(date, 3); })

  .add("moment2#setYear", () => { moment2(date).year(2000); })
  .add("date-fns#setYear", () => { setYear(date, 2000); })

  .add("moment2#diff days", () => { moment2(dateA).diff(dateB, "days"); })
  .add("date-fns#differenceInCalendarDays", () => { differenceInCalendarDays(dateA, dateB); })

  .on("cycle", (event: any) => {
    console.log(String(event.target));
  })
  .on("complete", function (this: any) {
    console.log("\nFastest is " + this.filter("fastest").map("name"));
  })
  .run({ async: true });
