import mmntjs from "../src/index.ts";

interface BenchResult {
  name: string;
  nsPerOp: number;
}

function run(fn: () => void, iterations: number, warmup: number): number {
  for (let i = 0; i < warmup; i++) {
    fn();
  }
  const start = process.hrtime.bigint();
  for (let i = 0; i < iterations; i++) {
    fn();
  }
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
  for (let i = 0; i < runs; i++) {
    samples.push(run(fn, iterations, warmup));
  }
  return { name, nsPerOp: median(samples) };
}

function assertAtMost(label: string, actual: number, max: number): void {
  if (actual > max) {
    throw new Error(`${label} regression: ${actual.toFixed(1)}ns > ${max.toFixed(1)}ns`);
  }
}

function assertRatio(label: string, actual: number, max: number): void {
  if (actual > max) {
    throw new Error(`${label} regression: ratio ${actual.toFixed(2)} > ${max.toFixed(2)}`);
  }
}

const utcStart = sample("utc startOf day negative", () => {
  mmntjs.utc(-2208988800000).startOf("day").valueOf();
});

const utcEnd = sample("utc endOf day negative", () => {
  mmntjs.utc(-2208988800000).endOf("day").valueOf();
});

const utcDiff = sample("utc diff day edge", () => {
  mmntjs.utc(-2208988800000).diff(mmntjs.utc(-2208902400000), "day");
});

const shortInvalid = sample("short invalid parse", () => {
  mmntjs("2024-99-99T25:61:61").isValid();
});

const longInvalid = sample("long invalid parse", () => {
  mmntjs(`${"2024-99-99T25:61:61 ".repeat(8)}tail`).isValid();
});

const monthSmall = sample("month normalize small", () => {
  mmntjs.utc([2024, 0, 31]).month(12).valueOf();
});

const monthLarge = sample("month normalize large", () => {
  mmntjs.utc([2024, 0, 31]).month(-120000).valueOf();
});

const parseGrowth = longInvalid.nsPerOp / shortInvalid.nsPerOp;
const monthGrowth = monthLarge.nsPerOp / monthSmall.nsPerOp;

assertAtMost(utcStart.name, utcStart.nsPerOp, 1200);
assertAtMost(utcEnd.name, utcEnd.nsPerOp, 1200);
assertAtMost(utcDiff.name, utcDiff.nsPerOp, 1400);
assertRatio("invalid parse complexity", parseGrowth, 12);
assertRatio("month normalization complexity", monthGrowth, 3.5);

console.log("bench regression guard");
for (const result of [
  utcStart,
  utcEnd,
  utcDiff,
  shortInvalid,
  longInvalid,
  monthSmall,
  monthLarge,
]) {
  console.log(`${result.name}: ${result.nsPerOp.toFixed(1)}ns`);
}
console.log(`invalid parse growth: ${parseGrowth.toFixed(2)}x`);
console.log(`month normalization growth: ${monthGrowth.toFixed(2)}x`);
