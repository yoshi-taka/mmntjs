import moment2 from "../dist/index.js";
import {
  parseISO, addDays, addMonths, subDays, format, endOfMonth,
  differenceInCalendarDays, differenceInCalendarMonths,
  isLeapYear, setYear,
} from "date-fns";

function micros(ns) {
  if (ns < 1000) {return `${ns.toFixed(0)}ns`;}
  return `${(ns / 1000).toFixed(2)}μs`;
}

function run(fn, iter, warmup) {
  for (let i = 0; i < warmup; i++) { fn(); }
  const start = process.hrtime.bigint();
  for (let i = 0; i < iter; i++) { fn(); }
  const end = process.hrtime.bigint();
  return Number(end - start) / iter;
}

const ITER = 5000;
const WARMUP = 1000;
const RUNS = 5;

const CASES = [
  { name: "parse ISO string", run: () => [() => moment2("2024-01-15T10:30:45.123Z"), () => parseISO("2024-01-15T10:30:45.123Z")] },
  { name: "add 1 day", run: () => { const a = moment2("2024-06-15"); const b = new Date(2024,5,15); return [() => a.add(1,"day"), () => addDays(b,1)]; } },
  { name: "format YYYY-MM-DD", run: () => { const a = moment2("2024-06-15"); const b = new Date(2024,5,15); return [() => a.format("YYYY-MM-DD"), () => format(b,"yyyy-MM-dd")]; } },
  { name: "moment() / new Date()", run: () => [() => moment2(), () => new Date()] },
  { name: "endOf month", run: () => { const a = moment2("2024-06-15"); const b = new Date(2024,5,15); return [() => a.endOf("month"), () => endOfMonth(b)]; } },
  { name: "add 1 month", run: () => { const a = moment2("2024-06-15"); const b = new Date(2024,5,15); return [() => a.add(1,"month"), () => addMonths(b,1)]; } },
  { name: "diff in months", run: () => { const a = moment2("2024-01-15"); const b = moment2("2024-12-01"); const c = new Date(2024,0,15); const d = new Date(2024,11,1); return [() => a.diff(b,"months"), () => differenceInCalendarMonths(d,c)]; } },
  { name: "sub 1 day", run: () => { const a = moment2("2024-06-15"); const b = new Date(2024,5,15); return [() => a.add(-1,"day"), () => subDays(b,1)]; } },
  { name: "diff in days", run: () => { const a = moment2("2024-06-15"); const b = moment2("2024-07-01"); const c = new Date(2024,5,15); const d = new Date(2024,6,1); return [() => a.diff(b,"days"), () => differenceInCalendarDays(d,c)]; } },
  { name: "isLeapYear", run: () => { const a = moment2("2024-06-15"); const b = new Date(2024,5,15); return [() => a.isLeapYear(), () => isLeapYear(b)]; } },
  { name: "set year", run: () => { const a = moment2("2024-06-15"); const b = new Date(2024,5,15); return [() => a.year(2020), () => setYear(b,2020)]; } },
];

console.log("Node.js", process.version);
console.log("Operation                           moment2    date-fns     %");
for (const c of CASES) {
  const tm = [], td = [];
  for (let r = 0; r < RUNS; r++) {
    const [fnM2, fnDF] = c.run();
    tm.push(run(fnM2, ITER, WARMUP));
    td.push(run(fnDF, ITER, WARMUP));
  }
  tm.sort((a,b)=>a-b); td.sort((a,b)=>a-b);
  const medM2 = tm[Math.floor(RUNS/2)], medDF = td[Math.floor(RUNS/2)];
  console.log(`${c.name.padEnd(35)} ${micros(medM2).padStart(10)} ${micros(medDF).padStart(10)} ${(medDF/medM2*100).toFixed(1).padStart(6)}%`);
}
