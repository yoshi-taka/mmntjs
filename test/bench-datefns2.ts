// @ts-expect-error TypeScript errors are intentional for compatibility
import moment2 from "../moment2";
import { parseISO, getDayOfYear, addDays, format, isAfter, startOfMonth, differenceInCalendarDays } from "date-fns";

function micros(ns) {
  if (ns < 1000) {return `${ns.toFixed(0)  }ns`;}
  if (ns < 1_000_000) {return `${(ns / 1000).toFixed(2)  }\u03BCs`;}
  return `${(ns / 1_000_000).toFixed(3)  }ms`;
}

function run(fn, iter) {
  const start = process.hrtime.bigint();
  for (let i = 0; i < iter; i++) {fn();}
  const end = process.hrtime.bigint();
  return Number(end - start) / iter;
}

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
      const b = new Date(2024, 5, 15);
      return [() => a.add(1, "day"), () => addDays(b, 1)];
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
      const b = new Date(2024, 5, 15);
      return [() => a.startOf("month"), () => startOfMonth(b)];
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
];

const ITER = 5000;
const RUNS = 5;

// warmup
for (const c of CASES) {
  const [f1, f2] = c.run();
  for (let i = 0; i < 500; i++) { f1(); f2(); }
}

console.log("Operation                           moment2    date-fns   %");
for (const c of CASES) {
  const [fnM2, fnDF] = c.run();
  const tm = [], td = [];
  for (let r = 0; r < RUNS; r++) {
    tm.push(run(fnM2, ITER));
    td.push(run(fnDF, ITER));
  }
  tm.sort((a, b) => a - b);
  td.sort((a, b) => a - b);
  const medM2 = tm[Math.floor(RUNS / 2)];
  const medDF = td[Math.floor(RUNS / 2)];
  const ratio = (medDF / medM2 * 100).toFixed(1);
  console.log(`${c.name.padEnd(35)} ${micros(medM2).padStart(10)} ${micros(medDF).padStart(10)} ${ratio.padStart(6)}%`);
}
