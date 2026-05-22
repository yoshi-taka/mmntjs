import { describe, test } from "bun:test";
import fc from "fast-check";
import { assertProp } from "./helpers";
import _moment from "../../src/index.ts";
import type { Moment } from "../../src/moment-class";
import _originalMoment from "../../moment/moment";

type MomentFn = ((...args: unknown[]) => Moment) & {
  utc(...args: unknown[]): Moment;
  parseZone(...args: unknown[]): Moment;
};
const moment = _moment as unknown as MomentFn;
const originalMoment = _originalMoment as unknown as MomentFn;

// ---------------------------------------------------------------------------
// Arbitraries
// ---------------------------------------------------------------------------

const safeMin = new Date("1950-01-01T00:00:00.000Z");
const safeMax = new Date("2100-01-01T00:00:00.000Z");
const initialDate = fc.date({ min: safeMin, max: safeMax, noInvalidDate: true });

const offsetMinutes = fc.integer({ min: -840, max: 840 });

// Value domains for setters
const dayVals = fc.integer({ min: 1, max: 28 });
const hourVals = fc.integer({ min: 0, max: 23 });
const minuteVals = fc.integer({ min: 0, max: 59 });
const secondVals = fc.integer({ min: 0, max: 59 });
const msVals = fc.integer({ min: 0, max: 999 });

// startOf/endOf units with bias toward recently optimized fast paths
const startEndUnit = fc.oneof(
  { weight: 4, arbitrary: fc.constant("day" as const) },
  { weight: 2, arbitrary: fc.constant("month" as const) },
  { weight: 1, arbitrary: fc.constant("year" as const) },
  { weight: 1, arbitrary: fc.constant("week" as const) },
);

type Mode = { type: "local" } | { type: "utc" } | { type: "utcOffset"; offset: number };

const modeArb: fc.Arbitrary<Mode> = fc.oneof(
  fc.constant({ type: "local" as const }),
  fc.constant({ type: "utc" as const }),
  offsetMinutes.map((o) => ({ type: "utcOffset" as const, offset: o })),
);

// ---------------------------------------------------------------------------
// Model
// ---------------------------------------------------------------------------

interface MomentModel {
  isValid: boolean;
}

// ---------------------------------------------------------------------------
// Real — pair of moments
// ---------------------------------------------------------------------------

interface MomentPair {
  m2: Moment;
  mOrig: Record<string, unknown> & {
    isValid(): boolean;
    valueOf(): number;
    format(fmt?: string): string;
    utcOffset(offset?: unknown, kw?: boolean): number | Record<string, unknown>;
    add(amount: number, unit?: string): void;
    startOf(unit: string): void;
    endOf(unit: string): void;
    clone(): Record<string, unknown>;
    unix(): number;
    daysInMonth(): number;
    isLeapYear(): boolean;
    date(n?: unknown): number | Record<string, unknown>;
    hour(n?: unknown): number | Record<string, unknown>;
    minute(n?: unknown): number | Record<string, unknown>;
    second(n?: unknown): number | Record<string, unknown>;
    millisecond(n?: unknown): number | Record<string, unknown>;
  };
}

// ---------------------------------------------------------------------------
// Verification
// ---------------------------------------------------------------------------

const COMPARE_FMT = "YYYY-MM-DDTHH:mm:ss.SSSZ";

function verifyEqual(r: MomentPair): void {
  const { m2, mOrig } = r;

  if (m2.isValid() !== mOrig.isValid()) {
    throw new Error(`isValid mismatch: m2=${m2.isValid()} mOrig=${mOrig.isValid()}`);
  }

  if (!m2.isValid()) {
    if (!Object.is(m2.valueOf(), NaN)) {
      throw new Error(`invalid m2.valueOf() !== NaN: ${m2.valueOf()}`);
    }
    if (!Object.is(mOrig.valueOf(), NaN)) {
      throw new Error(`invalid mOrig.valueOf() !== NaN: ${mOrig.valueOf()}`);
    }
    return;
  }

  if (m2.valueOf() !== mOrig.valueOf()) {
    throw new Error(`valueOf mismatch: m2=${m2.valueOf()} mOrig=${mOrig.valueOf()}`);
  }

  const f2 = m2.format(COMPARE_FMT);
  const fOrig = mOrig.format(COMPARE_FMT);
  if (f2 !== fOrig) {
    throw new Error(`format mismatch: "${f2}" vs "${fOrig}"`);
  }

  if (m2.utcOffset() !== mOrig.utcOffset()) {
    throw new Error(`utcOffset mismatch: m2=${m2.utcOffset()} mOrig=${mOrig.utcOffset()}`);
  }
}

