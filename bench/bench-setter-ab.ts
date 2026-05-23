// Micro A/B tests for setter overhead in Moment class.
// Tests alternative implementation strategies for hot-path setters.
// Run: bun bench/bench-setter-ab.ts
/* eslint-disable @typescript-eslint/no-explicit-any, no-unused-vars, prefer-template, curly */

import mmntjs from "../dist/index.cjs";

// ========== Benchmark harness ==========

interface BenchResult {
  name: string;
  ops: number;
  ns: number;
}

const WARMUP = 2000;
const ITER = 20000;
const RUNS = 7;

function bench(label: string, fn: () => void): BenchResult {
  for (let i = 0; i < WARMUP; i++) {
    fn();
  }
  const times: number[] = [];
  for (let r = 0; r < RUNS; r++) {
    const start = process.hrtime.bigint();
    for (let i = 0; i < ITER; i++) {
      fn();
    }
    const end = process.hrtime.bigint();
    times.push(Number(end - start) / ITER);
  }
  times.sort((a, b) => a - b);
  const median = times[Math.floor(RUNS / 2)];
  return { name: label, ops: Math.round(1e9 / median), ns: Math.round(median) };
}

function fmt(ns: number): string {
  if (ns >= 1000) {
    return `${(ns / 1000).toFixed(2)}μs`;
  }
  return `${ns.toFixed(1)}ns`;
}

function ratio(b: BenchResult, a: BenchResult): string {
  return `${((b.ops / a.ops) * 100).toFixed(1)}%`;
}

let _sink: unknown;

// ========== Helpers ==========

function freshLocal(iso = "2024-06-15T10:30:45.123") {
  return mmntjs(iso);
}

function freshLocalNoD(iso = "2024-06-15T10:30:45.123") {
  const m = mmntjs(iso);
  m._p.d = undefined;
  m._p._tStale = false;
  return m;
}

function freshDirty(iso = "2024-06-15T10:30:45.123") {
  const m = mmntjs(iso);
  m._p.dirty = true;
  return m;
}

function freshUTC(iso = "2024-06-15T10:30:45.123") {
  return mmntjs.utc(iso);
}

function freshDST() {
  // Spring-forward boundary: America/New_York 2024-03-10 02:00 skipped
  const m = mmntjs("2024-03-10T01:30:00");
  return m;
}

// ========== Experiment 1: typeof number fast path ==========
// Current: typeof h === "number" ? h : Number(h)
// Variant: Number(h) always (no typeof check — simpler but calls Number constructor)
// Variant: h|0 fast path with fallback

function exp1_typeofCheck() {
  console.log("\n=== Exp 1: typeof number fast path vs Number() ===");

  const results: BenchResult[] = [];

  for (const [tag, fn] of [
    [
      "A: typeof===",
      (h: unknown) => {
        const n = typeof h === "number" ? h : Number(h);
        return isNaN(n) ? NaN : n;
      },
    ],
    [
      "B: Number()",
      (h: unknown) => {
        const n = Number(h);
        return isNaN(n) ? NaN : n;
      },
    ],
    [
      "C: |0 then Number",
      (h: unknown) => {
        const i = (h as number) | 0;
        return i === (h as number) ? i : Number(h);
      },
    ],
    [
      "D: unary+",
      (h: unknown) => {
        const n = +(h as string);
        return isNaN(n) ? NaN : n;
      },
    ],
  ] as const) {
    // Pure conversion benchmarks (no moment involved)
    results.push(
      bench(`  ${tag} (number 12)`, () => {
        _sink = fn(12);
      }),
    );
    results.push(
      bench(`  ${tag} (string "12")`, () => {
        _sink = fn("12");
      }),
    );
  }

  const base = results[0].ops;
  for (const r of results) {
    const rel = ((r.ops / base) * 100).toFixed(1);
    console.log(
      `  ${r.name.padEnd(35)} ${fmt(r.ns).padStart(8)}  ${r.ops.toLocaleString().padStart(10)} ops/s  ${rel}%`,
    );
  }
}

// ========== Experiment 2: Number.isInteger vs (num|0)===num ==========

