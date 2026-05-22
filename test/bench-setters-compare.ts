// Benchmark: compare 3 time-of-day setter approaches
// 1) Date setter mutation (d.setHours/m/s/ms)
// 2) epoch delta + setTime
// 3) pure arithmetic + offset verification (DST guard)
//
// Usage:
//   bun test/bench-setters-compare.ts
//   node test/bench-setters-compare.ts

import mmntjs from "mmntjs";

const HOUR_MS = 3600000;

const ITER = 20000;
const WARMUP = 500;
const RUNS = 7;

interface BenchResult {
  median: number;
  min: number;
  max: number;
}

function toNs(t: bigint, start: bigint): number {
  return Number(t - start);
}

function median(arr: number[]): number {
  const s = [...arr].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)];
}

function micros(ns: number): string {
  if (ns < 1000) {
    return `${ns.toFixed(0)}ns`;
  }
  if (ns < 1_000_000) {
    return `${(ns / 1000).toFixed(2)}μs`;
  }
  return `${(ns / 1_000_000).toFixed(3)}ms`;
}

function runWarm(fn: () => void): BenchResult {
  const times: number[] = [];
  for (let r = 0; r < RUNS; r++) {
    for (let w = 0; w < WARMUP; w++) {
      fn();
    }
    const start = process.hrtime.bigint();
    for (let i = 0; i < ITER; i++) {
      fn();
    }
    const end = process.hrtime.bigint();
    times.push(toNs(end, start) / ITER);
  }
  return {
    median: median(times),
    min: Math.min(...times),
    max: Math.max(...times),
  };
}

// ── Test subjects ──

function localDate(): Date {
  return new Date(2024, 5, 15, 10, 30, 45, 123);
}

// offset probe matching _tzOffsetAt
const _probeDate = new Date(0);
const _probeCache: { t: number; offset: number } = { t: NaN, offset: NaN };
function offsetAt(t: number): number {
  if (t === _probeCache.t) {
    return _probeCache.offset;
  }
  _probeDate.setTime(t);
  _probeCache.t = t;
  _probeCache.offset = -_probeDate.getTimezoneOffset();
  return _probeCache.offset;
}

// ── Hour benchmark ──

function benchHourLocal(label: string) {
  const d = localDate();
  const t0 = d.getTime();
  const off0 = -d.getTimezoneOffset();

  // Approach 1: Date.setHours (single)
  const r1 = runWarm(() => {
    d.setHours(12);
  });

  // Approach 2: epoch delta + setTime (single)
  const r2 = runWarm(() => {
    d.setTime(d.getTime() + (12 - 10) * HOUR_MS);
  });

  // Approach 3: arithmetic + DST guard
  const r3 = runWarm(() => {
    const delta = (12 - 10) * HOUR_MS;
    const newT = t0 + delta;
    if (offsetAt(newT) === off0) {
      d.setTime(newT);
    } else {
      d.setHours(12);
    }
  });

  console.log(
    `${label.padEnd(40)} ${micros(r1.median).padStart(10)} ${micros(r2.median).padStart(10)} ${micros(r3.median).padStart(10)}`,
  );
}

function benchMinuteLocal(label: string) {
  const d = localDate();

  // Approach 1: Date.setMinutes (single)
  const r1 = runWarm(() => {
    d.setMinutes(45);
  });

  // Approach 2: epoch delta + setTime (single)
  const r2 = runWarm(() => {
    d.setTime(d.getTime() + (45 - 30) * 60000);
  });

  console.log(
    `${label.padEnd(40)} ${micros(r1.median).padStart(10)} ${micros(r2.median).padStart(10)}           `,
  );
}

function benchSecondLocal(label: string) {
  const d = localDate();

  const r1 = runWarm(() => {
    d.setSeconds(0);
  });
  const r2 = runWarm(() => {
    d.setTime(d.getTime() + (0 - 45) * 1000);
  });

  console.log(
    `${label.padEnd(40)} ${micros(r1.median).padStart(10)} ${micros(r2.median).padStart(10)}           `,
  );
}