// ---------------------------------------------------------------------------
// Commands
// ---------------------------------------------------------------------------

// --- Mutating commands ---

class AddDayCommand implements fc.Command<MomentModel, MomentPair> {
  check(m: Readonly<MomentModel>): boolean {
    return m.isValid;
  }
  run(m: MomentModel, r: MomentPair): void {
    r.m2.add(1, "day");
    r.mOrig.add(1, "day");
    m.isValid = r.m2.isValid();
    verifyEqual(r);
  }
  toString(): string {
    return 'add(1, "day")';
  }
}

class AddMonthCommand implements fc.Command<MomentModel, MomentPair> {
  check(m: Readonly<MomentModel>): boolean {
    return m.isValid;
  }
  run(m: MomentModel, r: MomentPair): void {
    r.m2.add(1, "month");
    r.mOrig.add(1, "month");
    m.isValid = r.m2.isValid();
    verifyEqual(r);
  }
  toString(): string {
    return 'add(1, "month")';
  }
}

class StartOfCommand implements fc.Command<MomentModel, MomentPair> {
  constructor(readonly unit: string) {}
  check(m: Readonly<MomentModel>): boolean {
    return m.isValid;
  }
  run(m: MomentModel, r: MomentPair): void {
    r.m2.startOf(this.unit);
    r.mOrig.startOf(this.unit);
    m.isValid = r.m2.isValid();
    verifyEqual(r);
  }
  toString(): string {
    return `startOf("${this.unit}")`;
  }
}

class EndOfCommand implements fc.Command<MomentModel, MomentPair> {
  constructor(readonly unit: string) {}
  check(m: Readonly<MomentModel>): boolean {
    return m.isValid;
  }
  run(m: MomentModel, r: MomentPair): void {
    r.m2.endOf(this.unit);
    r.mOrig.endOf(this.unit);
    m.isValid = r.m2.isValid();
    verifyEqual(r);
  }
  toString(): string {
    return `endOf("${this.unit}")`;
  }
}

class DateCommand implements fc.Command<MomentModel, MomentPair> {
  constructor(readonly val: number) {}
  check(m: Readonly<MomentModel>): boolean {
    return m.isValid;
  }
  run(m: MomentModel, r: MomentPair): void {
    r.m2.date(this.val);
    r.mOrig.date(this.val);
    m.isValid = r.m2.isValid();
    verifyEqual(r);
  }
  toString(): string {
    return `date(${this.val})`;
  }
}

class HourCommand implements fc.Command<MomentModel, MomentPair> {
  constructor(readonly val: number) {}
  check(m: Readonly<MomentModel>): boolean {
    return m.isValid;
  }
  run(m: MomentModel, r: MomentPair): void {
    r.m2.hour(this.val);
    r.mOrig.hour(this.val);
    m.isValid = r.m2.isValid();
    verifyEqual(r);
  }
  toString(): string {
    return `hour(${this.val})`;
  }
}

class MinuteCommand implements fc.Command<MomentModel, MomentPair> {
  constructor(readonly val: number) {}
  check(m: Readonly<MomentModel>): boolean {
    return m.isValid;
  }
  run(m: MomentModel, r: MomentPair): void {
    r.m2.minute(this.val);
    r.mOrig.minute(this.val);
    m.isValid = r.m2.isValid();
    verifyEqual(r);
  }
  toString(): string {
    return `minute(${this.val})`;
  }
}

class SecondCommand implements fc.Command<MomentModel, MomentPair> {
  constructor(readonly val: number) {}
  check(m: Readonly<MomentModel>): boolean {
    return m.isValid;
  }
  run(m: MomentModel, r: MomentPair): void {
    r.m2.second(this.val);
    r.mOrig.second(this.val);
    m.isValid = r.m2.isValid();
    verifyEqual(r);
  }
  toString(): string {
    return `second(${this.val})`;
  }
}

