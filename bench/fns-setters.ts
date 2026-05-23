// ── mmntjs/fns setDate/setMinutes/setMilliseconds vs date-fns ──
import { setDate, setMinutes, setMilliseconds } from "../src/fns";
import * as df from "date-fns";
import { run, micros, ITERATIONS, WARMUP } from "./lib/harness";

const d = new Date(2024, 5, 15, 10, 30, 45, 123);

type BenchCase = { name: string; run: () => [() => void, () => void] };

const CASES: BenchCase[] = [
  // ── setDate D ≤ 28 (fast path) ──
  {
    name: "setDate(D≤28)",
    run: () => [() => setDate(d, 15), () => df.setDate(d, 15)],
  },
  // ── setDate D > 28 (fallback / overflow) ──
  {
    name: "setDate(D=31)",
    run: () => [() => setDate(d, 31), () => df.setDate(d, 31)],
  },
  // ── setMinutes 0-59 (fast path) ──
  {
    name: "setMinutes(10)",
    run: () => [() => setMinutes(d, 10), () => df.setMinutes(d, 10)],
  },
  // ── setMinutes overflow (75 → 1:15) ──
  {
    name: "setMinutes(75)",
    run: () => [() => setMinutes(d, 75), () => df.setMinutes(d, 75)],
  },
  // ── setMilliseconds 0-999 (fast path) ──
  {
    name: "setMilliseconds(100)",
    run: () => [() => setMilliseconds(d, 100), () => df.setMilliseconds(d, 100)],
  },
  // ── setMilliseconds overflow ──
  {
    name: "setMilliseconds(1500)",
    run: () => [() => setMilliseconds(d, 1500), () => df.setMilliseconds(d, 1500)],
  },
];

function main(): void {
  console.log(`\n  mmntjs/fns setters  vs  date-fns  (${(ITERATIONS / 1000).toFixed(0)}k iter)\n`);
  console.log("  ".padEnd(44) + "fns (µs)".padStart(12) + "date-fns (µs)".padStart(14) + "ratio");
  console.log("  " + "─".repeat(74));

  for (const c of CASES) {
    const [fnsFn, dfFn] = c.run();
    const fnsNs = run(fnsFn, ITERATIONS, WARMUP);
    const dfNs = run(dfFn, ITERATIONS, WARMUP);
    const ratio = dfNs / fnsNs;
    const label = ratio >= 1
      ? `${ratio.toFixed(2)}x faster`
      : `${(1 / ratio).toFixed(2)}x slower`;
    console.log(
      `  ${c.name.padEnd(42)} ${micros(fnsNs).padStart(10)} ${micros(dfNs).padStart(12)}  ${label}`,
    );
  }
  console.log("");
}

main();
