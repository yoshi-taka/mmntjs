import mmntjs from "mmntjs";
import moment from "../moment/moment.js";
import { runCold, micros } from "./lib/harness";

// ─────────────────────────────────────────────────────────
// First-call latency diagnostics
//
// Measures the time to invoke an operation for the first
// time after module load.  This is NOT true process
// cold-start — both modules are already loaded into memory.
// It captures JIT-compilation overhead, Shape allocation,
// and cache priming.
//
// Diagnostic use only — not suitable for marketing claims.
// High variance expected (20-30% CV).
// ─────────────────────────────────────────────────────────

interface ColdCase {
  name: string;
  run: () => [() => number, () => number]; // returns [moment_ns, mmntjs_ns]
}

const COLD_RUNS = 20;

// Each run measures the first call after a fresh import.
// We avoid re-importing within the loop; instead we create
// the closure fresh each iteration via `run()` returning
// the measurement functions.

const CASES: ColdCase[] = [
  {
    name: "moment()",
    run: () => {
      const startM = process.hrtime.bigint();
      moment();
      const tM = Number(process.hrtime.bigint() - startM);
      const startM2 = process.hrtime.bigint();
      mmntjs();
      const tM2 = Number(process.hrtime.bigint() - startM2);
      return [() => tM, () => tM2];
    },
  },
  {
    name: "format('YYYY-MM-DD')",
    run: () => {
      const m = moment("2024-06-15"), m2 = mmntjs("2024-06-15");
      const startM = process.hrtime.bigint();
      m.format("YYYY-MM-DD");
      const tM = Number(process.hrtime.bigint() - startM);
      const startM2 = process.hrtime.bigint();
      m2.format("YYYY-MM-DD");
      const tM2 = Number(process.hrtime.bigint() - startM2);
      return [() => tM, () => tM2];
    },
  },
  {
    name: "add(1,'day')",
    run: () => {
      const startM = process.hrtime.bigint();
      moment("2024-06-15").add(1, "day");
      const tM = Number(process.hrtime.bigint() - startM);
      const startM2 = process.hrtime.bigint();
      mmntjs("2024-06-15").add(1, "day");
      const tM2 = Number(process.hrtime.bigint() - startM2);
      return [() => tM, () => tM2];
    },
  },
  {
    name: "startOf('day')",
    run: () => {
      const startM = process.hrtime.bigint();
      moment("2024-06-15").startOf("day");
      const tM = Number(process.hrtime.bigint() - startM);
      const startM2 = process.hrtime.bigint();
      mmntjs("2024-06-15").startOf("day");
      const tM2 = Number(process.hrtime.bigint() - startM2);
      return [() => tM, () => tM2];
    },
  },
  {
    name: "set year",
    run: () => {
      const startM = process.hrtime.bigint();
      moment("2024-06-15").year(2020);
      const tM = Number(process.hrtime.bigint() - startM);
      const startM2 = process.hrtime.bigint();
      mmntjs("2024-06-15").year(2020);
      const tM2 = Number(process.hrtime.bigint() - startM2);
      return [() => tM, () => tM2];
    },
  },
  {
    name: "diff('days')",
    run: () => {
      const a = moment("2024-06-15"), b = moment("2024-07-01");
      const c = mmntjs("2024-06-15"), d = mmntjs("2024-07-01");
      const startM = process.hrtime.bigint();
      a.diff(b, "days");
      const tM = Number(process.hrtime.bigint() - startM);
      const startM2 = process.hrtime.bigint();
      c.diff(d, "days");
      const tM2 = Number(process.hrtime.bigint() - startM2);
      return [() => tM, () => tM2];
    },
  },
  {
    name: "clone",
    run: () => {
      const m = moment("2024-06-15"), m2 = mmntjs("2024-06-15");
      const startM = process.hrtime.bigint();
      m.clone();
      const tM = Number(process.hrtime.bigint() - startM);
      const startM2 = process.hrtime.bigint();
      m2.clone();
      const tM2 = Number(process.hrtime.bigint() - startM2);
      return [() => tM, () => tM2];
    },
  },
  {
    name: "duration(12345)",
    run: () => {
      const startM = process.hrtime.bigint();
      moment.duration(12345);
      const tM = Number(process.hrtime.bigint() - startM);
      const startM2 = process.hrtime.bigint();
      mmntjs.duration(12345);
      const tM2 = Number(process.hrtime.bigint() - startM2);
      return [() => tM, () => tM2];
    },
  },
  {
    name: "moment.utc('ISO string')",
    run: () => {
      const startM = process.hrtime.bigint();
      moment.utc("2024-01-15");
      const tM = Number(process.hrtime.bigint() - startM);
      const startM2 = process.hrtime.bigint();
      mmntjs.utc("2024-01-15");
      const tM2 = Number(process.hrtime.bigint() - startM2);
      return [() => tM, () => tM2];
    },
  },
  {
    name: "format('LL')",
    run: () => {
      const m = moment("2024-06-15"), m2 = mmntjs("2024-06-15");
      const startM = process.hrtime.bigint();
      m.format("LL");
      const tM = Number(process.hrtime.bigint() - startM);
      const startM2 = process.hrtime.bigint();
      m2.format("LL");
      const tM2 = Number(process.hrtime.bigint() - startM2);
      return [() => tM, () => tM2];
    },
  },
];

const HEADER = "First-call latency — Diagnostic";
const SEP = "=".repeat(HEADER.length);

console.log(HEADER);
console.log(SEP);
console.log("");
console.log("Measures the first invocation of each operation after module load.");
console.log("This captures JIT-compilation overhead, Shape allocation, and cache");
console.log("priming — NOT true process cold-start.  Both modules are already loaded.");
console.log("High variance expected (20-30% CV).  For diagnostic use only.");
console.log("");

console.log(
  "Operation                              moment     mmntjs    ratio",
);

for (const c of CASES) {
  const tMom: number[] = [];
  const tM2: number[] = [];

  for (let r = 0; r < COLD_RUNS; r++) {
    const [fnMom, fnM2] = c.run();
    tMom.push(fnMom());
    tM2.push(fnM2());
  }

  tMom.sort((a, b) => a - b);
  tM2.sort((a, b) => a - b);
  const medMom = tMom[Math.floor(COLD_RUNS / 2)];
  const medM2 = tM2[Math.floor(COLD_RUNS / 2)];
  const ratio = medMom === 0 ? "-" : ((medM2 / medMom) * 100).toFixed(1);

  console.log(
    `${c.name.padEnd(35)} ${micros(medMom).padStart(10)} ${micros(medM2).padStart(10)} ${ratio.padStart(8)}%`,
  );
}

console.log("");
console.log(`% = mmntjs / moment x 100. Lower = mmntjs faster.`);
console.log(`Median of ${COLD_RUNS} isolated first-call samples.`);
