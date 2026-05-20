import { describe, test, beforeEach } from "bun:test";
import fc from "fast-check";
import _moment from "../src/index.ts";
import type { Moment, MomentInput } from "../src/moment-class";
import type { Duration } from "../src/duration";
import _originalMoment from "../moment/moment";

// Register test locales explicitly — mmntjs locales don't auto-register
import { defineLocale } from "../src/locale";
import { frLocale } from "../src/locale/fr";
import { deLocale } from "../src/locale/de";
import { jaLocale } from "../src/locale/ja";
import { ruLocale } from "../src/locale/ru";
import { esLocale } from "../src/locale/es";
defineLocale("fr", frLocale);
defineLocale("de", deLocale);
defineLocale("ja", jaLocale);
defineLocale("ru", ruLocale);
defineLocale("es", esLocale);

type MomentFn = ((...args: unknown[]) => Moment) & {
  utc(...args: unknown[]): Moment;
  parseZone(...args: unknown[]): Moment;
  duration(...args: unknown[]): Duration;
  locale(name?: string): string;
  normalizeUnits(unit: string): string;
};
const moment = _moment as unknown as MomentFn;
const originalMoment = _originalMoment as unknown as MomentFn;

// ---------------------------------------------------------------------------
// Arbitraries
// ---------------------------------------------------------------------------

// Use mid-century+ dates to avoid pre-1900 historical timezone offset issues
// (e.g., Japan had +9:18:59 before 1888, causing fractional-minute discrepancies)
const safeMin = new Date("1950-01-01T00:00:00.000Z");
const safeMax = new Date("2100-01-01T00:00:00.000Z");
const initialDate = fc.date({ min: safeMin, max: safeMax, noInvalidDate: true });

// Keep amounts small enough that even max subtraction stays >= 1900
const addAmount = fc.integer({ min: -40, max: 40 });
const addUnit = fc.constantFrom(
  "years",
  "quarters",
  "months",
  "weeks",
  "days",
  "hours",
  "minutes",
  "seconds",
  "milliseconds",
);
const boundaryUnit = fc.constantFrom(
  "year",
  "quarter",
  "month",
  "week",
  "isoWeek",
  "day",
  "hour",
  "minute",
  "second",
);
const utcTimeUnit = fc.constantFrom("hours", "minutes", "seconds", "milliseconds");
const offsetMinutes = fc.integer({ min: -840, max: 840 });
const genKeepLocalTime = fc.boolean();
const localeNames = fc.constantFrom("en", "fr", "de", "ja", "ru", "es");

// ---------------------------------------------------------------------------
// Model
// ---------------------------------------------------------------------------

interface MomentModel {
  isValid: boolean;
}

// ---------------------------------------------------------------------------
// Real — two parallel moment instances
// ---------------------------------------------------------------------------

interface MomentPair {
  m2: Moment;
  mOrig: Record<string, unknown> & {
    isValid(): boolean;
    valueOf(): number;
    format(format?: string): string;
    utcOffset(offset?: unknown, kw?: boolean): number | Record<string, unknown>;
    locale(locale?: string | string[] | false): string | Record<string, unknown>;
    add(amount: unknown, unit?: unknown): void;
    subtract(amount: unknown, unit?: unknown): void;
    startOf(unit: string): void;
    endOf(unit: string): void;
    utc(kw?: boolean): void;
    local(kw?: boolean): void;
    clone(): Record<string, unknown>;
    diff(input: unknown, unit?: string, float?: boolean): number;
  };
}

// ---------------------------------------------------------------------------
// Verification — compare every observable property
// ---------------------------------------------------------------------------

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

  const f2 = m2.format();
  const fOrig = mOrig.format();
  if (f2 !== fOrig) {
    throw new Error(`format mismatch: "${f2}" vs "${fOrig}"`);
  }

  if (m2.utcOffset() !== mOrig.utcOffset()) {
    throw new Error(`utcOffset mismatch: m2=${m2.utcOffset()} mOrig=${mOrig.utcOffset()}`);
  }

  if (m2.locale() !== mOrig.locale()) {
    throw new Error(`locale mismatch: "${m2.locale()}" vs "${mOrig.locale()}"`);
  }

  if (m2.diff(m2 as unknown as MomentInput) !== 0) {
    throw new Error(`self-diff is not 0: ${m2.diff(m2 as unknown as MomentInput)}`);
  }
}

