// @ts-nocheck
import moment2 from "../moment";
import moment from "../moment/moment.js";

interface BenchCase {
  name: string;
  setup?: () => [() => void, () => void];
  run: () => [() => void, () => void];
}

function micros(ns: number): string {
  if (ns < 1000) return ns.toFixed(0) + "ns";
  if (ns < 1_000_000) return (ns / 1000).toFixed(2) + "μs";
  return (ns / 1_000_000).toFixed(3) + "ms";
}

function run(name: string, fn: () => void, iterations: number): number {
  // warmup
  for (let i = 0; i < Math.min(iterations, 100); i++) fn();
  const start = process.hrtime.bigint();
  for (let i = 0; i < iterations; i++) fn();
  const end = process.hrtime.bigint();
  return Number(end - start) / iterations;
}

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
];

const ITER = 5000;
const results: { name: string; moment: number; moment2: number; ratio: string }[] = [];

for (const c of CASES) {
  const [fnMoment, fnMoment2] = c.run();
  const tMoment = run(c.name + " (moment)", fnMoment, ITER);
  const tMoment2 = run(c.name + " (moment2)", fnMoment2, ITER);
  const ratio = (tMoment2 / tMoment * 100).toFixed(1);
  results.push({ name: c.name, moment: tMoment, moment2: tMoment2, ratio });
}

console.log("\nBenchmark results (" + ITER + " iterations each):\n");
console.log("┌──────────────────────────────────────────────┬────────────┬────────────┬────────┐");
console.log("│ Operation                                    │ moment     │ moment2    │ %      │");
console.log("├──────────────────────────────────────────────┼────────────┼────────────┼────────┤");

for (const r of results) {
  const name = r.name.padEnd(44).slice(0, 44);
  const m = micros(r.moment).padStart(10);
  const m2 = micros(r.moment2).padStart(10);
  const pct = (r.ratio + "%").padStart(6);
  console.log(`│ ${name} │ ${m} │ ${m2} │ ${pct} │`);
}

console.log("└──────────────────────────────────────────────┴────────────┴────────────┴────────┘");


