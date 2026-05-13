import { describe, test, expect } from "bun:test";
import fc from "fast-check";
import _moment from "../src/index.ts";
import type { MomentStatic } from "../src/entry/types";
import type { Moment } from "../src/moment-class";
import type { Duration } from "../src/duration";
import _originalMoment from "../moment/moment";
type MomentFn = ((...args: unknown[]) => Moment) & {
  min(...args: unknown[]): Moment;
  max(...args: unknown[]): Moment;
  utc(...args: unknown[]): Moment;
  parseZone(...args: unknown[]): Moment;
  duration(...args: unknown[]): Duration;
};
const moment = _moment as unknown as MomentStatic;
const originalMoment = _originalMoment as unknown as MomentFn;

const weightedLocaleTokens = fc.mapToConstant(
  { num: 5, build: () => "L" },
  { num: 5, build: () => "LL" },
  { num: 5, build: () => "LLL" },
  { num: 5, build: () => "LLLL" },
  { num: 5, build: () => "LT" },
  { num: 5, build: () => "LTS" },
  { num: 3, build: () => "l" },
  { num: 3, build: () => "ll" },
  { num: 3, build: () => "lll" },
  { num: 3, build: () => "llll" },
);

const weightedDurationUnits = fc.mapToConstant(
  { num: 10, build: () => "day" },
  { num: 10, build: () => "month" },
  { num: 10, build: () => "year" },
  { num: 8, build: () => "hour" },
  { num: 8, build: () => "minute" },
  { num: 8, build: () => "second" },
  { num: 6, build: () => "week" },
  { num: 6, build: () => "quarter" },
  { num: 4, build: () => "millisecond" },
);

const weightedOpUnits = fc.mapToConstant(
  { num: 10, build: () => "day" },
  { num: 10, build: () => "month" },
  { num: 10, build: () => "year" },
  { num: 7, build: () => "week" },
  { num: 5, build: () => "quarter" },
  { num: 3, build: () => "hour" },
  { num: 3, build: () => "minute" },
  { num: 3, build: () => "second" },
);

const weightedTZTokens = fc.mapToConstant(
  { num: 8, build: () => "Z" },
  { num: 8, build: () => "ZZ" },
  { num: 5, build: () => "YYYY-MM-DDTHH:mm:ssZ" },
  { num: 5, build: () => "YYYY-MM-DDTHH:mm:ss.SSSZ" },
  { num: 4, build: () => "ZZ HH:mm" },
  { num: 3, build: () => "Z A" },
);

const weightedWeekTokens = fc.mapToConstant(
  { num: 5, build: () => "GGGG" },
  { num: 5, build: () => "WW" },
  { num: 5, build: () => "E" },
  { num: 4, build: () => "GGGG[W]WW E" },
  { num: 4, build: () => "GGGG-WW-E" },
  { num: 3, build: () => "gggg" },
  { num: 3, build: () => "ww" },
  { num: 3, build: () => "e" },
);

const weightedQuarterTokens = fc.mapToConstant(
  { num: 5, build: () => "Q" },
  { num: 4, build: () => "YYYY[Q]Q" },
  { num: 3, build: () => "YYYY-Q" },
  { num: 3, build: () => "Qo" },
);

