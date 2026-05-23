/* oxlint-disable */
import mmntjs from "../src/index.ts";

interface BenchResult {
  name: string;
  nsPerOp: number;
}

function run(fn: () => void, iterations: number, warmup: number): number {
  for (let i = 0; i < warmup; i++) fn();
  const start = process.hrtime.bigint();
  for (let i = 0; i < iterations; i++) fn();
  const end = process.hrtime.bigint();
  return Number(end - start) / iterations;
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
}

function sample(
  name: string,
  fn: () => void,
  iterations = 4000,
  warmup = 500,
  runs = 5,
): BenchResult {
  const samples: number[] = [];
  for (let i = 0; i < runs; i++) samples.push(run(fn, iterations, warmup));
  return { name, nsPerOp: median(samples) };
}

function assertAtMost(label: string, actual: number, max: number): void {
  if (actual > max)
    throw new Error(`${label} regression: ${actual.toFixed(1)}ns > ${max.toFixed(1)}ns`);
}

// Warmup module
mmntjs();

// ISO string → format (most common pattern)
const isoParseFmt = sample("ISO parse + format YYYY-MM-DD", () => {
  mmntjs("2024-06-15T12:30:45.123Z").format("YYYY-MM-DD");
});

// ISO string → get year
const isoParseGet = sample("ISO parse + get year", () => {
  mmntjs("2024-06-15T12:30:45.123Z").year();
});

// Array input → format
const arrParseFmt = sample("array [y,M,d] + format", () => {
  mmntjs([2024, 5, 15, 12, 30]).format("YYYY-MM-DD HH:mm");
});

// Object input → format
const objParseFmt = sample("object {y,M,d} + format", () => {
  mmntjs({ year: 2024, month: 6, day: 15, hour: 12, minute: 30 }).format("YYYY-MM-DD HH:mm");
});

// String + format → get valueOf
const strFmtParse = sample("string + format parse + valueOf", () => {
  mmntjs("20240615T123045", "YYYYMMDD[T]HHmmss").valueOf();
});

// Timestamp (number) → format
const tsParseFmt = sample("timestamp ms + format", () => {
  mmntjs(1718469045123).format("YYYY-MM-DD HH:mm:ss");
});

// moment.utc ISO → format
const utcParseFmt = sample("moment.utc ISO + format", () => {
  mmntjs.utc("2024-06-15T12:30:45.123Z").format("YYYY-MM-DD HH:mm:ss");
});

// moment.utc ISO → toISOString
const utcParseIso = sample("moment.utc ISO + toISOString", () => {
  mmntjs.utc("2024-06-15T12:30:45.123Z").toISOString();
});

// Clone + format (parse once, eval many)
const m = mmntjs("2024-06-15T12:30:45.123Z");
const cloneFormat = sample("clone + format", () => {
  m.clone().format("YYYY-MM-DD HH:mm:ss.SSS");
});

// Chained: parse → set → format
const parseSetFmt = sample("parse → set year → format", () => {
  mmntjs("2024-06-15").year(2020).format("YYYY-MM-DD");
});

// parse → startOf → format
const parseStartFmt = sample("parse → startOf month → format", () => {
  mmntjs("2024-06-15").startOf("month").format("YYYY-MM-DD");
});

const results = [
  isoParseFmt,
  isoParseGet,
  arrParseFmt,
  objParseFmt,
  strFmtParse,
  tsParseFmt,
  utcParseFmt,
  utcParseIso,
  cloneFormat,
  parseSetFmt,
  parseStartFmt,
];

// Assert regression thresholds (2x current baseline for headroom)
assertAtMost("ISO parse + format", isoParseFmt.nsPerOp, 7000);
assertAtMost("ISO parse + get year", isoParseGet.nsPerOp, 4000);
assertAtMost("array parse + format", arrParseFmt.nsPerOp, 12000);
assertAtMost("object parse + format", objParseFmt.nsPerOp, 12000);
assertAtMost("string+fmt parse + valueOf", strFmtParse.nsPerOp, 12000);
assertAtMost("timestamp + format", tsParseFmt.nsPerOp, 4000);
assertAtMost("moment.utc ISO + format", utcParseFmt.nsPerOp, 7000);
assertAtMost("moment.utc ISO + toISOString", utcParseIso.nsPerOp, 7000);
assertAtMost("clone + format", cloneFormat.nsPerOp, 3000);
assertAtMost("parse → set → format", parseSetFmt.nsPerOp, 8000);
assertAtMost("parse → startOf → format", parseStartFmt.nsPerOp, 7000);

console.log("parse-eval regression guard");
for (const r of results) {
  console.log(`${r.name}: ${r.nsPerOp.toFixed(1)}ns`);
}
