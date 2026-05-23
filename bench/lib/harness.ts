export interface BenchStats {
  median: number;
  min: number;
  max: number;
}

export function micros(ns: number): string {
  if (ns < 1000) return `${ns.toFixed(0)}ns`;
  if (ns < 1_000_000) return `${(ns / 1000).toFixed(2)}\u00B5s`;
  return `${(ns / 1_000_000).toFixed(3)}ms`;
}

export function run(fn: () => void, iterations: number, warmup = 1000): number {
  for (let i = 0; i < warmup; i++) fn();
  const start = process.hrtime.bigint();
  for (let i = 0; i < iterations; i++) fn();
  const end = process.hrtime.bigint();
  return Number(end - start) / iterations;
}

export function runCold(fn: () => void): number {
  const start = process.hrtime.bigint();
  fn();
  const end = process.hrtime.bigint();
  return Number(end - start);
}

export function relativeSpread(stats: BenchStats): number {
  if (stats.median === 0) return 0;
  return (stats.max - stats.min) / stats.median;
}

export function ratioLabel(base: BenchStats, candidate: BenchStats): string {
  const ratio = ((candidate.median / base.median) * 100).toFixed(1);
  const unstable =
    base.median < 100 ||
    candidate.median < 100 ||
    relativeSpread(base) > 0.25 ||
    relativeSpread(candidate) > 0.25;
  return unstable ? `~${ratio}` : ratio;
}

export const COLD_RUNS = 20;
export const WARM_RUNS = 5;
export const ITERATIONS = 5000;
export const WARMUP = 1000;

export function fmtRatio(percent: number): string {
  return percent <= 100
    ? `${(100 / percent).toFixed(1)}x slower`
    : `${(percent / 100).toFixed(1)}x faster`;
}

export function runSuite(
  cases: { name: string; run: () => [() => void, () => void] }[],
  labelA: string,
  labelB: string,
  header: string,
) {
  const hdr = `Operation${" ".repeat(31)}${labelA.padStart(11)}${labelB.padStart(11)}${"  ratio".padStart(8)}`;
  console.log(`\n${header}`);
  console.log(`(${WARM_RUNS} runs x ${ITERATIONS} iters, warm; ~ = noisy short run)`);
  console.log(hdr);
  for (const c of cases) {
    const runsA: number[] = [];
    const runsB: number[] = [];
    for (let r = 0; r < WARM_RUNS; r++) {
      const [fnA, fnB] = c.run();
      runsA.push(run(fnA, ITERATIONS, WARMUP));
      runsB.push(run(fnB, ITERATIONS, WARMUP));
    }
    runsA.sort((a, b) => a - b);
    runsB.sort((a, b) => a - b);
    const statsA: BenchStats = {
      median: runsA[Math.floor(WARM_RUNS / 2)],
      min: runsA[0],
      max: runsA[WARM_RUNS - 1],
    };
    const statsB: BenchStats = {
      median: runsB[Math.floor(WARM_RUNS / 2)],
      min: runsB[0],
      max: runsB[WARM_RUNS - 1],
    };
    const ratio = ratioLabel(statsA, statsB);
    console.log(
      `${c.name.padEnd(35)} ${micros(statsA.median).padStart(11)} ${micros(statsB.median).padStart(11)} ${ratio.padStart(8)}%`,
    );
  }
}
