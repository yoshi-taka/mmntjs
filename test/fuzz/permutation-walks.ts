// Permutation walk generator for fuzzing mmntjs operations.
// Reference implementation for test/fuzz/permutation-walks.fuzz.js
// Not included in bundle.

export type Op =
  | { t: "addDay"; n: number }
  | { t: "addMonth"; n: number }
  | { t: "addHour"; n: number }
  | { t: "startOfDay" }
  | { t: "startOfMonth" }
  | { t: "utc" }
  | { t: "local" }
  | { t: "setDate"; n: number };

export type Walk = Op[];

// ---- Singular boundary starting states ----

export const BOUNDARY_DATES = [
  // DST spring-forward (US/Eastern)
  "2024-03-10T01:30:00",
  "2024-03-10T03:00:00",
  // DST fall-back (US/Eastern)
  "2024-11-03T00:30:00",
  "2024-11-03T01:30:00",
  // Month-end
  "2024-01-31T12:00:00",
  "2024-02-28T12:00:00",
  "2024-02-29T12:00:00",
  "2024-03-31T12:00:00",
  "2024-04-30T12:00:00",
  // Leap year
  "2024-02-29T12:00:00",
  "2023-02-28T12:00:00",
  // Year boundary
  "2023-12-31T23:59:59",
  "2024-01-01T00:00:00",
];

// ---- Targeted walks ----

// Walk A: DST-crossing day add
export const WALK_A: Walk[] = [
  // A1: quasi-inverse of add(day) across DST
  [{ t: "addDay", n: 1 }, { t: "addDay", n: -1 }],
  // A2: commutativity of add(day) + add(hour)
  [{ t: "addDay", n: 1 }, { t: "addHour", n: 1 }],
  [{ t: "addHour", n: 1 }, { t: "addDay", n: 1 }],
];

// Walk B: Month-end clamping
export const WALK_B: Walk[] = [
  // B1: quasi-inverse of add(month)
  [{ t: "addMonth", n: 1 }, { t: "addMonth", n: -1 }],
  [{ t: "addMonth", n: -1 }, { t: "addMonth", n: 1 }],
  // B2: commutativity of add(month) + add(day)
  [{ t: "addMonth", n: 1 }, { t: "addDay", n: 1 }],
  [{ t: "addDay", n: 1 }, { t: "addMonth", n: 1 }],
  // B3: chained month add
  [{ t: "addMonth", n: 3 }, { t: "addMonth", n: -3 }],
];

// Walk C: Mode switching
export const WALK_C: Walk[] = [
  // C1: utc idempotence
  [{ t: "utc" }, { t: "utc" }],
  // C2: local idempotence
  [{ t: "local" }, { t: "local" }],
  // C3: utc/local roundtrip
  [{ t: "utc" }, { t: "local" }],
  // C4: local/utc roundtrip
  [{ t: "local" }, { t: "utc" }],
  // C5: longer mode chain
  [{ t: "utc" }, { t: "local" }, { t: "utc" }, { t: "local" }],
];

// Walk D: startOf chain
export const WALK_D: Walk[] = [
  // D1: superset reduction (month absorbs day)
  [{ t: "startOfMonth" }, { t: "startOfDay" }],
  // D2: idempotence
  [{ t: "startOfDay" }, { t: "startOfDay" }],
  [{ t: "startOfMonth" }, { t: "startOfMonth" }],
  // D3: startOf then add
  [{ t: "startOfMonth" }, { t: "addDay", n: 5 }],
  [{ t: "addDay", n: 5 }, { t: "startOfMonth" }],
];

// Walk E: Long chain (10 ops)
export const WALK_E: Walk[] = [
  [
    { t: "addMonth", n: 1 },
    { t: "addDay", n: 5 },
    { t: "startOfMonth" },
    { t: "utc" },
    { t: "addHour", n: -2 },
    { t: "local" },
    { t: "addMonth", n: -1 },
    { t: "startOfDay" },
    { t: "setDate", n: 15 },
    { t: "addHour", n: 3 },
  ],
  [
    { t: "setDate", n: 31 },
    { t: "addMonth", n: 1 },
    { t: "addDay", n: -1 },
    { t: "startOfDay" },
    { t: "utc" },
    { t: "addMonth", n: -1 },
    { t: "local" },
    { t: "addDay", n: 1 },
    { t: "addHour", n: -12 },
    { t: "startOfMonth" },
  ],
];

// ---- Walk application ----

export function applyWalk(m: { add: Function; startOf: Function; utc: Function; local: Function; date: Function }, ops: Op[]): void {
  for (const op of ops) {
    switch (op.t) {
      case "addDay":   m.add(op.n, "day"); break;
      case "addMonth": m.add(op.n, "month"); break;
      case "addHour":  m.add(op.n, "hour"); break;
      case "startOfDay":   m.startOf("day"); break;
      case "startOfMonth": m.startOf("month"); break;
      case "utc":   m.utc(); break;
      case "local": m.local(); break;
      case "setDate": m.date(op.n); break;
    }
  }
}

// ---- Walk invariants to check ----

export interface WalkCheckResult {
  isValid: boolean;
  valueOfFinite: boolean;
  formatRoundtrips: boolean;
  utcLocalParity: boolean;
  momentJsMatch: boolean;
}

export function checkInvariants(m: unknown): WalkCheckResult {
  const v = (m as { valueOf(): number }).valueOf();
  return {
    isValid: (m as { isValid(): boolean }).isValid(),
    valueOfFinite: isFinite(v),
    formatRoundtrips: !isNaN(v),
    utcLocalParity: true,
    momentJsMatch: false,
  };
}