function benchMsLocal(label: string) {
  const d = localDate();

  const r1 = runWarm(() => {
    d.setMilliseconds(0);
  });
  const r2 = runWarm(() => {
    d.setTime(d.getTime() + (0 - 123));
  });

  console.log(
    `${label.padEnd(40)} ${micros(r1.median).padStart(10)} ${micros(r2.median).padStart(10)}           `,
  );
}

// ── mmntjs API-level benchmarks ──

function benchMomentSetters(label: string, factory: () => mmntjs.Moment) {
  const m1 = factory();
  const rSetHour = runWarm(() => {
    m1.hour(12);
  });
  const m2 = factory();
  const rSetMin = runWarm(() => {
    m2.minute(45);
  });
  const m3 = factory();
  const rSetSec = runWarm(() => {
    m3.second(0);
  });
  const m4 = factory();
  const rSetMs = runWarm(() => {
    m4.millisecond(0);
  });

  console.log(
    `${label.padEnd(40)} ${micros(rSetHour.median).padStart(10)} ${micros(rSetMin.median).padStart(10)} ${micros(rSetSec.median).padStart(10)} ${micros(rSetMs.median).padStart(10)}`,
  );
}

// ═══════════════════════════════════════════════════════
// Main
// ═══════════════════════════════════════════════════════

const runtime = typeof Bun !== "undefined" ? "Bun" : `Node ${process.version}`;
console.log(`\n=== Setter benchmark — ${runtime} ===`);
console.log(`ITER=${ITER} RUNS=${RUNS} (median of ${RUNS} warm rounds)\n`);

console.log("─── Time-of-day setters (local, DST-stable) ───");
console.log(
  "  approach".padEnd(40) +
    "  Date.set*".padStart(10) +
    "  epochΔ".padStart(10) +
    "  arith+guard".padStart(10),
);
benchHourLocal("setHours (Date vs epochΔ vs arith+guard)");
benchMinuteLocal("setMinutes (Date vs epochΔ)");
benchSecondLocal("setSeconds (Date vs epochΔ)");
benchMsLocal("setMilliseconds (Date vs epochΔ)");

console.log("\n─── mmntjs API-level setters (local, CleanLocalFreshWithDate) ───");
console.log(
  "  construct".padEnd(40) +
    "  setHour".padStart(10) +
    "  setMin".padStart(10) +
    "  setSec".padStart(10) +
    "  setMs".padStart(10),
);

benchMomentSetters("moment(ISO string).hour(12)", () => mmntjs("2024-06-15T10:30:45.123"));
benchMomentSetters("moment(ISO string).minute(45)", () => mmntjs("2024-06-15T10:30:45.123"));
benchMomentSetters("moment(ISO string).second(0)", () => mmntjs("2024-06-15T10:30:45.123"));
benchMomentSetters("moment(ISO string).millisecond(0)", () => mmntjs("2024-06-15T10:30:45.123"));

console.log("\n─── UTC mode setters (API-level) ───");
const utcM = mmntjs.utc("2024-06-15T10:30:45.123");
const rUtcHour = runWarm(() => {
  utcM.hour(12);
});
const rUtcMin = runWarm(() => {
  utcM.minute(45);
});
const rUtcSec = runWarm(() => {
  utcM.second(0);
});
const rUtcMs = runWarm(() => {
  utcM.millisecond(0);
});
console.log(
  `${"moment.utc(ISO).hour(12)".padEnd(40)} ${micros(rUtcHour.median).padStart(10)} ${micros(rUtcMin.median).padStart(10)} ${micros(rUtcSec.median).padStart(10)} ${micros(rUtcMs.median).padStart(10)}`,
);

console.log("\n─── Chained setters (hour+min+sec+ms) ───");
const mChain = mmntjs("2024-06-15T10:30:45.123");
const rChain = runWarm(() => {
  mChain.hour(0).minute(0).second(0).millisecond(0);
});
console.log(
  `${"moment.hour().minute().second().ms()".padEnd(40)} ${micros(rChain.median).padStart(10)}`,
);

console.log("\n");
