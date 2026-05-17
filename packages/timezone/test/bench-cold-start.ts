/**
 * Cold-start benchmark: compare mmntjs-timezone vs moment-timezone.
 *
 * Run: bun packages/timezone/test/bench-cold-start.ts
 *
 * Each measurement is taken in a fresh Bun subprocess to isolate module loading.
 */
/* oxlint-disable */
import { $ } from "bun";

async function measure(pkg: string): Promise<{ evalMs: number; lookupNs: number; heapKb: number }> {
  const script = `
  const t0 = performance.now();
  const mod = await import(${JSON.stringify(pkg)});
  const m = mod.default || mod;
  const t1 = performance.now();

  if (globalThis.gc) globalThis.gc();
  const h0 = process.memoryUsage().heapUsed;

  const t2 = performance.now();
  let z = null;
  if (m.tz) {
    z = m.tz.zone("America/New_York");
    if (z) { z.abbr(Date.now()); z.utcOffset(Date.now()); }
  }
  const t3 = performance.now();

  if (globalThis.gc) globalThis.gc();
  const hd = (process.memoryUsage().heapUsed - h0) / 1024;

  console.log(JSON.stringify({ ev: (t1 - t0).toFixed(3), lk: ((t3 - t2) * 1e6).toFixed(1), hp: hd.toFixed(1) }));
  `;

  const result = await $`bun --expose-gc -e ${script}`.quiet();
  const text = result.text().trim();
  const line = text
    .split("\n")
    .reverse()
    .find((l) => l.startsWith("{"));
  if (!line) throw new Error(`no JSON for ${pkg}: ${text.slice(0, 200)}`);
  return JSON.parse(line);
}

const MODULES = [
  { label: "mmntjs-tz (full)", pkg: "mmntjs-timezone" },
  { label: "mmntjs-tz (1970-2030)", pkg: "mmntjs-timezone/1970-2030" },
  { label: "mmntjs-tz (logic)", pkg: "mmntjs-timezone/logic" },
  { label: "moment-tz (full)", pkg: "moment-timezone" },
];

const TRIALS = 5;

console.log("\n=== Cold-start benchmark (median of 5, each in fresh Bun process) ===\n");
console.log(
  `${"Module".padEnd(28)} ${"Eval(ms)".padStart(10)} ${"Lookup(μs)".padStart(12)} ${"HeapΔ(KB)".padStart(10)}`,
);
console.log("-".repeat(62));

for (const mod of MODULES) {
  const evs: number[] = [];
  const lks: number[] = [];
  const hps: number[] = [];

  for (let t = 0; t < TRIALS; t++) {
    try {
      const m = await measure(mod.pkg);
      evs.push(m.evalMs);
      lks.push(m.lookupNs / 1000); // ns→μs
      hps.push(m.heapKb);
    } catch (e: any) {
      console.error(`  ${mod.label}: ${e.message}`);
    }
  }

  if (evs.length === 0) {
    console.log(`${mod.label.padEnd(28)} ${"FAIL".padStart(10)}`);
    continue;
  }

  const ev = evs.sort((a, b) => a - b)[Math.floor(evs.length / 2)];
  const lk = lks.sort((a, b) => a - b)[Math.floor(lks.length / 2)];
  const hp = hps.sort((a, b) => a - b)[Math.floor(hps.length / 2)];

  console.log(
    `${mod.label.padEnd(28)} ${ev.toFixed(2).padStart(10)} ${lk.toFixed(2).padStart(12)} ${hp.toFixed(1).padStart(10)}`,
  );
}

console.log("\nNotes:");
console.log("  Eval: dynamic import() time (module parse + instantiate)");
console.log("  Lookup: first zone() + abbr + utcOffset call (triggers lazy indexing for blob)");
console.log("  HeapΔ: heap delta after module load (with explicit GC before measure)");