class MillisecondCommand implements fc.Command<MomentModel, MomentPair> {
  constructor(readonly val: number) {}
  check(m: Readonly<MomentModel>): boolean {
    return m.isValid;
  }
  run(m: MomentModel, r: MomentPair): void {
    r.m2.millisecond(this.val);
    r.mOrig.millisecond(this.val);
    m.isValid = r.m2.isValid();
    verifyEqual(r);
  }
  toString(): string {
    return `millisecond(${this.val})`;
  }
}

// --- Read-only commands ---

class CloneCommand implements fc.Command<MomentModel, MomentPair> {
  check(m: Readonly<MomentModel>): boolean {
    return m.isValid;
  }
  run(m: MomentModel, r: MomentPair): void {
    const c2 = r.m2.clone();
    const cOrig = r.mOrig.clone();

    if (c2.isValid() !== cOrig.isValid()) {
      throw new Error(`clone isValid mismatch`);
    }

    if (c2.isValid()) {
      if (c2.valueOf() !== cOrig.valueOf()) {
        throw new Error(`clone valueOf mismatch: ${c2.valueOf()} vs ${cOrig.valueOf()}`);
      }
      if (c2.valueOf() !== r.m2.valueOf()) {
        throw new Error(`clone valueOf differs from original at clone time`);
      }
    }

    // Clone independence: mutate original, verify clone unchanged
    const savedC2 = c2.isValid() ? c2.valueOf() : NaN;
    r.m2.add(1, "day");
    r.mOrig.add(1, "day");
    if (c2.isValid() && !Object.is(savedC2, NaN)) {
      if (c2.valueOf() !== savedC2) {
        throw new Error("clone value changed after original was mutated");
      }
    }
    m.isValid = r.m2.isValid();
    verifyEqual(r);
  }
  toString(): string {
    return "clone()";
  }
}

class ValueOfCommand implements fc.Command<MomentModel, MomentPair> {
  check(m: Readonly<MomentModel>): boolean {
    return m.isValid;
  }
  run(_m: MomentModel, r: MomentPair): void {
    const v2 = r.m2.valueOf();
    const vOrig = r.mOrig.valueOf();
    if (v2 !== vOrig) {
      throw new Error(`valueOf mismatch: ${v2} vs ${vOrig}`);
    }
  }
  toString(): string {
    return "valueOf()";
  }
}

class UnixCommand implements fc.Command<MomentModel, MomentPair> {
  check(m: Readonly<MomentModel>): boolean {
    return m.isValid;
  }
  run(_m: MomentModel, r: MomentPair): void {
    const u2 = r.m2.unix();
    const uOrig = r.mOrig.unix();
    if (u2 !== uOrig) {
      throw new Error(`unix mismatch: ${u2} vs ${uOrig}`);
    }
  }
  toString(): string {
    return "unix()";
  }
}

class DaysInMonthCommand implements fc.Command<MomentModel, MomentPair> {
  check(m: Readonly<MomentModel>): boolean {
    return m.isValid;
  }
  run(_m: MomentModel, r: MomentPair): void {
    const d2 = r.m2.daysInMonth();
    const dOrig = r.mOrig.daysInMonth();
    if (d2 !== dOrig) {
      throw new Error(`daysInMonth mismatch: ${d2} vs ${dOrig}`);
    }
  }
  toString(): string {
    return "daysInMonth()";
  }
}

class IsLeapYearCommand implements fc.Command<MomentModel, MomentPair> {
  check(m: Readonly<MomentModel>): boolean {
    return m.isValid;
  }
  run(_m: MomentModel, r: MomentPair): void {
    const l2 = r.m2.isLeapYear();
    const lOrig = r.mOrig.isLeapYear();
    if (l2 !== lOrig) {
      throw new Error(`isLeapYear mismatch: ${l2} vs ${lOrig}`);
    }
  }
  toString(): string {
    return "isLeapYear()";
  }
}

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