function exp2_isInteger() {
  console.log("\n=== Exp 2: Number.isInteger(num) vs (num | 0) === num ===");

  const results: BenchResult[] = [];

  for (const [tag, guard] of [
    ["A: Number.isInteger", (v: number) => Number.isInteger(v)],
    ["B: (v|0)===v", (v: number) => (v | 0) === v],
  ] as const) {
    results.push(
      bench(`  ${tag} (int 12)`, () => {
        _sink = guard(12) && 12 >= 0 && 12 <= 23;
      }),
    );
    results.push(
      bench(`  ${tag} (float 12.5)`, () => {
        _sink = guard(12.5) && 12.5 >= 0 && 12.5 <= 23;
      }),
    );
  }

  const base = results[0].ops;
  for (const r of results) {
    const rel = ((r.ops / base) * 100).toFixed(1);
    console.log(
      `  ${r.name.padEnd(35)} ${fmt(r.ns).padStart(8)}  ${r.ops.toLocaleString().padStart(10)} ops/s  ${rel}%`,
    );
  }
}

// ========== Experiment 3: hour() setter A vs B ==========

function exp3_hourStrategies() {
  console.log("\n=== Exp 3: hour() — arithmetic newT+_tzOffsetAt vs Date.setHours ===");

  const _probeDate = new Date(0);
  const _probeCache = { t: NaN, offset: NaN };
  function _tzOffsetAt(t: number): number {
    if (t === _probeCache.t) {
      return _probeCache.offset;
    }
    _probeDate.setTime(t);
    _probeCache.t = t;
    _probeCache.offset = -_probeDate.getTimezoneOffset();
    return _probeCache.offset;
  }

  const results: BenchResult[] = [];

  // Each bench strategy receives (h, p) directly; the caller extracts p from the
  // freshly-prepared moment each iteration so cross-iteration state is clean.
  type HourStrat = (h: number, p: any) => void;

  // A: arithmetic — compute new t via offset probe
  const setHourArith: HourStrat = (h, p) => {
    const oldT = p.t;
    const oldH = p.H;
    const delta = (h - oldH) * 3600000;
    const newT = oldT + delta;
    const offAtNew = _tzOffsetAt(newT);
    const offAtOld = p.offset;
    p.t = newT + (offAtNew - offAtOld) * 60000;
    p.H = h;
    p.offset = offAtNew;
    p._tStale = false;
    p.d = undefined;
  };

  // B: Date.setHours (current fast path)
  const setHourDate: HourStrat = (h, p) => {
    const d = p.d;
    if (!d) {
      return;
    }
    d.setHours(h, p.m, p.s, p.ms);
    p.t = d.getTime();
    p.H = d.getHours();
    p.offset = -d.getTimezoneOffset();
    p._tStale = false;
  };

  // C: arithmetic — simpler: just set p.H, _tStale=true, rely on lazy sync
  const setHourLazy: HourStrat = (h, p) => {
    p.H = h;
    p._tStale = true;
  };

  function runHourStrat(label: string, strat: HourStrat, makeMoment: () => any) {
    results.push(
      bench(`  ${label}`, () => {
        const p = makeMoment()._p;
        const nextH = (p.H + 1) % 24;
        strat(nextH, p);
      }),
    );
  }

  for (const [tag, strat] of [
    ["A: arith+_tzOffsetAt", setHourArith],
    ["B: Date.setHours", setHourDate],
    ["C: lazy (H,_tStale)", setHourLazy],
  ] as const) {
    runHourStrat(`${tag} (p.d present)`, strat, () => freshLocal());
    runHourStrat(`${tag} (p.d absent)`, strat, () => freshLocalNoD());
    runHourStrat(`${tag} (DST boundary)`, strat, () => freshDST());
    runHourStrat(`${tag} (dirty)`, strat, () => freshDirty());
  }

  for (const [i, r] of results.entries()) {
    const base = results[~~(i / 4) * 4].ops;
    const rel = ((r.ops / base) * 100).toFixed(1);
    console.log(
      `  ${r.name.padEnd(35)} ${fmt(r.ns).padStart(8)}  ${r.ops.toLocaleString().padStart(10)} ops/s  ${rel}%`,
    );
  }
}

// ========== Experiment 4: minute/second/ms — Date setter vs p.t delta ==========

