// @ts-nocheck
import moment2 from "../moment";
import moment from "../moment/moment.js";

function micros(ns: number): string {
  if (ns < 1000) return `${ns.toFixed(0)  }ns`;
  if (ns < 1_000_000) return `${(ns / 1000).toFixed(2)  }\u03BCs`;
  return `${(ns / 1_000_000).toFixed(3)  }ms`;
}

function run(name: string, fn: () => void, iterations: number): number {
  for (let i = 0; i < iterations; i++) fn();
  const start = process.hrtime.bigint();
  for (let i = 0; i < iterations; i++) fn();
  const end = process.hrtime.bigint();
  return Number(end - start) / iterations;
}

const CASES = [
  { name: "moment()", run: () => [() => moment(), () => moment2()] },
  { name: "moment([y,M,d])", run: () => [() => moment([2024, 0, 15]), () => moment2([2024, 0, 15])] },
  { name: "moment('ISO string')", run: () => [() => moment("2024-01-15T10:30:45.123Z"), () => moment2("2024-01-15T10:30:45.123Z")] },
  {
    name: "format('YYYY-MM-DD')",
    run: () => { const a = moment("2024-06-15"), b = moment2("2024-06-15"); return [() => a.format("YYYY-MM-DD"), () => b.format("YYYY-MM-DD")]; },
  },
  {
    name: "getters (7 fields)",
    run: () => {
      const a = moment("2024-06-15 10:30:45.123"), b = moment2("2024-06-15 10:30:45.123");
      return [
        () => { a.year(); a.month(); a.date(); a.hour(); a.minute(); a.second(); a.millisecond(); },
        () => { b.year(); b.month(); b.date(); b.hour(); b.minute(); b.second(); b.millisecond(); },
      ];
    },
  },
  { name: "valueOf / unix", run: () => { const a = moment("2024-06-15"), b = moment2("2024-06-15"); return [() => { a.valueOf(); a.unix(); }, () => { b.valueOf(); b.unix(); }]; } },
  { name: "clone", run: () => { const a = moment("2024-06-15"), b = moment2("2024-06-15"); return [() => a.clone(), () => b.clone()]; } },
];

const ITER = 5000;
const RUNS = 5;

// warmup all
for (const c of CASES) {
  const [f1, f2] = c.run();
  for (let i = 0; i < 500; i++) { f1(); f2(); }
}

for (const c of CASES) {
  const [fnMoment, fnMoment2] = c.run();
  const times1 = [], times2 = [];
  for (let r = 0; r < RUNS; r++) {
    times1.push(run("", fnMoment, ITER));
    times2.push(run("", fnMoment2, ITER));
  }
  times1.sort((a, b) => a - b);
  times2.sort((a, b) => a - b);
  const median1 = times1[Math.floor(RUNS / 2)];
  const median2 = times2[Math.floor(RUNS / 2)];
  const ratio = (median2 / median1 * 100).toFixed(1);
  console.log(`${c.name.padEnd(35)} ${micros(median1).padStart(10)} ${micros(median2).padStart(10)} ${ratio.padStart(6)}%`);
}