function makePair(date: Date, mode: Mode): MomentPair {
  switch (mode.type) {
    case "local":
      return { m2: moment(date), mOrig: originalMoment(date) };
    case "utc":
      return { m2: moment.utc(date), mOrig: originalMoment.utc(date) };
    case "utcOffset":
      return {
        m2: moment(date).utcOffset(mode.offset),
        mOrig: originalMoment(date).utcOffset(mode.offset),
      };
  }
}

function runShortChain(date: Date, mode: Mode, cmds: fc.Command<MomentModel, MomentPair>[]): void {
  fc.modelRun(
    () => ({ model: { isValid: true } as MomentModel, real: makePair(date, mode) }),
    cmds,
  );
}

// ---------------------------------------------------------------------------
// Command arbitrary — weighted toward recently optimized fast paths
// ---------------------------------------------------------------------------

const commandArb: fc.Arbitrary<fc.Command<MomentModel, MomentPair>> = fc.oneof(
  // add(1,'day') — high weight (civil-date arithmetic, hybrid UTC add-day)
  { weight: 8, arbitrary: fc.constant(new AddDayCommand()) },
  // add(1,'month') — medium weight
  { weight: 4, arbitrary: fc.constant(new AddMonthCommand()) },
  // startOf — weighted: day > month > year/week
  { weight: 6, arbitrary: startEndUnit.map((u) => new StartOfCommand(u)) },
  // endOf — weighted: day > month > year/week
  { weight: 4, arbitrary: startEndUnit.map((u) => new EndOfCommand(u)) },
  // date(n) — high weight (bypass generic path, val<=28 arithmetic)
  { weight: 6, arbitrary: dayVals.map((v) => new DateCommand(v)) },
  // hour(n) — high weight (epoch delta arithmetic)
  { weight: 6, arbitrary: hourVals.map((v) => new HourCommand(v)) },
  // minute(n) — medium weight
  { weight: 4, arbitrary: minuteVals.map((v) => new MinuteCommand(v)) },
  // second(n) — medium weight
  { weight: 4, arbitrary: secondVals.map((v) => new SecondCommand(v)) },
  // millisecond(n) — medium weight
  { weight: 4, arbitrary: msVals.map((v) => new MillisecondCommand(v)) },
  // clone() — high weight (VDSO-style inline, trampoline)
  { weight: 6, arbitrary: fc.constant(new CloneCommand()) },
  // valueOf() — high weight (VDSO-style inline, trampoline)
  { weight: 6, arbitrary: fc.constant(new ValueOfCommand()) },
  // unix() — medium weight
  { weight: 4, arbitrary: fc.constant(new UnixCommand()) },
  // daysInMonth() — lower weight
  { weight: 2, arbitrary: fc.constant(new DaysInMonthCommand()) },
  // isLeapYear() — lower weight
  { weight: 2, arbitrary: fc.constant(new IsLeapYearCommand()) },
);

// ---------------------------------------------------------------------------
// Tests — run under 4 timezones
// ---------------------------------------------------------------------------

const TZS = ["UTC", "Asia/Tokyo", "America/New_York", "Europe/Berlin"];

for (const tz of TZS) {
  describe(`short method chains [${tz}]`, () => {
    test("2-3 random operations match moment.js at every step", () => {
      const origTz = process.env.TZ;
      process.env.TZ = tz;
      try {
        assertProp(
          fc.property(
            fc.tuple(initialDate, modeArb),
            fc.commands([commandArb], { maxCommands: 3 }),
            ([date, mode], cmds) => {
              runShortChain(date, mode, cmds);
            },
          ),
          { numRuns: 200 },
        );
      } finally {
        process.env.TZ = origTz;
      }
    });

    test("weighted toward fast-path operations (20 runs per seed)", () => {
      // Verify that the bias doesn't cause errors — run more iterations
      // with a fixed seed for reproducibility
      assertProp(
        fc.property(
          fc.tuple(initialDate, modeArb),
          fc.commands([commandArb], { maxCommands: 3 }),
          ([date, mode], cmds) => {
            runShortChain(date, mode, cmds);
          },
        ),
        { numRuns: 50 },
      );
    });
  });
}