function exp4_minSecMsStrategies() {
  console.log("\n=== Exp 4: minute/second/ms — Date setter vs p.t delta ===");

  const results: BenchResult[] = [];

  // All strats receive (p, nextVal); must not assume p.d exists.
  type MStrat = (p: any, val: number) => void;

  // minute strats
  const setMinDate: MStrat = (p, val) => {
    const d = p.d;
    if (!d) {
      return;
    }
    d.setMinutes(val, p.s, p.ms);
    p.m = val;
    p.t = d.getTime();
    p._tStale = false;
  };
  const setMinDelta: MStrat = (p, val) => {
    const d = p.d;
    if (!d) {
      return;
    }
    const delta = (val - p.m) * 60000;
    p.t += delta;
    p.m = val;
    d.setTime(p.t);
    p._tStale = false;
  };
  const setMinLazy: MStrat = (p, val) => {
    p.m = val;
    p._tStale = true;
  };

  // second strats
  const setSecDate: MStrat = (p, val) => {
    const d = p.d;
    if (!d) {
      return;
    }
    d.setSeconds(val, p.ms);
    p.s = val;
    p.t = d.getTime();
    p._tStale = false;
  };
  const setSecDelta: MStrat = (p, val) => {
    const d = p.d;
    if (!d) {
      return;
    }
    const delta = (val - p.s) * 1000;
    p.t += delta;
    p.s = val;
    d.setTime(p.t);
    p._tStale = false;
  };
  const setSecLazy: MStrat = (p, val) => {
    p.s = val;
    p._tStale = true;
  };

  // ms strats
  const setMsDate: MStrat = (p, val) => {
    const d = p.d;
    if (!d) {
      return;
    }
    d.setMilliseconds(val);
    p.ms = val;
    p.t = d.getTime();
    p._tStale = false;
  };
  const setMsDelta: MStrat = (p, val) => {
    const d = p.d;
    if (!d) {
      return;
    }
    const delta = val - p.ms;
    p.t += delta;
    p.ms = val;
    d.setTime(p.t);
    p._tStale = false;
  };
  const setMsLazy: MStrat = (p, val) => {
    p.ms = val;
    p._tStale = true;
  };

  function runMStrat(
    label: string,
    strat: MStrat,
    makeMoment: () => any,
    nextVal: (p: any) => number,
  ) {
    results.push(
      bench(`  ${label}`, () => {
        const p = makeMoment()._p;
        strat(p, nextVal(p));
      }),
    );
  }

  const minNext = (p: any) => (p.m + 1) % 60;
  const secNext = (p: any) => (p.s + 1) % 60;
  const msNext = (p: any) => (p.ms + 1) % 1000;

  // Minute (p.d present and absent)
  for (const [tag, strat] of [
    ["A: Date.setMinutes", setMinDate],
    ["B: p.t delta + setTime", setMinDelta],
    ["C: lazy (_tStale)", setMinLazy],
  ] as const) {
    runMStrat(`${tag} (min,p.d present)`, strat, freshLocal, minNext);
    // Date-dependent strats can't run with p.d absent; lazy runs everywhere
    if (tag.startsWith("C")) {
      runMStrat(`${tag} (min,p.d absent)`, strat, freshLocalNoD, minNext);
    }
  }

  // Second (p.d present)
  for (const [tag, strat] of [
    ["A: Date.setSeconds", setSecDate],
    ["B: p.t delta + setTime", setSecDelta],
    ["C: lazy (_tStale)", setSecLazy],
  ] as const) {
    runMStrat(`${tag} (sec,p.d present)`, strat, freshLocal, secNext);
  }

  // Millisecond (p.d present)
  for (const [tag, strat] of [
    ["A: Date.setMilliseconds", setMsDate],
    ["B: p.t delta + setTime", setMsDelta],
    ["C: lazy (_tStale)", setMsLazy],
  ] as const) {
    runMStrat(`${tag} (ms,p.d present)`, strat, freshLocal, msNext);
  }

  const base = results[0].ops;
  for (const r of results) {
    const rel = ((r.ops / base) * 100).toFixed(1);
    console.log(
      `  ${r.name.padEnd(35)} ${fmt(r.ns).padStart(8)}  ${r.ops.toLocaleString().padStart(10)} ops/s  ${rel}%`,
    );
  }
}

// ========== Experiment 5: date() fast path — W/offset stale check ==========

