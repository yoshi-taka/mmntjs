/* oxlint-disable */
import mmntjs from "../src/index.ts";
import { installTimezone } from "../packages/timezone/src/install.ts";

installTimezone(mmntjs as any);
const moment = mmntjs as any;

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

// Warmup — pre-load timezone data
moment();
moment.utc(1718469045123).tz("America/New_York").utcOffset();

// ── Format token dispatch ──
const fmtShort = sample("format YYYY-MM-DD", () => {
  moment(1718469045123).format("YYYY-MM-DD");
});

const fmtLong = sample("format YYYY-MM-DD HH:mm:ss.SSS", () => {
  moment(1718469045123).format("YYYY-MM-DD HH:mm:ss.SSS");
});

const fmtIso = sample("format YYYY-MM-DD[T]HH:mm:ss.SSS[Z]", () => {
  moment(1718469045123).format("YYYY-MM-DD[T]HH:mm:ss.SSS[Z]");
});

const fmtLocale = sample("format LL (en)", () => {
  moment(1718469045123).format("LL");
});

// ── Timezone zone lookup ──
const tzNow = moment(1718469045123);

const tzGetZone = sample("tz zone getter", () => {
  tzNow.tz();
});

const tzGetName = sample("tz zone name", () => {
  tzNow.tz("America/New_York");
});

const tzOffset = sample("tz utcOffset after lookup", () => {
  tzNow.tz("America/New_York").utcOffset();
});

const tzAbbr = sample("tz zoneAbbr after lookup", () => {
  tzNow.tz("America/New_York").zoneAbbr();
});

// ── Locale data access ──
const localeGet = sample("locale get (en)", () => {
  moment(1718469045123).locale("en");
});

const localeSwitch = sample("locale switch (fr→de→ja)", () => {
  moment(1718469045123).locale("fr").locale("de").locale("ja");
});

const localeFmt = sample("locale format LL (fr)", () => {
  moment(1718469045123).locale("fr").format("LL");
});

const results = [
  fmtShort,
  fmtLong,
  fmtIso,
  fmtLocale,
  tzGetZone,
  tzGetName,
  tzOffset,
  tzAbbr,
  localeGet,
  localeSwitch,
  localeFmt,
];

assertAtMost("format YYYY-MM-DD", fmtShort.nsPerOp, 1000);
assertAtMost("format YYYY-MM-DD HH:mm:ss.SSS", fmtLong.nsPerOp, 3000);
assertAtMost("format LL (en)", fmtLocale.nsPerOp, 4000);
assertAtMost("tz zone getter", tzGetZone.nsPerOp, 50000);
assertAtMost("tz zone name", tzGetName.nsPerOp, 6000);
assertAtMost("tz utcOffset", tzOffset.nsPerOp, 12000);
assertAtMost("tz zoneAbbr", tzAbbr.nsPerOp, 12000);
assertAtMost("locale get (en)", localeGet.nsPerOp, 2000);
assertAtMost("locale switch (fr→de→ja)", localeSwitch.nsPerOp, 8000);
assertAtMost("locale format LL (fr)", localeFmt.nsPerOp, 8000);

console.log("lookup latency guard");
for (const r of results) {
  console.log(`${r.name}: ${r.nsPerOp.toFixed(1)}ns`);
}