// ---------------------------------------------------------------------------
// Commands
// ---------------------------------------------------------------------------

class AddCommand implements fc.Command<MomentModel, MomentPair> {
  constructor(
    readonly amount: number,
    readonly unit: string,
  ) {}

  check(m: Readonly<MomentModel>): boolean {
    return m.isValid;
  }

  run(m: MomentModel, r: MomentPair): void {
    r.m2.add(this.amount, this.unit);
    r.mOrig.add(this.amount, this.unit);
    m.isValid = r.m2.isValid();
    verifyEqual(r);
  }

  toString(): string {
    return `add(${this.amount}, "${this.unit}")`;
  }
}

class SubtractCommand implements fc.Command<MomentModel, MomentPair> {
  constructor(
    readonly amount: number,
    readonly unit: string,
  ) {}

  check(m: Readonly<MomentModel>): boolean {
    return m.isValid;
  }

  run(m: MomentModel, r: MomentPair): void {
    r.m2.subtract(this.amount, this.unit);
    r.mOrig.subtract(this.amount, this.unit);
    m.isValid = r.m2.isValid();
    verifyEqual(r);
  }

  toString(): string {
    return `subtract(${this.amount}, "${this.unit}")`;
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

class UtcCommand implements fc.Command<MomentModel, MomentPair> {
  constructor(readonly kl: boolean) {}

  check(_m: Readonly<MomentModel>): boolean {
    return true;
  }

  run(m: MomentModel, r: MomentPair): void {
    r.m2.utc(this.kl);
    r.mOrig.utc(this.kl);
    m.isValid = r.m2.isValid();
    verifyEqual(r);
  }

  toString(): string {
    return `utc(${this.kl})`;
  }
}

class LocalCommand implements fc.Command<MomentModel, MomentPair> {
  constructor(readonly kl: boolean) {}

  check(_m: Readonly<MomentModel>): boolean {
    return true;
  }

  run(m: MomentModel, r: MomentPair): void {
    r.m2.local(this.kl);
    r.mOrig.local(this.kl);
    m.isValid = r.m2.isValid();
    verifyEqual(r);
  }

  toString(): string {
    return `local(${this.kl})`;
  }
}

class UtcOffsetCommand implements fc.Command<MomentModel, MomentPair> {
  constructor(
    readonly offset: number,
    readonly kl: boolean,
  ) {}

  check(_m: Readonly<MomentModel>): boolean {
    return true;
  }

  run(m: MomentModel, r: MomentPair): void {
    r.m2.utcOffset(this.offset, this.kl);
    r.mOrig.utcOffset(this.offset, this.kl);
    m.isValid = r.m2.isValid();
    verifyEqual(r);
  }

  toString(): string {
    return `utcOffset(${this.offset}, ${this.kl})`;
  }
}

class CloneCommand implements fc.Command<MomentModel, MomentPair> {
  check(_m: Readonly<MomentModel>): boolean {
    return true;
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

    if (r.m2.isValid()) {
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
  }

  toString(): string {
    return "clone()";
  }
}

class LocaleCommand implements fc.Command<MomentModel, MomentPair> {
  constructor(readonly loc: string) {}

  check(_m: Readonly<MomentModel>): boolean {
    return true;
  }

  run(m: MomentModel, r: MomentPair): void {
    r.m2.locale(this.loc);
    r.mOrig.locale(this.loc);
    m.isValid = r.m2.isValid();
    verifyEqual(r);
  }

  toString(): string {
    return `locale("${this.loc}")`;
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("Stateful Model-Based Testing", () => {
  beforeEach(() => {
    moment.locale("en");
    originalMoment.locale("en");
  });

  const maxCommands = 12;

  function makePair(date: Date): MomentPair {
    return { m2: moment(date), mOrig: originalMoment(date) };
  }

  test("mixed command sequences match moment.js at every step (seed -1142841884 repro)", () => {
    const commandArbs: fc.Arbitrary<fc.Command<MomentModel, MomentPair>>[] = [
      fc.tuple(addAmount, addUnit).map(([a, u]) => new AddCommand(a, u)),
      fc.tuple(addAmount, addUnit).map(([a, u]) => new SubtractCommand(a, u)),
      boundaryUnit.map((u) => new StartOfCommand(u)),
      boundaryUnit.map((u) => new EndOfCommand(u)),
      genKeepLocalTime.map((k) => new UtcCommand(k)),
      genKeepLocalTime.map((k) => new LocalCommand(k)),
      fc.tuple(offsetMinutes, genKeepLocalTime).map(([o, k]) => new UtcOffsetCommand(o, k)),
      fc.constant(new CloneCommand()),
      localeNames.map((l) => new LocaleCommand(l)),
    ];

    fc.assert(
      fc.property(
        fc.tuple(initialDate, fc.commands(commandArbs, { maxCommands })),
        ([date, cmds]) => {
          fc.modelRun(
            () => ({ model: { isValid: true } as MomentModel, real: makePair(date) }),
            cmds,
          );
        },
      ),
      { seed: -1142841884, numRuns: 200 },
    );
  });

  test("mixed command sequences match moment.js at every step", () => {
    const commandArbs: fc.Arbitrary<fc.Command<MomentModel, MomentPair>>[] = [
      fc.tuple(addAmount, addUnit).map(([a, u]) => new AddCommand(a, u)),
      fc.tuple(addAmount, addUnit).map(([a, u]) => new SubtractCommand(a, u)),
      boundaryUnit.map((u) => new StartOfCommand(u)),
      boundaryUnit.map((u) => new EndOfCommand(u)),
      genKeepLocalTime.map((k) => new UtcCommand(k)),
      genKeepLocalTime.map((k) => new LocalCommand(k)),
      fc.tuple(offsetMinutes, genKeepLocalTime).map(([o, k]) => new UtcOffsetCommand(o, k)),
      fc.constant(new CloneCommand()),
      localeNames.map((l) => new LocaleCommand(l)),
    ];

    fc.assert(
      fc.property(
        fc.tuple(initialDate, fc.commands(commandArbs, { maxCommands })),
        ([date, cmds]) => {
          fc.modelRun(
            () => ({ model: { isValid: true } as MomentModel, real: makePair(date) }),
            cmds,
          );
        },
      ),
      { numRuns: 200 },
    );
  });

  test("UTC/Local/offset transitions with time-unit mutations", () => {
    const commandArbs: fc.Arbitrary<fc.Command<MomentModel, MomentPair>>[] = [
      genKeepLocalTime.map((k) => new UtcCommand(k)),
      genKeepLocalTime.map((k) => new LocalCommand(k)),
      fc.tuple(offsetMinutes, genKeepLocalTime).map(([o, k]) => new UtcOffsetCommand(o, k)),
      fc.constant(new CloneCommand()),
      boundaryUnit.map((u) => new StartOfCommand(u)),
      boundaryUnit.map((u) => new EndOfCommand(u)),
      fc.tuple(addAmount, utcTimeUnit).map(([a, u]) => new AddCommand(a, u)),
    ];

    fc.assert(
      fc.property(
        fc.tuple(initialDate, fc.commands(commandArbs, { maxCommands: 10 })),
        ([date, cmds]) => {
          fc.modelRun(
            () => ({ model: { isValid: true } as MomentModel, real: makePair(date) }),
            cmds,
          );
        },
      ),
      { numRuns: 100 },
    );
  });

  test("clone independence across sequence mutations", () => {
    fc.assert(
      fc.property(
        fc.tuple(
          initialDate,
          fc.commands(
            [
              fc.constant(new CloneCommand()),
              fc.tuple(addAmount, addUnit).map(([a, u]) => new AddCommand(a, u)),
              fc.tuple(addAmount, addUnit).map(([a, u]) => new SubtractCommand(a, u)),
              boundaryUnit.map((u) => new StartOfCommand(u)),
              boundaryUnit.map((u) => new EndOfCommand(u)),
            ],
            { maxCommands: 8 },
          ),
        ),
        ([date, cmds]) => {
          fc.modelRun(
            () => ({ model: { isValid: true } as MomentModel, real: makePair(date) }),
            cmds,
          );
        },
      ),
      { numRuns: 100 },
    );
  });
});
