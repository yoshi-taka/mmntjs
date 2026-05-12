import moment2 from "../dist/index.js";

function micros(ns: number): string {
  if (ns < 1000) {return `${ns.toFixed(0)}ns`;}
  if (ns < 1_000_000) {return `${(ns / 1000).toFixed(2)}\u03BCs`;}
  return `${(ns / 1_000_000).toFixed(3)}ms`;
}

function run(fn: () => void, iter: number, warmup = 500): number {
  for (let i = 0; i < warmup; i++) {fn();}
  const start = process.hrtime.bigint();
  for (let i = 0; i < iter; i++) {fn();}
  const end = process.hrtime.bigint();
  return Number(end - start) / iter;
}

function runCold(fn: () => void): number {
  const start = process.hrtime.bigint();
  fn();
  const end = process.hrtime.bigint();
  return Number(end - start);
}

const TD: {
  Now: { plainDateISO(): { year: number; month: number; day: number } };
  PlainDate: { new (year: number, month: number, day: number): PlainDate; from(s: string): PlainDate };
  PlainDateTime: new (year: number, month: number, day: number, hour?: number, minute?: number, second?: number, ms?: number) => { year: number; month: number; day: number; hour: number; minute: number; second: number; millisecond: number };
} = (globalThis as unknown as { Temporal: typeof TD }).Temporal;

interface PlainDate {
  readonly year: number;
  readonly month: number;
  readonly day: number;
  add(duration: { days?: number; months?: number; years?: number }): PlainDate;
  since(other: PlainDate): { days: number };
  toString(): string;
  with(duration: { day?: number; month?: number; year?: number }): PlainDate;
  readonly daysInMonth: number;
}

const COLD_RUNS = 20;
const WARM_RUNS = 5;
const ITER = 5000;
const WARMUP = 1000;

const isoStr = "2024-06-15";
const dateA = new Date(2024, 5, 15);
const dateB = new Date(2024, 7, 1);
const pdA = new TD.PlainDate(2024, 6, 15);
const pdB = new TD.PlainDate(2024, 8, 1);

const CASES = [
  {
    name: "now/create",
    run: () => [() => moment2(), () => TD.Now.plainDateISO()],
  },
  {
    name: "parse ISO string",
    run: () => [() => moment2(isoStr), () => TD.PlainDate.from(isoStr)],
  },
  {
    name: "parse [y,M,d]",
    run: () => [() => moment2([2024, 5, 15]), () => new TD.PlainDate(2024, 6, 15)],
  },
  {
    name: "get year",
    run: () => {
      const m = moment2(dateA);
      const pd = pdA;
      return [() => m.year(), () => pd.year];
    },
  },
  {
    name: "add 1 day",
    run: () => {
      const m = moment2(dateA);
      let pd = pdA;
      return [() => m.add(1, "day"), () => { pd = pd.add({ days: 1 }); }];
    },
  },
  {
    name: "add 1 month",
    run: () => {
      const m = moment2(dateA);
      let pd = pdA;
      return [() => m.add(1, "month"), () => { pd = pd.add({ months: 1 }); }];
    },
  },
  {
    name: "diff in days",
    run: () => {
      const m = moment2(dateA);
      const mB = moment2(dateB);
      const pa = pdA;
      const pb = pdB;
      return [() => m.diff(mB, "days"), () => pa.since(pb).days];
    },
  },
  {
    name: "format YYYY-MM-DD",
    run: () => {
      const m = moment2(dateA);
      const pd = pdA;
      return [() => m.format("YYYY-MM-DD"), () => pd.toString()];
    },
  },
  {
    name: "startOf month",
    run: () => {
      const m = moment2("2024-06-15");
      const pd = new TD.PlainDate(2024, 6, 15);
      return [() => m.startOf("month"), () => pd.with({ day: 1 })];
    },
  },
  {
    name: "daysInMonth",
    run: () => {
      const m = moment2(dateA);
      const pd = pdA;
      return [() => m.daysInMonth(), () => pd.daysInMonth];
    },
  },
];

console.log("Operation                           cold m2   cold tmp       %   warm m2   warm tmp       %");
for (const c of CASES) {
  const cm: number[] = [], ct: number[] = [];
  for (let r = 0; r < COLD_RUNS; r++) {
    const [fnM2, fnT] = c.run();
    cm.push(runCold(fnM2));
    ct.push(runCold(fnT));
  }
  cm.sort((a, b) => a - b);
  ct.sort((a, b) => a - b);
  const coldM2 = cm[Math.floor(COLD_RUNS / 2)];
  const coldT = ct[Math.floor(COLD_RUNS / 2)];
  const coldRatio = (coldT / coldM2 * 100).toFixed(1);

  const tm: number[] = [], tt: number[] = [];
  for (let r = 0; r < WARM_RUNS; r++) {
    const [fnM2, fnT] = c.run();
    tm.push(run(fnM2, ITER, WARMUP));
    tt.push(run(fnT, ITER, WARMUP));
  }
  tm.sort((a, b) => a - b);
  tt.sort((a, b) => a - b);
  const warmM2 = tm[Math.floor(WARM_RUNS / 2)];
  const warmT = tt[Math.floor(WARM_RUNS / 2)];
  const warmRatio = (warmT / warmM2 * 100).toFixed(1);

  console.log(`${c.name.padEnd(35)} ${micros(coldM2).padStart(10)} ${micros(coldT).padStart(10)} ${coldRatio.padStart(6)}%  ${micros(warmM2).padStart(10)} ${micros(warmT).padStart(10)} ${warmRatio.padStart(6)}%`);
}
