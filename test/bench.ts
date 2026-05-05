// @ts-expect-error TypeScript errors are intentional for compatibility
import moment2 from "../moment2";
import moment from "../moment/moment.js";

interface BenchCase {
  name: string;
  setup?: () => [() => void, () => void];
  run: () => [() => void, () => void];
}

function micros(ns: number): string {
  if (ns < 1000) {return `${ns.toFixed(0)  }ns`;}
  if (ns < 1_000_000) {return `${(ns / 1000).toFixed(2)  }μs`;}
  return `${(ns / 1_000_000).toFixed(3)  }ms`;
}

function run(name: string, fn: () => void, iterations: number): number {
  // warmup
  for (let i = 0; i < Math.min(iterations, 100); i++) {fn();}
  const start = process.hrtime.bigint();
  for (let i = 0; i < iterations; i++) {fn();}
  const end = process.hrtime.bigint();
  return Number(end - start) / iterations;
}

function runCold(fn: () => void): number {
  const start = process.hrtime.bigint();
  fn();
  const end = process.hrtime.bigint();
  return Number(end - start);
}

const COLD_RUNS = 20;
const WARM_RUNS = 5;

const CASES: BenchCase[] = [
  {
    name: "moment()",
    run: () => [() => moment(), () => moment2()],
  },
  {
    name: "moment([y,M,d])",
    run: () => [() => moment([2024, 0, 15]), () => moment2([2024, 0, 15])],
  },
  {
    name: "moment([y,M,d,h,m,s,ms])",
    run: () => [() => moment([2024, 0, 15, 10, 30, 45, 123]), () => moment2([2024, 0, 15, 10, 30, 45, 123])],
  },
  {
    name: "moment('ISO string')",
    run: () => [() => moment("2024-01-15T10:30:45.123Z"), () => moment2("2024-01-15T10:30:45.123Z")],
  },
  {
    name: "moment(Date)",
    run: () => { const d = new Date(); return [() => moment(d), () => moment2(d)]; },
  },
  {
    name: "format('YYYY-MM-DD')",
    run: () => { const a = moment("2024-06-15"), b = moment2("2024-06-15"); return [() => a.format("YYYY-MM-DD"), () => b.format("YYYY-MM-DD")]; },
  },
  {
    name: "format('dddd, MMMM Do YYYY, h:mm:ss a')",
    run: () => { const a = moment("2024-06-15"), b = moment2("2024-06-15"); return [() => a.format("dddd, MMMM Do YYYY, h:mm:ss a"), () => b.format("dddd, MMMM Do YYYY, h:mm:ss a")]; },
  },
  {
    name: "format('LL')",
    run: () => { const a = moment("2024-06-15"), b = moment2("2024-06-15"); return [() => a.format("LL"), () => b.format("LL")]; },
  },
  {
    name: "getters (year,month,date,hour,min,sec,ms)",
    run: () => {
      const a = moment("2024-06-15 10:30:45.123"), b = moment2("2024-06-15 10:30:45.123");
      return [
        () => { a.year(); a.month(); a.date(); a.hour(); a.minute(); a.second(); a.millisecond(); },
        () => { b.year(); b.month(); b.date(); b.hour(); b.minute(); b.second(); b.millisecond(); },
      ];
    },
  },
  {
    name: "setters (year,month,date)",
    run: () => { const a = moment("2024-06-15"), b = moment2("2024-06-15"); return [() => { a.year(2020); a.month(0); a.date(1); }, () => { b.year(2020); b.month(0); b.date(1); }]; },
  },
  {
    name: "add(1,'day')",
    run: () => { const a = moment("2024-06-15"), b = moment2("2024-06-15"); return [() => a.add(1, "day"), () => b.add(1, "day")]; },
  },
  {
    name: "add(1,'month')",
    run: () => { const a = moment("2024-06-15"), b = moment2("2024-06-15"); return [() => a.add(1, "month"), () => b.add(1, "month")]; },
  },
  {
    name: "subtract(7,'days').add(1,'month')",
    run: () => { const a = moment("2024-06-15"), b = moment2("2024-06-15"); return [() => a.subtract(7, "days").add(1, "month"), () => b.subtract(7, "days").add(1, "month")]; },
  },
  {
    name: "isBefore/isAfter/isSame",
    run: () => {
      const a = moment("2024-06-15"), b = moment2("2024-06-15");
      const c = moment("2024-07-01"), d = moment2("2024-07-01");
      return [
        () => { a.isBefore(c); a.isAfter(c); a.isSame(c); },
        () => { b.isBefore(d); b.isAfter(d); b.isSame(d); },
      ];
    },
  },
  {
    name: "isBetween",
    run: () => {
      const a = moment("2024-06-15"), b = moment2("2024-06-15");
      const c = moment("2024-01-01"), d = moment2("2024-01-01");
      const e = moment("2024-12-31"), f = moment2("2024-12-31");
      return [
        () => { a.isBetween(c, e); a.isBetween(c, e, "month"); a.isBetween(c, e, null, "()"); },
        () => { b.isBetween(d, f); b.isBetween(d, f, "month"); b.isBetween(d, f, null, "()"); },
      ];
    },
  },
  {
    name: "diff('days')",
    run: () => {
      const a = moment("2024-06-15"), b = moment2("2024-06-15");
      const c = moment("2024-07-01"), d = moment2("2024-07-01");
      return [() => a.diff(c, "days"), () => b.diff(d, "days")];
    },
  },
  {
    name: "diff('months')",
    run: () => {
      const a = moment("2024-01-15"), b = moment2("2024-01-15");
      const c = moment("2024-12-01"), d = moment2("2024-12-01");
      return [() => a.diff(c, "months"), () => b.diff(d, "months")];
    },
  },
  {
    name: "startOf('month').endOf('month')",
    run: () => { const a = moment("2024-06-15"), b = moment2("2024-06-15"); return [() => { a.startOf("month"); a.endOf("month"); }, () => { b.startOf("month"); b.endOf("month"); }]; },
  },
  {
    name: "startOf('week').startOf('year')",
    run: () => { const a = moment("2024-06-15"), b = moment2("2024-06-15"); return [() => { a.startOf("week"); a.startOf("year"); }, () => { b.startOf("week"); b.startOf("year"); }]; },
  },
  {
    name: "clone",
    run: () => { const a = moment("2024-06-15"), b = moment2("2024-06-15"); return [() => a.clone(), () => b.clone()]; },
  },
  {
    name: "moment.duration(12345)",
    run: () => [() => moment.duration(12345), () => moment2.duration(12345)],
  },
  {
    name: "moment.duration(7,'days')",
    run: () => [() => moment.duration(7, "days"), () => moment2.duration(7, "days")],
  },
  {
    name: "valueOf / unix",
    run: () => { const a = moment("2024-06-15"), b = moment2("2024-06-15"); return [() => { a.valueOf(); a.unix(); }, () => { b.valueOf(); b.unix(); }]; },
  },
  {
    name: "daysInMonth / isLeapYear",
    run: () => { const a = moment("2024-06-15"), b = moment2("2024-06-15"); return [() => { a.daysInMonth(); a.isLeapYear(); }, () => { b.daysInMonth(); b.isLeapYear(); }]; },
  },
  {
    name: "startOf('year')",
    run: () => { const a = moment("2024-06-15"), b = moment2("2024-06-15"); return [() => a.startOf("year"), () => b.startOf("year")]; },
  },
  {
    name: "endOf('year')",
    run: () => { const a = moment("2024-06-15"), b = moment2("2024-06-15"); return [() => a.endOf("year"), () => b.endOf("year")]; },
  },
  {
    name: "moment('ISO string') with format",
    run: () => [() => moment("2024-01-15T10:30:45.123Z", "YYYY-MM-DDTHH:mm:ss.SSSZ"), () => moment2("2024-01-15T10:30:45.123Z", "YYYY-MM-DDTHH:mm:ss.SSSZ")],
  },
  {
    name: "moment.utc('ISO string')",
    run: () => [() => moment.utc("2024-01-15"), () => moment2.utc("2024-01-15")],
  },
  {
    name: "format('HH:mm:ss')",
    run: () => { const a = moment("2024-06-15 10:30:45"), b = moment2("2024-06-15 10:30:45"); return [() => a.format("HH:mm:ss"), () => b.format("HH:mm:ss")]; },
  },
  {
    name: "add(1,'year')",
    run: () => { const a = moment("2024-06-15"), b = moment2("2024-06-15"); return [() => a.add(1, "year"), () => b.add(1, "year")]; },
  },
];

