// @ts-expect-error TypeScript errors are intentional for compatibility
import moment2 from "../moment2";
import {
  parseISO, getDayOfYear, addDays, addMonths, addSeconds, addMilliseconds,
  subDays, format, lightFormat, isAfter, isBefore,
  startOfMonth, startOfYear, endOfMonth,
  differenceInCalendarDays, differenceInCalendarMonths,
  getDaysInMonth, isLeapYear, setYear,
} from "date-fns";

function micros(ns: number): string {
  if (ns < 1000) {return `${ns.toFixed(0)  }ns`;}
  if (ns < 1_000_000) {return `${(ns / 1000).toFixed(2)  }\u03BCs`;}
  return `${(ns / 1_000_000).toFixed(3)  }ms`;
}

function run(fn: () => void, iter: number, warmup = 500): number {
  for (let i = 0; i < warmup; i++) { fn(); }
  const start = process.hrtime.bigint();
  for (let i = 0; i < iter; i++) { fn(); }
  const end = process.hrtime.bigint();
  return Number(end - start) / iter;
}

function runCold(fn: () => void): number {
  const start = process.hrtime.bigint();
  fn();
  const end = process.hrtime.bigint();
  return Number(end - start);
}

const COLD_RUNS = 20;
const WARM_RUNS = 5;

const CASES = [
  {
    name: "parse ISO string",
    run: () => [() => moment2("2024-01-15T10:30:45.123Z"), () => parseISO("2024-01-15T10:30:45.123Z")],
  },
  {
    name: "get day of year",
    run: () => {
      const a = moment2("2024-06-15");
      const b = new Date(2024, 5, 15);
      return [() => a.dayOfYear(), () => getDayOfYear(b)];
    },
  },
  {
    name: "add 1 day",
    run: () => {
      const a = moment2("2024-06-15");
      let b2 = new Date(2024, 5, 15);
      return [() => a.add(1, "day"), () => { b2 = addDays(b2, 1); }];
    },
  },
  {
    name: "format YYYY-MM-DD",
    run: () => {
      const a = moment2("2024-06-15");
      const b = new Date(2024, 5, 15);
      return [() => a.format("YYYY-MM-DD"), () => format(b, "yyyy-MM-dd")];
    },
  },
  {
    name: "lightFormat YYYY-MM-DD",
    run: () => {
      const a = moment2("2024-06-15");
      const b = new Date(2024, 5, 15);
      return [() => a.format("YYYY-MM-DD"), () => lightFormat(b, "yyyy-MM-dd")];
    },
  },
  {
    name: "Intl.DateTimeFormat YYYY-MM-DD (sv-SE)",
    run: () => {
      const a = moment2("2024-06-15");
      const b = new Date(2024, 5, 15);
      const fmt = new Intl.DateTimeFormat("sv-SE", {year: "numeric", month: "2-digit", day: "2-digit"});
      return [() => a.format("YYYY-MM-DD"), () => fmt.format(b)];
    },
  },
  {
    name: "Intl.DateTimeFormat YYYY-MM-DD (ar-SA)",
    run: () => {
      const a = moment2("2024-06-15");
      const b = new Date(2024, 5, 15);
      const fmt = new Intl.DateTimeFormat("ar-SA", {year: "numeric", month: "2-digit", day: "2-digit"});
      return [() => a.format("YYYY-MM-DD"), () => fmt.format(b)];
    },
  },
  {
    name: "isAfter",
    run: () => {
      const a = moment2("2024-06-15");
      const b = moment2("2024-07-01");
      const c = new Date(2024, 5, 15);
      const d = new Date(2024, 6, 1);
      return [() => a.isAfter(b), () => isAfter(c, d)];
    },
  },
  {
    name: "startOf month",
    run: () => {
      const a = moment2("2024-06-15");
      let b2 = new Date(2024, 5, 15);
      return [() => a.startOf("month"), () => { b2 = startOfMonth(b2); }];
    },
  },
  {
    name: "diff in days",
    run: () => {
      const a = moment2("2024-06-15");
      const b = moment2("2024-07-01");
      const c = new Date(2024, 5, 15);
      const d = new Date(2024, 6, 1);
      return [() => a.diff(b, "days"), () => differenceInCalendarDays(d, c)];
    },
  },
  {
    name: "moment() / new Date()",
    run: () => [() => moment2(), () => new Date()],
  },
  {
    name: "startOf year",
    run: () => {
      const a = moment2("2024-06-15");
      let b2 = new Date(2024, 5, 15);
      return [() => a.startOf("year"), () => { b2 = startOfYear(b2); }];
    },
  },
  {
    name: "endOf month",
    run: () => {
      const a = moment2("2024-06-15");
      let b2 = new Date(2024, 5, 15);
      return [() => a.endOf("month"), () => { b2 = endOfMonth(b2); }];
    },
  },
  {
    name: "add 1 month",
    run: () => {
      const a = moment2("2024-06-15");
      let b2 = new Date(2024, 5, 15);
      const fnDF = () => { b2 = addMonths(b2, 1); };
      return [() => a.add(1, "month"), fnDF];
    },
  },
  {
    name: "add 1 second",
    run: () => {
      const a = moment2("2024-06-15 10:30:45.123");
      let b2 = new Date(2024, 5, 15, 10, 30, 45, 123);
      return [() => a.add(1, "second"), () => { b2 = addSeconds(b2, 1); }];
    },
  },
  {
    name: "add 1 ms",
    run: () => {
      const a = moment2("2024-06-15 10:30:45.123");
      let b2 = new Date(2024, 5, 15, 10, 30, 45, 123);
      return [() => a.add(1, "millisecond"), () => { b2 = addMilliseconds(b2, 1); }];
    },
  },
  {
    name: "sub 1 day",
    run: () => {
      const a = moment2("2024-06-15");
      let b2 = new Date(2024, 5, 15);
      return [() => a.add(-1, "day"), () => { b2 = subDays(b2, 1); }];
    },
  },
  {
    name: "diff in months",
    run: () => {
      const a = moment2("2024-01-15");
      const b = moment2("2024-12-01");
      const c = new Date(2024, 0, 15);
      const d = new Date(2024, 11, 1);
      return [() => a.diff(b, "months"), () => differenceInCalendarMonths(d, c)];
    },
  },
  {
    name: "format HH:mm:ss",
    run: () => {
      const a = moment2("2024-06-15 10:30:45");
      const b = new Date(2024, 5, 15, 10, 30, 45);
      return [() => a.format("HH:mm:ss"), () => format(b, "HH:mm:ss")];
    },
  },
  {
    name: "lightFormat HH:mm:ss",
    run: () => {
      const a = moment2("2024-06-15 10:30:45");
      const b = new Date(2024, 5, 15, 10, 30, 45);
      return [() => a.format("HH:mm:ss"), () => lightFormat(b, "HH:mm:ss")];
    },
  },
  {
    name: "Intl.DateTimeFormat HH:mm:ss (en-US)",
    run: () => {
      const a = moment2("2024-06-15 10:30:45");
      const b = new Date(2024, 5, 15, 10, 30, 45);
      const fmt = new Intl.DateTimeFormat("en-US", {hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false});
      return [() => a.format("HH:mm:ss"), () => fmt.format(b)];
    },
  },
  {
    name: "Intl.DateTimeFormat HH:mm:ss (ar-SA)",
    run: () => {
      const a = moment2("2024-06-15 10:30:45");
      const b = new Date(2024, 5, 15, 10, 30, 45);
      const fmt = new Intl.DateTimeFormat("ar-SA", {hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false});
      return [() => a.format("HH:mm:ss"), () => fmt.format(b)];
    },
  },
  {
    name: "isBefore",
    run: () => {
      const a = moment2("2024-06-15");
      const b = moment2("2024-07-01");
      const c = new Date(2024, 5, 15);
      const d = new Date(2024, 6, 1);
      return [() => a.isBefore(b), () => isBefore(c, d)];
    },
  },
  {
    name: "daysInMonth",
    run: () => {
      const a = moment2("2024-06-15");
      const b = new Date(2024, 5, 15);
      return [() => a.daysInMonth(), () => getDaysInMonth(b)];
    },
  },
  {
    name: "isLeapYear",
    run: () => {
      const a = moment2("2024-06-15");
      const b = new Date(2024, 5, 15);
      return [() => a.isLeapYear(), () => isLeapYear(b)];
    },
  },
  {
    name: "set year",
    run: () => {
      const a = moment2("2024-06-15");
      let b2 = new Date(2024, 5, 15);
      return [() => a.year(2020), () => { b2 = setYear(b2, 2020); }];
    },
  },
];

