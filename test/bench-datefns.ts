// @ts-nocheck
import moment2 from "../moment";
import { parseISO, getDayOfYear, addDays, format, isAfter } from "date-fns";

interface BenchCase {
  name: string;
  run: () => [() => void, () => void];
}

function micros(ns: number): string {
  if (ns < 1000) return ns.toFixed(0) + "ns";
  if (ns < 1_000_000) return (ns / 1000).toFixed(2) + "\u03BCs";
  return (ns / 1_000_000).toFixed(3) + "ms";
}

function run(name: string, fn: () => void, iterations: number): number {
  for (let i = 0; i < Math.min(iterations, 100); i++) fn();
  const start = process.hrtime.bigint();
  for (let i = 0; i < iterations; i++) fn();
  const end = process.hrtime.bigint();
  return Number(end - start) / iterations;
}

const CASES: BenchCase[] = [
  {
    name: "parse ISO string",
    run: () => [
      () => moment2("2024-01-15T10:30:45.123Z"),
      () => parseISO("2024-01-15T10:30:45.123Z"),
    ],
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
    name: "moment() / new Date()",
    run: () => [() => moment2(), () => new Date()],
  },
  {
    name: "format long (dddd, MMMM Do YYYY)",
    run: () => {
      const a = moment2("2024-06-15");
      const b = new Date(2024, 5, 15);
      return [
        () => a.format("dddd, MMMM Do YYYY, h:mm:ss a"),
        () => format(b, "EEEE, MMMM do yyyy, h:mm:ss a"),
      ];
    },
  },
  {
    name: "add 1 month",
    run: () => {
      const a = moment2("2024-06-15");
      const b = new Date(2024, 5, 15);
      return [() => a.add(1, "month"), () => addDays(b, 30)];
    },
  },
  {
    name: "startOf('month')",
    run: () => {
      const a = moment2("2024-06-15");
      const b = new Date(2024, 5, 15);
      return [
        () => a.startOf("month"),
        () => new Date(b.getFullYear(), b.getMonth(), 1),
      ];
    },
  },
  {
    name: "diff in days",
    run: () => {
      const a = moment2("2024-06-15");
      const b = moment2("2024-07-01");
      const c = new Date(2024, 5, 15);
      const d = new Date(2024, 6, 1);
      return [
        () => a.diff(b, "days"),
        () => Math.round((d.getTime() - c.getTime()) / 86400000),
      ];
    },
  },
];

const ITER = 5000;
const results: { name: string; moment2: number; datefns: number; ratio: string }[] = [];

for (const c of CASES) {
  const [fnMoment2, fnDatefns] = c.run();
  const tMoment2 = run(c.name + " (moment2)", fnMoment2, ITER);
  const tDatefns = run(c.name + " (date-fns)", fnDatefns, ITER);
  const ratio = (tDatefns / tMoment2 * 100).toFixed(1);
  results.push({ name: c.name, moment2: tMoment2, datefns: tDatefns, ratio });
}

console.log("\nBenchmark results (" + ITER + " iterations each):\n");
console.log("\u250C\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2510");
console.log("\u2502 Operation                                    \u2502 moment2    \u2502 date-fns   \u2502 %        \u2502");
console.log("\u2502\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2524");

for (const r of results) {
  const name = r.name.padEnd(44).slice(0, 44);
  const m2 = micros(r.moment2).padStart(10);
  const df = micros(r.datefns).padStart(10);
  const pct = (r.ratio + "%").padStart(6);
  console.log(`\u2502 ${name} \u2502 ${m2} \u2502 ${df} \u2502 ${pct} \u2502`);
}

console.log("\u2514\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2518");