function exp5_dateFastPathStaleness() {
  console.log("\n=== Exp 5: date() fast path — does it leave W/offset stale? ===");

  const results: BenchResult[] = [];

  // Check correctness of current inlined fast path in date() setter
  // The inlined path (p.d present, clean): p.d.setDate → read back all fields
  // Line 1556-1564: p.d.setDate(num); then reads p.d.getDay(), p.d.getTimezoneOffset()
  // This should update W and offset correctly.

  for (let iter = 0; iter < 3; iter++) {
    const m = freshLocal();
    const p = m._p;
    // ensure fields are resolved
    m._ensureFields();
    const origD = p.D;
    const targetDate = Math.min(origD - 1, 28);
    if (targetDate < 1) {
      continue;
    }

    // Get expected values before mutation
    const refD = new Date(p.y, p.M, targetDate);
    const expectedW = refD.getDay();
    const expectedOffset = -refD.getTimezoneOffset();

    // Run the actual date() setter
    m.date(targetDate);

    const afterW = m._p.W;
    const afterOffset = m._p.offset;
    const afterD = m._p.D;

    const wOk = afterW === expectedW;
    const offOk = afterOffset === expectedOffset;
    const dOk = afterD === targetDate;

    if (iter === 0) {
      console.log(`  initial: D=${origD} → date(${targetDate})`);
      console.log(`    W: ${afterW} (expected ${expectedW}) ${wOk ? "✓" : "✗"}`);
      console.log(`    offset: ${afterOffset} (expected ${expectedOffset}) ${offOk ? "✓" : "✗"}`);
      console.log(`    D: ${afterD} ${dOk ? "✓" : "✗"}`);
      if (!wOk || !offOk || !dOk) {
        console.log(`    ⚠ STALE! date() fast path leaves W/offset inconsistent`);
      }
    }

    // Also verify: after reading back via getter, values match
    const readW = m.day();
    const readD = m.date();
    const readOffset = (m as any)._p.offset;
    if (iter === 0) {
      const readWOk = readW === expectedW;
      const readDOk = readD === targetDate;
      console.log(`    day() getter: ${readW} (expected ${expectedW}) ${readWOk ? "✓" : "✗"}`);
      console.log(`    date() getter: ${readD} (expected ${targetDate}) ${readDOk ? "✓" : "✗"}`);
    }
  }

  // Also test the p.d-absent code path (val<=28)
  {
    const m2 = freshLocal();
    (m2 as any)._ensureFields();
    const origD2 = m2._p.D;
    const target2 = Math.min(origD2 - 1, 28);
    if (target2 >= 1) {
      m2._p.d = undefined;
      m2._p._tStale = false;
      m2.date(target2);
      const tStaleExpected = true;
      const tStaleOk = m2._p._tStale === tStaleExpected;
      console.log(
        `  p.d absent: D=${origD2}→${target2}, _tStale=${m2._p._tStale} (expected ${tStaleExpected}) ${tStaleOk ? "✓" : "✗"}`,
      );
    }
  }

  // Benchmark: compare strategies
  // (fresh moment per iteration to avoid state accumulation)

  type DateStrat = (p: any, val: number) => void;

  const fastInlined: DateStrat = (p, val) => {
    const d = p.d;
    if (!d) {
      return;
    }
    d.setDate(val);
    p.t = d.getTime();
    p.y = d.getFullYear();
    p.M = d.getMonth();
    p.D = d.getDate();
    p.W = d.getDay();
    p.offset = -d.getTimezoneOffset();
  };

  const lazyField: DateStrat = (p, val) => {
    p.D = val;
    p._tStale = true;
  };

  for (const [tag, strat] of [
    ["inlined (p.d.setDate++)", fastInlined],
    ["lazy (D=,_tStale)", lazyField],
  ] as const) {
    results.push(
      bench(`  ${tag}`, () => {
        const m = freshLocal();
        const p = m._p;
        const val = Math.min(p.D - 1, 28);
        strat(p, val < 1 ? 1 : val);
      }),
    );
  }

  if (results.length) {
    const base = results[0].ops;
    for (const r of results) {
      const rel = ((r.ops / base) * 100).toFixed(1);
      console.log(
        `  ${r.name.padEnd(35)} ${fmt(r.ns).padStart(8)}  ${r.ops.toLocaleString().padStart(10)} ops/s  ${rel}%`,
      );
    }
  }
}

