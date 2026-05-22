import mmntjs from "../dist/index.js";

function micros(ns: number): string {
  if (ns < 1000) { return `${ns.toFixed(0)}ns`; }
  if (ns < 1_000_000) { return `${(ns / 1000).toFixed(2)}\u03BCs`; }
  return `${(ns / 1_000_000).toFixed(3)}ms`;
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

const TD = (globalThis as unknown as { Temporal: typeof TD }).Temporal as {
  Now: { plainDateTimeISO: () => { year: number; month: number; day: number; hour: number; minute: number; second: number; millisecond: number } };
  PlainDate: {
    new (y: number, m: number, d: number): {
      year: number; month: number; day: number;
      add(d: { days?: number; months?: number }): unknown;
      since(o: unknown): { days: number };
      toString(): string;
      with(d: { day?: number; month?: number; year?: number }): unknown;
      daysInMonth: number;
    };
    from(s: string): unknown;
  };
  PlainDateTime: new (y: number, m: number, d: number, h?: number, min?: number, s?: number, ms?: number) => {
    year: number; month: number; day: number;
    hour: number; minute: number; second: number; millisecond: number;
    add(d: { days?: number; months?: number }): unknown;
    since(o: unknown): { days: number; hours?: number };
    toString(): string;
    toPlainDate(): { year: number; month: number; day: number };
    daysInMonth: number;
  };
};

const COLD_RUNS = 20;
const WARM_RUNS = 5;
const ITER = 5000;
const WARMUP = 1000;

const dateA = new Date(2024, 5, 15);
const dateB = new Date(2024, 7, 1);

// Shared fixtures
const ISO_DATE = "2024-06-15";
const ISO_DT = "2024-06-15T10:30:00";

const pdtA = new TD.PlainDateTime(2024, 6, 15, 10, 30, 0, 0);
const pdtB = new TD.PlainDateTime(2024, 8, 1, 0, 0, 0, 0);
const pdA_dateOnly = new TD.PlainDate(2024, 6, 15);

// Reusable fixtures for warm-path (avoid construction overhead in loop)
let _pd = pdtA;

const CASES = [
  // ── create ──
  {
    name: "now (date+time)",
    run: () => [() => mmntjs(), () => TD.Now.plainDateTimeISO()],
  },
  // ── parse ──
  {
    name: "parse date-only ISO",
    run: () => [() => mmntjs(ISO_DATE), () => TD.PlainDate.from(ISO_DATE)],
  },
  {
    name: "parse datetime ISO",
    run: () => [() => mmntjs(ISO_DT), () => TD.PlainDateTime.from(ISO_DT)],
  },
  {
    name: "parse [y,M,d]",
    run: () => [() => mmntjs([2024, 5, 15]), () => new TD.PlainDate(2024, 6, 15)],
  },
  // ── getters (note: Temporal uses property access, mmntjs uses method call) ──
  {
    name: "get year",
    run: () => {
      const m = mmntjs(dateA);
      const pd = pdA_dateOnly;
      return [() => m.year(), () => pd.year];
    },
  },
  {
    name: "get year+month+day (3 gets)",
    run: () => {
      const m = mmntjs(dateA);
      const pd = pdA_dateOnly;
      return [
        () => { m.year(); m.month(); m.date(); },
        () => { pd.year; pd.month; pd.day; },
      ];
    },
  },
  // ── add ──
  {
    name: "add 1 day (mut vs immutable)",
    run: () => {
      const m = mmntjs(dateA);
      let pd = pdtA;
      return [
        () => m.add(1, "day"),
        () => { pd = pd.add({ days: 1 }) as typeof pdtA; },
      ];
    },
  },
  {
    name: "add 1 month (mut vs immutable)",
    run: () => {
      const m = mmntjs(dateA);
      let pd = pdtA;
      return [
        () => m.add(1, "month"),
        () => { pd = pd.add({ months: 1 }) as typeof pdtA; },
      ];
    },
  },
  // ── diff ──
  {
    name: "diff in days",
    run: () => {
      const m = mmntjs(dateA);
      const mB = mmntjs(dateB);
      const pa = pdtA;
      const pb = pdtB;
      return [
        () => m.diff(mB, "days"),
        () => pa.since(pb).days,
      ];
    },
  },
  // ── format / stringify ──
  {
    name: "toISOString (date+time)",
    run: () => {
      const m = mmntjs("2024-06-15T10:30:00");
      const pd = pdtA;
      return [() => m.toISOString(), () => pd.toString()];
    },
  },
  // ── startOf ──
  {
    name: "startOf month (mut vs immutable)",
    run: () => {
      const m = mmntjs("2024-06-15");
      const pd = pdA_dateOnly;
      return [
        () => m.startOf("month"),
        () => pd.with({ day: 1 }),
      ];
    },
  },
  // ── daysInMonth ──
  {
    name: "daysInMonth (method vs property)",
    run: () => {
      const m = mmntjs(dateA);
      const pd = pdA_dateOnly;
      return [() => m.daysInMonth(), () => pd.daysInMonth];
    },
  },
  // ── setters (Temporal無いのでmmntjs単独、tmp側はnoop) ──
  {
    name: "[mmntjs] set hour+min+sec+ms (chained)",
    run: () => {
      const m = mmntjs("2024-06-15T10:30:45.123");
      return [() => { m.hour(0).minute(0).second(0).millisecond(0); }, () => {}];
    },
  },
  {
    name: "[mmntjs] set year+month+date (chained)",
    run: () => {
      const m = mmntjs("2024-06-15");
      return [() => { m.year(2020).month(0).date(1); }, () => {}];
    },
  },
];

console.log(
  "Operation                           cold m2   cold tmp       %   warm m2   warm tmp       %",
);
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
  const coldRatio = coldT === 0 ? "-" : ((coldT / coldM2) * 100).toFixed(1);

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
  const warmRatio = warmT === 0 ? "-" : ((warmT / warmM2) * 100).toFixed(1);

  console.log(
    `${c.name.padEnd(35)} ${micros(coldM2).padStart(10)} ${micros(coldT).padStart(10)} ${coldRatio.padStart(6)}%  ${micros(warmM2).padStart(10)} ${micros(warmT).padStart(10)} ${warmRatio.padStart(6)}%`,
  );
}