describe("SBST: coverage-guided weighted tests", () => {
  test("weighted format token vs moment.js", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1900, max: 2100 }),
        fc.mapToConstant(
          { num: 10, build: () => "YYYY-MM-DD" },
          { num: 10, build: () => "YYYY" },
          { num: 10, build: () => "MM" },
          { num: 10, build: () => "DD" },
          { num: 8, build: () => "HH:mm:ss" },
          { num: 5, build: () => "YY" },
          { num: 4, build: () => "H" },
          { num: 4, build: () => "m" },
          { num: 4, build: () => "s" },
          { num: 4, build: () => "SSS" },
          { num: 3, build: () => "A" },
          { num: 3, build: () => "a" },
          { num: 3, build: () => "h:mm A" },
          { num: 3, build: () => "YYYY HH:mm" },
          { num: 3, build: () => "MM/DD/YYYY" },
          { num: 3, build: () => "DD-MM-YYYY" },
          { num: 2, build: () => "YYYY MM DD HH mm ss SSS" },
          { num: 1, build: () => "YYYY-MM-DD HH:mm:ss.SSS" },
          { num: 1, build: () => "S" },
        ),
        fc.integer({ min: 1, max: 12 }),
        fc.integer({ min: 1, max: 28 }),
        (year, fmt, month, day) => {
          const dateStr = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
          const m2 = moment(dateStr, fmt);
          const mOrig = originalMoment(dateStr, fmt);
          expect(m2.isValid()).toBe(mOrig.isValid());
          if (m2.isValid() && mOrig.isValid()) {
            expect(m2.format(fmt)).toBe(mOrig.format(fmt));
          }
        },
      ),
      { numRuns: 500 },
    );
  });

  test("weighted format with locale tokens vs moment.js", () => {
    fc.assert(
      fc.property(fc.integer({ min: 1900, max: 2100 }), weightedLocaleTokens, (year, fmt) => {
        const dateStr = `${year}-06-15`;
        const m2 = moment(dateStr);
        const mOrig = originalMoment(dateStr);
        expect(m2.format(fmt)).toBe(mOrig.format(fmt));
      }),
      { numRuns: 200 },
    );
  });

  test("weighted ISO variant parsing vs moment.js", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 9999 }),
        fc.mapToConstant(
          { num: 10, build: () => "YYYY-MM-DD" },
          { num: 10, build: () => "YYYY" },
          { num: 5, build: () => "MM" },
          { num: 5, build: () => "DD" },
          { num: 5, build: () => "YY" },
          { num: 3, build: () => "HH:mm:ss" },
          { num: 3, build: () => "MM/DD/YYYY" },
          { num: 3, build: () => "DD-MM-YYYY" },
          { num: 2, build: () => "h:mm A" },
        ),
        (year, fmt) => {
          const dateStr = `${String(year).padStart(4, "0")}-06-15`;
          const m2 = moment(dateStr, fmt, true);
          const mOrig = originalMoment(dateStr, fmt, true);
          expect(m2.isValid()).toBe(mOrig.isValid());
        },
      ),
      { numRuns: 500 },
    );
  });

  test("weighted duration creation vs moment.js", () => {
    fc.assert(
      fc.property(
        weightedDurationUnits,
        fc.oneof(
          fc.integer({ min: -100000, max: 100000 }),
          fc.constantFrom(0, -1, 1, NaN, Infinity, -Infinity),
        ),
        (unit, value) => {
          if (typeof value !== "number") {return;}
          const d2 = moment.duration(value, unit);
          const dOrig = originalMoment.duration(value, unit);
          expect(d2.isValid()).toBe(dOrig.isValid());
          if (dOrig.isValid()) {
            expect(d2.as(unit)).toBe(dOrig.as(unit));
          }
        },
      ),
      { numRuns: 300 },
    );
  });

  test("weighted add/subtract with extreme amounts vs moment.js", () => {
    fc.assert(
      fc.property(
        fc.date({ min: new Date("2000-01-01"), max: new Date("2025-12-31"), noInvalidDate: true }),
        weightedOpUnits,
        fc.oneof(
          fc.integer({ min: -5000, max: 5000 }),
          fc.constantFrom(0, 1, -1, NaN, Infinity, -Infinity),
        ),
        fc.constantFrom("add", "subtract"),
        (date, unit, amount, op) => {
          if (typeof amount !== "number" || !Number.isFinite(amount)) {return;}
          const d = date.getTime();
          const m2 = moment(d);
          const mOrig = originalMoment(d);
          if (!m2.isValid() || !mOrig.isValid()) {return;}
          const result2 = m2[op](amount, unit);
          const resultOrig = mOrig[op](amount, unit);
          expect(result2.isValid()).toBe(resultOrig.isValid());
          if (resultOrig.isValid()) {
            expect(result2.valueOf()).toBe(resultOrig.valueOf());
          }
        },
      ),
      { numRuns: 500 },
    );
  });

  test("weighted escaped/edge format tokens vs moment.js", () => {
    fc.assert(
      fc.property(
        fc.date({ min: new Date("2020-01-01"), max: new Date("2030-12-31"), noInvalidDate: true }),
        fc.oneof(
          fc.constantFrom(
            "[foo]",
            "[bar]",
            "YYYY[YY]",
            "MM[escaped]DD",
            "HH:mm[:ss]",
            "YYYY[-]MM[-]DD",
            "[[]YYYY[]]",
            "[today is] dddd",
            "YYYY[年]MM[月]DD[日]",
            "h[:]mm A",
            "YYYY[MM]DD",
            "MMMM[ ]Do[,]YYYY",
          ),
        ),
        (date, fmt) => {
          const ts = date.getTime();
          const m2 = moment(ts);
          const mOrig = originalMoment(ts);
          const f2 = m2.format(fmt);
          const fOrig = mOrig.format(fmt);
          expect(f2).toBe(fOrig);
        },
      ),
      { numRuns: 200 },
    );
  });

  test("weighted timezone offset format vs moment.js", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 2000, max: 2030 }),
        fc.integer({ min: 1, max: 12 }),
        fc.integer({ min: 1, max: 28 }),
        weightedTZTokens,
        (year, month, day, fmt) => {
          const dateStr = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
          const m2 = moment(dateStr);
          const mOrig = originalMoment(dateStr);
          const f2 = m2.format(fmt);
          const fOrig = mOrig.format(fmt);
          expect(f2).toBe(fOrig);
        },
      ),
      { numRuns: 200 },
    );
  });

  test("weighted ISO week/year tokens vs moment.js", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 2000, max: 2030 }),
        fc.integer({ min: 1, max: 53 }),
        fc.integer({ min: 1, max: 7 }),
        weightedWeekTokens,
        (year, week, weekday, fmt) => {
          const jan1 = moment([year, 0, 1]);
          const m2 = jan1.isoWeek(week).isoWeekday(weekday);
          const mOrig = originalMoment([year, 0, 1]).isoWeek(week).isoWeekday(weekday);
          expect(m2.isValid()).toBe(mOrig.isValid());
          if (m2.isValid() && mOrig.isValid()) {
            expect(m2.format(fmt)).toBe(mOrig.format(fmt));
          }
        },
      ),
      { numRuns: 200 },
    );
  });

  test("weighted quarter tokens vs moment.js", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 2000, max: 2030 }),
        fc.integer({ min: 1, max: 4 }),
        fc.integer({ min: 1, max: 3 }),
        weightedQuarterTokens,
        (year, q, m, fmt) => {
          const month = (q - 1) * 3 + m;
          const d = new Date(year, month - 1, 1);
          const m2 = moment(d);
          const mOrig = originalMoment(d);
          const f2 = m2.format(fmt);
          const fOrig = mOrig.format(fmt);
          expect(f2).toBe(fOrig);
        },
      ),
      { numRuns: 150 },
    );
  });
});