// ========== Experiment 6: add(1,"day") strategies ==========

function exp6_addDay() {
  console.log("\n=== Exp 6: add(1, 'day') — various strategies ===");

  const results: BenchResult[] = [];

  type AddDayStrat = (p: any) => void;

  // A: Current hot path — Date clone
  const addDayClone: AddDayStrat = (p) => {
    const d = p.d;
    if (!d) {
      return;
    }
    const nd = new Date(d);
    nd.setDate(nd.getDate() + 1);
    p.d = nd;
    p.t = nd.getTime();
    p.y = nd.getFullYear();
    p.M = nd.getMonth();
    p.D = nd.getDate();
    p.W = nd.getDay();
    p.offset = -nd.getTimezoneOffset();
  };

  // B: p.t += DAY_MS (UTC arithmetic — incorrect for local with DST!)
  const addDayTick: AddDayStrat = (p) => {
    p.t += 86400000;
    p.d = undefined;
    p.dirty = true;
  };

  // C: Date.setDate on existing p.d (no clone)
  const addDayMutate: AddDayStrat = (p) => {
    const d = p.d;
    if (!d) {
      return;
    }
    d.setDate(d.getDate() + 1);
    p.t = d.getTime();
    p.y = d.getFullYear();
    p.M = d.getMonth();
    p.D = d.getDate();
    p.W = d.getDay();
    p.offset = -d.getTimezoneOffset();
  };

  // D: _addDay (current implementation)
  const addDayCurrent: AddDayStrat = (p) => {
    const d = p.d;
    if (!d) {
      return;
    }
    const nd = new Date(d);
    nd.setDate(nd.getDate() + 1);
    p.d = nd;
    p.t = nd.getTime();
    p.y = nd.getFullYear();
    p.M = nd.getMonth();
    p.D = nd.getDate();
    p.W = nd.getDay();
    p.offset = -nd.getTimezoneOffset();
  };

  // E: lazy — D += 1, _tStale=true (safe for D<=27)
  const addDayLazy: AddDayStrat = (p) => {
    p.D += 1;
    p._tStale = true;
  };

  // F: arithmetic — D+=1, W mod, _tStale
  const addDayArith: AddDayStrat = (p) => {
    p.D += 1;
    p.W = (((p.W + 1) % 7) + 7) % 7;
    p._tStale = true;
    p.d = undefined;
  };

  function runAddDayStrat(label: string, strat: AddDayStrat, makeMoment: () => any) {
    results.push(
      bench(`  ${label}`, () => {
        const p = makeMoment()._p;
        strat(p);
      }),
    );
  }

  const strats: [string, AddDayStrat, boolean][] = [
    ["A: Date clone", addDayClone, true], // needs p.d
    ["B: t+=864e5 dirty", addDayTick, false], // no p.d needed
    ["C: setDate mutate", addDayMutate, true], // needs p.d
    ["D: clone+setDate", addDayCurrent, true], // needs p.d
    ["E: D++ lazy", addDayLazy, false], // no p.d needed
    ["F: D++ W mod", addDayArith, false], // no p.d needed
  ];

  for (const [tag, strat, needsD] of strats) {
    runAddDayStrat(`${tag} (p.d present)`, strat, freshLocal);
    if (!needsD) {
      runAddDayStrat(`${tag} (p.d absent)`, strat, freshLocalNoD);
    }
    runAddDayStrat(`${tag} (DST boundary)`, strat, freshDST);
    runAddDayStrat(`${tag} (dirty)`, strat, freshDirty);
  }

  for (const [i, r] of results.entries()) {
    // group by strategy: 4 scenarios per strat, but some have 3 (skip p.d absent)
    // Just show raw results
    console.log(
      `  ${r.name.padEnd(35)} ${fmt(r.ns).padStart(8)}  ${r.ops.toLocaleString().padStart(10)} ops/s`,
    );
  }
}

// ========== Run all ==========

exp1_typeofCheck();
exp2_isInteger();
exp3_hourStrategies();
exp4_minSecMsStrategies();
exp5_dateFastPathStaleness();
exp6_addDay();

console.log("\nDone.");