const ITER = 5000;
const WARMUP = 1000;

console.log("Operation                           cold m2      cold df      %    warm m2      warm df      %");
for (const c of CASES) {
  const cm: number[] = [], cd: number[] = [];
  for (let r = 0; r < COLD_RUNS; r++) {
    const [fnM2, fnDF] = c.run();
    cm.push(runCold(fnM2));
    cd.push(runCold(fnDF));
  }
  cm.sort((a, b) => a - b);
  cd.sort((a, b) => a - b);
  const coldM2 = cm[Math.floor(COLD_RUNS / 2)];
  const coldDF = cd[Math.floor(COLD_RUNS / 2)];
  const coldRatio = (coldDF / coldM2 * 100).toFixed(1);

  const tm: number[] = [], td: number[] = [];
  for (let r = 0; r < WARM_RUNS; r++) {
    const [fnM2, fnDF] = c.run();
    tm.push(run(fnM2, ITER, WARMUP));
    td.push(run(fnDF, ITER, WARMUP));
  }
  tm.sort((a, b) => a - b);
  td.sort((a, b) => a - b);
  const warmM2 = tm[Math.floor(WARM_RUNS / 2)];
  const warmDF = td[Math.floor(WARM_RUNS / 2)];
  const warmRatio = (warmDF / warmM2 * 100).toFixed(1);

  console.log(`${c.name.padEnd(35)} ${micros(coldM2).padStart(10)} ${micros(coldDF).padStart(10)} ${coldRatio.padStart(6)}%  ${micros(warmM2).padStart(10)} ${micros(warmDF).padStart(10)} ${warmRatio.padStart(6)}%`);
}
