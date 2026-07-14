import mmntjs from "../src/index.ts";
import { getLocale } from "../src/locale";
import { parseString } from "../src/parse";
import type { ParseLocale } from "../src/parse-locale";

interface BenchResult {
  name: string;
  nsPerOp: number;
}

function run(fn: () => void, iterations: number, warmup: number): number {
  for (let i = 0; i < warmup; i++) fn();
  const start = process.hrtime.bigint();
  for (let i = 0; i < iterations; i++) fn();
  return Number(process.hrtime.bigint() - start) / iterations;
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
}

function sample(name: string, fn: () => void): BenchResult {
  const samples: number[] = [];
  for (let i = 0; i < 5; i++) samples.push(run(fn, 20_000, 2_000));
  return { name, nsPerOp: median(samples) };
}

const en = getLocale("en") as unknown as ParseLocale;
const shapes: [string, string, string | string[] | undefined][] = [
  ["extended ISO", "2024-06-15T12:30:45.123Z", undefined],
  ["extended ISO variable fraction", "2024-06-15T12:30:45.123456Z", undefined],
  ["extended ISO comma fraction offset", "2024-06-15T12:30:45,12-04:30", undefined],
  ["basic ISO", "20240615T123045.123Z", undefined],
  ["basic ISO offset", "20240615T123045.123+0900", undefined],
  ["basic ISO variable fraction", "20240615T123045.123456Z", undefined],
  ["format", "20240615T123045", "YYYYMMDD[T]HHmmss"],
  ["format array", "2024/06/15", ["YYYY-MM-DD", "YYYY/MM/DD", "DD/MM/YYYY"]],
  ["locale month", "15 January 2024", "DD MMMM YYYY"],
  ["invalid", "2024-99-99T25:61:61", undefined],
];

console.log("parse shape benchmark");
for (const [name, input, format] of shapes) {
  const raw = sample(`raw ${name}`, () => {
    parseString(input, format, en);
  });
  const publicApi = sample(`moment ${name}`, () => {
    mmntjs(input, format as string | string[] | undefined).isValid();
  });
  console.log(`${raw.name}: ${raw.nsPerOp.toFixed(1)}ns`);
  console.log(`${publicApi.name}: ${publicApi.nsPerOp.toFixed(1)}ns`);
}
