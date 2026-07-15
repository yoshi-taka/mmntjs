import mmntjs from "../src/index.ts";
import { getLocale } from "../src/locale";
import { parseString } from "../src/parse";
import type { ParseLocale } from "../src/parse";

const INPUT = "2024-01-15T10:30:45.123Z";
const FORMAT = "YYYY-MM-DDTHH:mm:ss.SSSZ";
const BASIC_INPUT = "20240615T123045";
const BASIC_FORMAT = "YYYYMMDD[T]HHmmss";
const SLASH_INPUT = "2024/06/15";
const SLASH_FORMAT = "YYYY/MM/DD";
const ENGLISH_LONG_MONTH_INPUT = "15 June 2024";
const ENGLISH_LONG_MONTH_FORMAT = "DD MMMM YYYY";
const DATE_INPUT = new Date("2024-01-15T10:30:45.123Z");
const ITERATIONS = 50_000;
const SAMPLES = 7;
const en = getLocale("en") as unknown as ParseLocale;

function run(fn: () => unknown, iterations: number): number {
  for (let i = 0; i < 2_000; i++) fn();
  const start = process.hrtime.bigint();
  for (let i = 0; i < iterations; i++) fn();
  return Number(process.hrtime.bigint() - start) / iterations;
}

function median(values: number[]): number {
  values.sort((a, b) => a - b);
  return values[Math.floor(values.length / 2)];
}

function benchmark(label: string, fn: () => unknown): void {
  const samples: number[] = [];
  for (let i = 0; i < SAMPLES; i++) samples.push(run(fn, ITERATIONS));
  console.log(`${label}: ${median(samples).toFixed(1)}ns`);
}

console.log("format parse phase benchmark");
benchmark("parseString(format)", () => parseString(INPUT, FORMAT, en));
benchmark("public moment(input, format)", () => mmntjs(INPUT, FORMAT).valueOf());
benchmark("public moment(input)", () => mmntjs(INPUT).valueOf());

const retained = (globalThis as { retained?: unknown[] }).retained;
if (retained) {
  throw new Error("retained benchmark values must not exist before setup");
}

if (process.env.RETAIN === "parsed") {
  (globalThis as { retained?: unknown[] }).retained = Array.from(
    { length: ITERATIONS },
    () => parseString(INPUT, FORMAT, en),
  );
  console.log(`retained ${ITERATIONS} ParsedData values for heap profiling`);
} else if (process.env.RETAIN === "moment-format") {
  (globalThis as { retained?: unknown[] }).retained = Array.from(
    { length: ITERATIONS },
    () => mmntjs(INPUT, FORMAT),
  );
  console.log(`retained ${ITERATIONS} Moment values from formatted ISO input for heap profiling`);
} else if (process.env.RETAIN === "moment-iso") {
  (globalThis as { retained?: unknown[] }).retained = Array.from(
    { length: ITERATIONS },
    () => mmntjs(INPUT),
  );
  console.log(`retained ${ITERATIONS} Moment values from ISO input for heap profiling`);
} else if (process.env.RETAIN === "moment-basic-format") {
  (globalThis as { retained?: unknown[] }).retained = Array.from(
    { length: ITERATIONS },
    () => mmntjs(BASIC_INPUT, BASIC_FORMAT),
  );
  console.log(`retained ${ITERATIONS} Moment values from basic formatted input for heap profiling`);
} else if (process.env.RETAIN === "moment-slash-format") {
  (globalThis as { retained?: unknown[] }).retained = Array.from(
    { length: ITERATIONS },
    () => mmntjs(SLASH_INPUT, SLASH_FORMAT),
  );
  console.log(`retained ${ITERATIONS} Moment values from slash formatted input for heap profiling`);
} else if (process.env.RETAIN === "moment-english-long-month-format") {
  (globalThis as { retained?: unknown[] }).retained = Array.from(
    { length: ITERATIONS },
    () => mmntjs(ENGLISH_LONG_MONTH_INPUT, ENGLISH_LONG_MONTH_FORMAT),
  );
  console.log(`retained ${ITERATIONS} Moment values from English long-month formatted input for heap profiling`);
} else if (process.env.RETAIN === "moment-date") {
  (globalThis as { retained?: unknown[] }).retained = Array.from(
    { length: ITERATIONS },
    () => mmntjs(DATE_INPUT),
  );
  console.log(`retained ${ITERATIONS} Moment values from Date input for heap profiling`);
}