const ITER = 5000;
const WARMUP = 100;

console.log(`\ncold/warm benchmark (cold=1st call, warm=${ITER}it after ${WARMUP}warmup):\n`);
console.log("Operation                           cold mom     cold m2      %   warm mom     warm m2      %");
for (const c of CASES) {
  const cm: number[] = [], cd: number[] = [];
  for (let r = 0; r < COLD_RUNS; r++) {
    const [fnMoment, fnMoment2] = c.run();
    cm.push(runCold(fnMoment));
    cd.push(runCold(fnMoment2));
  }
  cm.sort((a, b) => a - b);
  cd.sort((a, b) => a - b);
  const coldMom = cm[Math.floor(COLD_RUNS / 2)];
  const coldM2 = cd[Math.floor(COLD_RUNS / 2)];
  const coldRatio = (coldM2 / coldMom * 100).toFixed(1);

  const tm: number[] = [], td: number[] = [];
  for (let r = 0; r < WARM_RUNS; r++) {
    const [fnMoment, fnMoment2] = c.run();
    tm.push(run(`${c.name} (moment)`, fnMoment, ITER));
    td.push(run(`${c.name} (moment2)`, fnMoment2, ITER));
  }
  tm.sort((a, b) => a - b);
  td.sort((a, b) => a - b);
  const warmMom = tm[Math.floor(WARM_RUNS / 2)];
  const warmM2 = td[Math.floor(WARM_RUNS / 2)];
  const warmRatio = (warmM2 / warmMom * 100).toFixed(1);

  console.log(`${c.name.padEnd(35)} ${micros(coldMom).padStart(10)} ${micros(coldM2).padStart(10)} ${coldRatio.padStart(6)}%  ${micros(warmMom).padStart(10)} ${micros(warmM2).padStart(10)} ${warmRatio.padStart(6)}%`);
}


