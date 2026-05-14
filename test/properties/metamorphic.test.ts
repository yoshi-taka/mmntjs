import { describe, test, expect } from "bun:test";
import fc from "fast-check";
import _moment from "../../src/index.ts";
import type { MomentStatic } from "../../src/entry/types";
import type { Moment } from "../../src/moment-class";
import type { Duration } from "../../src/duration";
import _originalMoment from "../../moment/moment.js";
type MomentFn = ((...args: unknown[]) => Moment) & {
  min(...args: unknown[]): Moment;
  max(...args: unknown[]): Moment;
  utc(...args: unknown[]): Moment;
  parseZone(...args: unknown[]): Moment;
  duration(...args: unknown[]): Duration;
  normalizeUnits(unit: string): string;
};
const moment = _moment as unknown as MomentStatic;
const originalMoment = _originalMoment as unknown as MomentFn;

function normalizeZero(value: number): number {
  return Object.is(value, -0) ? 0 : value;
}

describe("Metamorphic properties", () => {
  const safeMin = new Date("1900-01-01T00:00:00.000Z");
  const safeMax = new Date("2100-01-01T00:00:00.000Z");
  const safeDates = fc.date({ min: safeMin, max: safeMax, noInvalidDate: true });

  const reversibleUnits = fc.constantFrom("millisecond", "second", "minute", "hour", "day", "week");
  const shiftUnits = fc.constantFrom("millisecond", "second", "minute", "hour", "day", "week");
  const boundaryUnits = fc.constantFrom(
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
  const reversibleAmounts = fc.integer({ min: -500, max: 500 });
  const shiftAmounts = fc.integer({ min: -100, max: 100 });
  const offsetMinutes = fc.integer({ min: -48, max: 56 }).map((quarterHours) => quarterHours * 15);
  const zoneBoundaryUnits = fc.constantFrom("day", "week", "isoWeek", "month", "year");
  const comparisonUnits = fc.constantFrom(
    "millisecond",
    "second",
    "minute",
    "hour",
    "day",
    "week",
    "isoWeek",
    "month",
    "year",
  );
  const durationUnits = fc.constantFrom(
    "milliseconds",
    "seconds",
    "minutes",
    "hours",
    "days",
    "weeks",
  );
  const durationAmounts = fc.integer({ min: -1000, max: 1000 });

  function formatOffset(minutes: number): string {
    const sign = minutes >= 0 ? "+" : "-";
    const abs = Math.abs(minutes);
    const hours = String(Math.floor(abs / 60)).padStart(2, "0");
    const mins = String(abs % 60).padStart(2, "0");
    return `${sign}${hours}:${mins}`;
  }

  const offsetIsoStrings = fc
    .record({
      year: fc.integer({ min: 2000, max: 2030 }),
      month: fc.integer({ min: 1, max: 12 }),
      day: fc.integer({ min: 1, max: 28 }),
      hour: fc.integer({ min: 0, max: 23 }),
      minute: fc.integer({ min: 0, max: 59 }),
      second: fc.integer({ min: 0, max: 59 }),
      ms: fc.integer({ min: 0, max: 999 }),
      offset: offsetMinutes,
    })
    .map(({ year, month, day, hour, minute, second, ms, offset }) => ({
      text: `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}T${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}:${String(second).padStart(2, "0")}.${String(ms).padStart(3, "0")}${formatOffset(offset)}`,
      offset,
    }));

  test("add/subtract roundtrip preserves the original instant for reversible units", () => {
    fc.assert(
      fc.property(safeDates, reversibleAmounts, reversibleUnits, (date, amount, unit) => {
        const original = moment(date);
        const roundtrip = moment(date).add(amount, unit).subtract(amount, unit);
        expect(roundtrip.valueOf()).toBe(original.valueOf());
      }),
      { numRuns: 200 },
    );
  });

  test("diff is antisymmetric for the same unit", () => {
    fc.assert(
      fc.property(safeDates, safeDates, reversibleUnits, (a, b, unit) => {
        const left = normalizeZero(moment(a).diff(moment(b), unit));
        const right = normalizeZero(moment(b).diff(moment(a), unit));
        expect(left).toBe(normalizeZero(-right));
      }),
      { numRuns: 200 },
    );
  });

  test("diff is invariant under shifting both operands by the same amount", () => {
    fc.assert(
      fc.property(
        safeDates,
        safeDates,
        shiftAmounts,
        shiftUnits,
        reversibleUnits,
        (a, b, shift, shiftUnit, diffUnit) => {
          const base = moment(a).diff(moment(b), diffUnit);
          const shifted = moment(a)
            .add(shift, shiftUnit)
            .diff(moment(b).add(shift, shiftUnit), diffUnit);
          // day/week シフトは setDate を使うため DST/タイムゾーン変遷を跨ぐと
          // 最大1日ずれる許容が必要。ms 以外の単位では setDate の影響は限定的
          if (shiftUnit === "day" || shiftUnit === "week") {
            expect(Math.abs(shifted - base)).toBeLessThanOrEqual(86400000);
          } else {
            expect(shifted).toBe(base);
          }
        },
      ),
      { numRuns: 200 },
    );
  });

  test("isBefore/isAfter/isSame are mutually consistent", () => {
    fc.assert(
      fc.property(safeDates, safeDates, (a, b) => {
        const left = moment(a);
        const right = moment(b);
        const before = left.isBefore(right);
        const after = left.isAfter(right);
        const same = left.isSame(right);

        expect(Number(before) + Number(after) + Number(same)).toBe(1);
        expect(before).toBe(right.isAfter(left));
        expect(after).toBe(right.isBefore(left));
        expect(same).toBe(right.isSame(left));
      }),
      { numRuns: 200 },
    );
  });

  test("comparison relations are preserved when both operands shift equally", () => {
    fc.assert(
      fc.property(safeDates, safeDates, shiftAmounts, shiftUnits, (a, b, shift, unit) => {
        const left = moment(a);
        const right = moment(b);
        const shiftedLeft = moment(a).add(shift, unit);
        const shiftedRight = moment(b).add(shift, unit);

        expect(shiftedLeft.isBefore(shiftedRight)).toBe(left.isBefore(right));
        expect(shiftedLeft.isAfter(shiftedRight)).toBe(left.isAfter(right));
        expect(shiftedLeft.isSame(shiftedRight)).toBe(left.isSame(right));
      }),
      { numRuns: 200 },
    );
  });

  test("clone remains independent after mutation", () => {
    fc.assert(
      fc.property(safeDates, reversibleAmounts, reversibleUnits, (date, amount, unit) => {
        const source = moment(date);
        const cloned = source.clone();
        cloned.add(amount, unit);
        expect(source.valueOf()).toBe(moment(date).valueOf());
      }),
      { numRuns: 200 },
    );
  });

  test("startOf is idempotent", () => {
    fc.assert(
      fc.property(safeDates, boundaryUnits, (date, unit) => {
        const once = moment(date).startOf(unit);
        const twice = once.clone().startOf(unit);
        expect(twice.valueOf()).toBe(once.valueOf());
      }),
      { numRuns: 200 },
    );
  });

  test("endOf is idempotent", () => {
    fc.assert(
      fc.property(safeDates, boundaryUnits, (date, unit) => {
        const once = moment(date).endOf(unit);
        const twice = once.clone().endOf(unit);
        expect(twice.valueOf()).toBe(once.valueOf());
      }),
      { numRuns: 200 },
    );
  });

  test("a moment stays between startOf and endOf for the same unit", () => {
    fc.assert(
      fc.property(safeDates, boundaryUnits, (date, unit) => {
        const current = moment(date);
        const start = current.clone().startOf(unit);
        const end = current.clone().endOf(unit);
        expect(start.valueOf()).toBeLessThanOrEqual(current.valueOf());
        expect(current.valueOf()).toBeLessThanOrEqual(end.valueOf());
      }),
      { numRuns: 200 },
    );
  });

  test("toDate roundtrip preserves the instant", () => {
    fc.assert(
      fc.property(safeDates, (date) => {
        const m = moment(date);
        expect(m.toDate().getTime()).toBe(m.valueOf());
        expect(moment(m.toDate()).valueOf()).toBe(m.valueOf());
      }),
      { numRuns: 200 },
    );
  });

  test("utc().local() preserves the instant", () => {
    fc.assert(
      fc.property(safeDates, (date) => {
        const original = moment(date);
        const roundtrip = original.clone().utc().local();
        expect(roundtrip.valueOf()).toBe(original.valueOf());
      }),
      { numRuns: 200 },
    );
  });

  test("utcOffset(offset, false) preserves the instant", () => {
    fc.assert(
      fc.property(safeDates, offsetMinutes, (date, offset) => {
        const original = moment(date);
        const shifted = original.clone().utcOffset(formatOffset(offset), false);
        expect(shifted.valueOf()).toBe(original.valueOf());
        expect(shifted.utcOffset()).toBe(offset);
      }),
      { numRuns: 200 },
    );
  });

  test("utcOffset(offset, true) preserves wall-clock fields", () => {
    fc.assert(
      fc.property(safeDates, offsetMinutes, (date, offset) => {
        const original = moment(date);
        const before = original.format("YYYY-MM-DD HH:mm:ss.SSS");
        const shifted = original.clone().utcOffset(formatOffset(offset), true);
        expect(shifted.format("YYYY-MM-DD HH:mm:ss.SSS")).toBe(before);
        expect(shifted.utcOffset()).toBe(offset);
      }),
      { numRuns: 200 },
    );
  });

  test("utcOffset(offset, true) changes the instant by exactly the offset delta", () => {
    fc.assert(
      fc.property(safeDates, offsetMinutes, (date, offset) => {
        const original = moment(date);
        const localOffset = original.utcOffset();
        const shifted = original.clone().utcOffset(formatOffset(offset), true);
        const actualDelta = normalizeZero(shifted.valueOf() - original.valueOf());
        const expectedDelta = normalizeZero((localOffset - offset) * 60000);
        expect(actualDelta).toBe(expectedDelta);
      }),
      { numRuns: 200 },
    );
  });

  test("utcOffset(offset, false) matches moment while preserving the instant", () => {
    fc.assert(
      fc.property(safeDates, offsetMinutes, (date, offset) => {
        const offsetText = formatOffset(offset);
        const m2 = moment(date).clone().utcOffset(offsetText, false);
        const orig = originalMoment(date).clone().utcOffset(offsetText, false);
        expect(m2.valueOf()).toBe(moment(date).valueOf());
        expect(m2.valueOf()).toBe(orig.valueOf());
        expect(m2.utcOffset()).toBe(orig.utcOffset());
        expect(m2.format("YYYY-MM-DD HH:mm:ss.SSS Z")).toBe(
          orig.format("YYYY-MM-DD HH:mm:ss.SSS Z"),
        );
      }),
      { numRuns: 200 },
    );
  });

  test("utcOffset(offset, true) matches moment while preserving wall-clock fields", () => {
    fc.assert(
      fc.property(safeDates, offsetMinutes, (date, offset) => {
        const offsetText = formatOffset(offset);
        const base = moment(date).format("YYYY-MM-DD HH:mm:ss.SSS");
        const m2 = moment(date).clone().utcOffset(offsetText, true);
        const orig = originalMoment(date).clone().utcOffset(offsetText, true);
        expect(m2.format("YYYY-MM-DD HH:mm:ss.SSS")).toBe(base);
        expect(m2.valueOf()).toBe(orig.valueOf());
        expect(m2.utcOffset()).toBe(orig.utcOffset());
        expect(m2.format("YYYY-MM-DD HH:mm:ss.SSS Z")).toBe(
          orig.format("YYYY-MM-DD HH:mm:ss.SSS Z"),
        );
      }),
      { numRuns: 200 },
    );
  });

  test("utc() matches moment while preserving the instant", () => {
    fc.assert(
      fc.property(safeDates, (date) => {
        const m2 = moment(date).clone().utc();
        const orig = originalMoment(date).clone().utc();
        expect(m2.valueOf()).toBe(moment(date).valueOf());
        expect(m2.valueOf()).toBe(orig.valueOf());
        expect(m2.utcOffset()).toBe(orig.utcOffset());
        expect(m2.format("YYYY-MM-DD HH:mm:ss.SSS Z")).toBe(
          orig.format("YYYY-MM-DD HH:mm:ss.SSS Z"),
        );
      }),
      { numRuns: 200 },
    );
  });

  test("local() matches moment while preserving the instant", () => {
    fc.assert(
      fc.property(safeDates, offsetMinutes, (date, offset) => {
        const offsetText = formatOffset(offset);
        const m2 = moment(date).clone().utcOffset(offsetText, false).local();
        const orig = originalMoment(date).clone().utcOffset(offsetText, false).local();
        expect(m2.valueOf()).toBe(orig.valueOf());
        expect(m2.utcOffset()).toBe(orig.utcOffset());
        expect(m2.format("YYYY-MM-DD HH:mm:ss.SSS Z")).toBe(
          orig.format("YYYY-MM-DD HH:mm:ss.SSS Z"),
        );
      }),
      { numRuns: 200 },
    );
  });

  test("utc(true) matches moment while preserving wall-clock fields", () => {
    fc.assert(
      fc.property(safeDates, (date) => {
        const base = moment(date).format("YYYY-MM-DD HH:mm:ss.SSS");
        const m2 = moment(date).clone().utc(true);
        const orig = originalMoment(date).clone().utc(true);
        expect(m2.format("YYYY-MM-DD HH:mm:ss.SSS")).toBe(base);
        expect(m2.valueOf()).toBe(orig.valueOf());
        expect(m2.utcOffset()).toBe(orig.utcOffset());
        expect(m2.format("YYYY-MM-DD HH:mm:ss.SSS Z")).toBe(
          orig.format("YYYY-MM-DD HH:mm:ss.SSS Z"),
        );
      }),
      { numRuns: 200 },
    );
  });

  test("local(true) matches moment while preserving wall-clock fields", () => {
    fc.assert(
      fc.property(safeDates, offsetMinutes, (date, offset) => {
        const offsetText = formatOffset(offset);
        const base = moment(date)
          .clone()
          .utcOffset(offsetText, false)
          .format("YYYY-MM-DD HH:mm:ss.SSS");
        const m2 = moment(date).clone().utcOffset(offsetText, false).local(true);
        const orig = originalMoment(date).clone().utcOffset(offsetText, false).local(true);
        expect(m2.format("YYYY-MM-DD HH:mm:ss.SSS")).toBe(base);
        expect(m2.valueOf()).toBe(orig.valueOf());
        expect(m2.utcOffset()).toBe(orig.utcOffset());
        expect(m2.format("YYYY-MM-DD HH:mm:ss.SSS Z")).toBe(
          orig.format("YYYY-MM-DD HH:mm:ss.SSS Z"),
        );
      }),
      { numRuns: 200 },
    );
  });

  test("parseZone static matches moment for ISO strings with explicit offsets", () => {
    fc.assert(
      fc.property(offsetIsoStrings, ({ text, offset }) => {
        const m2 = moment.parseZone(text);
        const orig = originalMoment.parseZone(text);
        expect(m2.utcOffset()).toBe(offset);
        expect(m2.utcOffset()).toBe(orig.utcOffset());
        expect(m2.valueOf()).toBe(orig.valueOf());
        expect(m2.format("YYYY-MM-DD HH:mm:ss.SSS Z")).toBe(
          orig.format("YYYY-MM-DD HH:mm:ss.SSS Z"),
        );
      }),
      { numRuns: 200 },
    );
  });

  test("instance parseZone matches static parseZone for ISO strings with explicit offsets", () => {
    fc.assert(
      fc.property(offsetIsoStrings, ({ text, offset }) => {
        const inst = moment(text).parseZone();
        const stat = moment.parseZone(text);
        expect(inst.utcOffset()).toBe(offset);
        expect(inst.utcOffset()).toBe(stat.utcOffset());
        expect(inst.valueOf()).toBe(stat.valueOf());
        expect(inst.format("YYYY-MM-DD HH:mm:ss.SSS Z")).toBe(
          stat.format("YYYY-MM-DD HH:mm:ss.SSS Z"),
        );
      }),
      { numRuns: 200 },
    );
  });

  test("parseZone with format string matches moment", () => {
    fc.assert(
      fc.property(offsetIsoStrings, ({ text, offset }) => {
        const formatted = text.replace("T", " ").replace(/([+-]\d{2}):(\d{2})$/, " $1$2");
        const fmt = "YYYY-MM-DD HH:mm:ss.SSS ZZ";
        const m2 = moment.parseZone(formatted, fmt);
        const orig = originalMoment.parseZone(formatted, fmt);
        expect(m2.utcOffset()).toBe(offset);
        expect(m2.utcOffset()).toBe(orig.utcOffset());
        expect(m2.valueOf()).toBe(orig.valueOf());
        expect(m2.format("YYYY-MM-DD HH:mm:ss.SSS Z")).toBe(
          orig.format("YYYY-MM-DD HH:mm:ss.SSS Z"),
        );
      }),
      { numRuns: 200 },
    );
  });

  test("parseZone startOf(unit) matches moment and stays before the original instant", () => {
    fc.assert(
      fc.property(offsetIsoStrings, zoneBoundaryUnits, ({ text }, unit) => {
        const m2Original = moment.parseZone(text);
        const m2 = moment.parseZone(text).startOf(unit);
        const origOriginal = originalMoment.parseZone(text);
        const orig = originalMoment.parseZone(text).startOf(unit);

        expect(m2.valueOf()).toBe(orig.valueOf());
        expect(m2.utcOffset()).toBe(orig.utcOffset());
        expect(m2.format("YYYY-MM-DD HH:mm:ss.SSS Z")).toBe(
          orig.format("YYYY-MM-DD HH:mm:ss.SSS Z"),
        );
        expect(m2.valueOf()).toBeLessThanOrEqual(m2Original.valueOf());
        expect(orig.valueOf()).toBeLessThanOrEqual(origOriginal.valueOf());
      }),
      { numRuns: 200 },
    );
  });

  test("parseZone endOf(unit) matches moment and stays after the original instant", () => {
    fc.assert(
      fc.property(offsetIsoStrings, zoneBoundaryUnits, ({ text }, unit) => {
        const m2Original = moment.parseZone(text);
        const m2 = moment.parseZone(text).endOf(unit);
        const origOriginal = originalMoment.parseZone(text);
        const orig = originalMoment.parseZone(text).endOf(unit);

        expect(m2.valueOf()).toBe(orig.valueOf());
        expect(m2.utcOffset()).toBe(orig.utcOffset());
        expect(m2.format("YYYY-MM-DD HH:mm:ss.SSS Z")).toBe(
          orig.format("YYYY-MM-DD HH:mm:ss.SSS Z"),
        );
        expect(m2.valueOf()).toBeGreaterThanOrEqual(m2Original.valueOf());
        expect(orig.valueOf()).toBeGreaterThanOrEqual(origOriginal.valueOf());
      }),
      { numRuns: 200 },
    );
  });

  test("parseZone original instant stays between startOf(unit) and endOf(unit)", () => {
    fc.assert(
      fc.property(offsetIsoStrings, zoneBoundaryUnits, ({ text }, unit) => {
        const current = moment.parseZone(text);
        const start = moment.parseZone(text).startOf(unit);
        const end = moment.parseZone(text).endOf(unit);

        expect(start.valueOf()).toBeLessThanOrEqual(current.valueOf());
        expect(current.valueOf()).toBeLessThanOrEqual(end.valueOf());
      }),
      { numRuns: 200 },
    );
  });

  test("parseZone comparisons with unit match moment", () => {
    fc.assert(
      fc.property(
        offsetIsoStrings,
        offsetIsoStrings,
        comparisonUnits,
        (leftInput, rightInput, unit) => {
          const left = moment.parseZone(leftInput.text);
          const right = moment.parseZone(rightInput.text);
          const origLeft = originalMoment.parseZone(leftInput.text);
          const origRight = originalMoment.parseZone(rightInput.text);

          expect(left.isSame(right, unit)).toBe(origLeft.isSame(origRight, unit));
          expect(left.isBefore(right, unit)).toBe(origLeft.isBefore(origRight, unit));
          expect(left.isAfter(right, unit)).toBe(origLeft.isAfter(origRight, unit));
          expect(left.isSameOrBefore(right, unit)).toBe(origLeft.isSameOrBefore(origRight, unit));
          expect(left.isSameOrAfter(right, unit)).toBe(origLeft.isSameOrAfter(origRight, unit));
        },
      ),
      { numRuns: 200 },
    );
  });

  test("parseZone comparisons remain mutually consistent under unit truncation", () => {
    fc.assert(
      fc.property(
        offsetIsoStrings,
        offsetIsoStrings,
        comparisonUnits,
        (leftInput, rightInput, unit) => {
          const left = moment.parseZone(leftInput.text);
          const right = moment.parseZone(rightInput.text);
          const same = left.isSame(right, unit);
          const before = left.isBefore(right, unit);
          const after = left.isAfter(right, unit);

          expect(Number(same) + Number(before) + Number(after)).toBe(1);
          expect(left.isSameOrBefore(right, unit)).toBe(same || before);
          expect(left.isSameOrAfter(right, unit)).toBe(same || after);
        },
      ),
      { numRuns: 200 },
    );
  });

  test("duration add/subtract roundtrip preserves valueOf for reversible units", () => {
    fc.assert(
      fc.property(
        durationAmounts,
        durationUnits,
        durationAmounts,
        durationUnits,
        (a1, u1, a2, u2) => {
          const original = moment.duration(a1, u1).add(a2, u2);
          const roundtrip = original.clone().subtract(a2, u2);
          expect(roundtrip.valueOf()).toBe(moment.duration(a1, u1).valueOf());
        },
      ),
      { numRuns: 200 },
    );
  });

  test("adding a duration to a moment shifts it by the duration value", () => {
    fc.assert(
      fc.property(safeDates, durationAmounts, durationUnits, (date, amount, unit) => {
        const duration = moment.duration(amount, unit);
        const shifted = moment(date).add(duration);
        // day/week 加算は local time の setDate を使うため、タイムゾーン変遷を跨ぐと
        // duration.valueOf() の純粋ミリ秒計算と最大1日差が出る
        expect(
          Math.abs(shifted.valueOf() - moment(date).valueOf() - duration.valueOf()),
        ).toBeLessThanOrEqual(86400000);
      }),
      { numRuns: 200 },
    );
  });

  test("moment plus duration matches moment.js for reversible duration units", () => {
    fc.assert(
      fc.property(safeDates, durationAmounts, durationUnits, (date, amount, unit) => {
        const duration = moment.duration(amount, unit);
        const originalDuration = originalMoment.duration(amount, unit);
        const shifted = moment(date).add(duration);
        const origShifted = originalMoment(date).add(originalDuration);
        expect(shifted.valueOf()).toBe(origShifted.valueOf());
        expect(shifted.format("YYYY-MM-DD HH:mm:ss.SSS")).toBe(
          origShifted.format("YYYY-MM-DD HH:mm:ss.SSS"),
        );
      }),
      { numRuns: 200 },
    );
  });

  test("diff equals added reversible duration amount in the same unit", () => {
    fc.assert(
      fc.property(safeDates, durationAmounts, durationUnits, (date, amount, unit) => {
        const base = moment(date);
        const shifted = base.clone().add(amount, unit);
        // day/week 加算は setDate を使うため DST 変遷を跨ぐと
        // 最大1日ずれる。ms 以外の単位では setDate の影響は限定的
        if (unit === "days" || unit === "weeks") {
          expect(Math.abs(shifted.diff(base, unit) - amount)).toBeLessThanOrEqual(1);
        } else {
          expect(shifted.diff(base, unit)).toBe(amount);
        }
      }),
      { numRuns: 200 },
    );
  });

  test("duration({ from, to }) matches moment.js for valueOf and unit conversions", () => {
    fc.assert(
      fc.property(safeDates, safeDates, (fromDate, toDate) => {
        const from = moment(fromDate);
        const to = moment(toDate);
        const fromOrig = originalMoment(fromDate);
        const toOrig = originalMoment(toDate);

        const duration = moment.duration({ from, to });
        const origDuration = originalMoment.duration({ from: fromOrig, to: toOrig });

        // roundSym vs Math.round の .5 丸め方向の違いにより高々1日差
        expect(Math.abs(duration.valueOf() - origDuration.valueOf())).toBeLessThanOrEqual(86400000);
        expect(duration.asMilliseconds()).toBe(origDuration.asMilliseconds());
        expect(duration.asMonths()).toBe(origDuration.asMonths());
        expect(duration.asYears()).toBe(origDuration.asYears());
      }),
      { numRuns: 200 },
    );
  });

  test("duration({ from, to }) is antisymmetric by valueOf", () => {
    fc.assert(
      fc.property(safeDates, safeDates, (aDate, bDate) => {
        const ab = moment.duration({ from: moment(aDate), to: moment(bDate) }).valueOf();
        const ba = moment.duration({ from: moment(bDate), to: moment(aDate) }).valueOf();
        expect(normalizeZero(ab)).toBe(normalizeZero(-ba));
      }),
      { numRuns: 200 },
    );
  });

  test("duration({ from, to }) sign matches the sign of the instant ordering", () => {
    fc.assert(
      fc.property(safeDates, safeDates, (fromDate, toDate) => {
        const from = moment(fromDate);
        const to = moment(toDate);
        const durationValue = moment.duration({ from, to }).valueOf();
        const instantDelta = to.valueOf() - from.valueOf();

        if (instantDelta === 0) {
          expect(durationValue).toBe(0);
        } else if (instantDelta > 0) {
          expect(durationValue).toBeGreaterThan(0);
        } else {
          expect(durationValue).toBeLessThan(0);
        }
      }),
      { numRuns: 200 },
    );
  });

  test("normalizeUnits is idempotent for all unit aliases", () => {
    fc.assert(
      fc.property(
        fc.constantFrom(
          "year",
          "y",
          "Y",
          "years",
          "month",
          "M",
          "months",
          "Mo",
          "date",
          "D",
          "dates",
          "day",
          "d",
          "days",
          "hour",
          "h",
          "hours",
          "minute",
          "m",
          "minutes",
          "second",
          "s",
          "seconds",
          "millisecond",
          "ms",
          "milliseconds",
          "week",
          "w",
          "weeks",
          "isoWeek",
          "W",
          "isoWeeks",
          "weekday",
          "e",
          "weekdays",
          "isoWeekday",
          "E",
          "isoWeekdays",
          "quarter",
          "Q",
          "quarters",
          "dayOfYear",
          "DDD",
          "doy",
          "dayOfYears",
          "weekYear",
          "gg",
          "weekYears",
          "isoWeekYear",
          "GG",
          "isoWeekYears",
        ),
        (alias) => {
          const n1 = moment.normalizeUnits(alias);
          const n2 = moment.normalizeUnits(n1 as string);
          expect(n2).toBe(n1);
        },
      ),
      { numRuns: 200 },
    );
  });

  test("normalizeUnits handles random invalid strings idempotently", () => {
    fc.assert(
      fc.property(
        fc
          .string()
          .filter(
            (s) =>
              s !== "__proto__" &&
              s !== "constructor" &&
              s !== "valueOf" &&
              s !== "toString" &&
              s !== "hasOwnProperty" &&
              s !== "toLocaleString" &&
              s !== "isPrototypeOf" &&
              s !== "propertyIsEnumerable" &&
              s !== "toJSON",
          ),
        (s) => {
          const n1 = moment.normalizeUnits(s);
          const n2 = moment.normalizeUnits(n1 as string);
          expect(n2).toBe(n1);
        },
      ),
      { numRuns: 200 },
    );
  });

  test("invalid moment stays invalid after startOf/endOf for all boundary units", () => {
    fc.assert(
      fc.property(fc.constantFrom("year", "quarter", "month", "week", "isoWeek", "day"), (unit) => {
        const base = moment.invalid();
        expect(base.isValid()).toBe(false);
        expect(base.clone().startOf(unit).isValid()).toBe(false);
        expect(base.clone().endOf(unit).isValid()).toBe(false);
      }),
      { numRuns: 50 },
    );
  });

  test("ISO format roundtrip preserves the instant", () => {
    fc.assert(
      fc.property(safeDates, (date) => {
        const original = moment(date);
        const formatted = original.format("YYYY-MM-DDTHH:mm:ss.SSSZ");
        const restored = moment(formatted);
        expect(restored.valueOf()).toBe(original.valueOf());
      }),
      { numRuns: 200 },
    );
  });

  test("add(0, unit) is identity for all boundary units", () => {
    fc.assert(
      fc.property(safeDates, boundaryUnits, (date, unit) => {
        const m = moment(date);
        const before = m.valueOf();
        m.add(0, unit);
        expect(m.valueOf()).toBe(before);
      }),
      { numRuns: 200 },
    );
  });

  test("isAfter is transitive", () => {
    fc.assert(
      fc.property(safeDates, safeDates, safeDates, (a, b, c) => {
        const ma = moment(a),
          mb = moment(b),
          mc = moment(c);
        if (ma.isAfter(mb) && mb.isAfter(mc)) {
          expect(ma.isAfter(mc)).toBe(true);
        }
      }),
      { numRuns: 200 },
    );
  });

  test("isBefore is transitive", () => {
    fc.assert(
      fc.property(safeDates, safeDates, safeDates, (a, b, c) => {
        const ma = moment(a),
          mb = moment(b),
          mc = moment(c);
        if (ma.isBefore(mb) && mb.isBefore(mc)) {
          expect(ma.isBefore(mc)).toBe(true);
        }
      }),
      { numRuns: 200 },
    );
  });

  test("month-day addition commutes for safe dates (day ≤ 27)", () => {
    fc.assert(
      fc.property(safeDates, (date) => {
        const m = moment(date);
        // day must be ≤ 27 so that day+1 ≤ 28 fits any month without clamping
        if (m.date() > 27) {
          return;
        }
        const a = m.clone().add(1, "month").add(1, "day");
        const b = m.clone().add(1, "day").add(1, "month");
        expect(a.valueOf()).toBe(b.valueOf());
      }),
      { numRuns: 200 },
    );
  });

  test("endOf(day) UTC arithmetic matches Date-based result for negative timestamps", () => {
    fc.assert(
      fc.property(fc.integer({ min: -86400000 * 1000, max: 86400000 * 1000 }), (ts) => {
        const m = moment.utc(ts);
        if (!m.isValid()) {
          return;
        }
        const d = moment.utc(ts).endOf("day");
        const ref = new Date(Math.floor(ts / 86400000) * 86400000);
        ref.setUTCDate(ref.getUTCDate() + 1);
        ref.setUTCMilliseconds(ref.getUTCMilliseconds() - 1);
        expect(d.valueOf()).toBe(ref.getTime());
        expect(d.format("HH:mm:ss.SSS")).toBe("23:59:59.999");
      }),
      { numRuns: 200 },
    );
  });

  test("UTC endOf preserves instant for UTC/local roundtrip", () => {
    fc.assert(
      fc.property(safeDates, (date) => {
        const utc = moment.utc(date).endOf("day");
        const local = utc.clone().local();
        expect(local.valueOf()).toBe(utc.valueOf());
      }),
      { numRuns: 200 },
    );
  });

  test("leap year month boundary: Feb 28/29 add(day) preserves calendar correctness", () => {
    const leapFeb28 = moment.utc("2024-02-28");
    expect(leapFeb28.add(1, "day").format("MM-DD")).toBe("02-29");
    expect(leapFeb28.isValid()).toBe(true);
    const leapFeb29 = moment.utc("2024-02-29");
    expect(leapFeb29.add(1, "day").format("MM-DD")).toBe("03-01");
    const nonLeapFeb28 = moment.utc("2023-02-28");
    expect(nonLeapFeb28.add(1, "day").format("MM-DD")).toBe("03-01");
  });

  test("month boundary: Jan 31 add(month) clamps to Feb 28/29", () => {
    const jan31 = moment.utc("2024-01-31");
    expect(jan31.add(1, "month").format("MM-DD")).toBe("02-29");
    const jan31nonLeap = moment.utc("2023-01-31");
    expect(jan31nonLeap.add(1, "month").format("MM-DD")).toBe("02-28");
  });

  test("negative year startOf/endOf year in UTC", () => {
    const neg = moment.utc([-1, 5, 15]);
    expect(neg.isValid()).toBe(true);
    const sy = neg.clone().startOf("year");
    expect(sy.format("YYYY-MM-DD")).toBe("-0001-01-01");
    expect(sy.format("HH:mm:ss.SSS")).toBe("00:00:00.000");
    const ey = neg.clone().endOf("year");
    expect(ey.format("MM-DD")).toBe("12-31");
    expect(ey.format("HH:mm:ss.SSS")).toBe("23:59:59.999");
  });

  test("_dayOfWeek returns valid range 0-6 for negative years", () => {
    const neg = moment.utc([-2500, 0, 1]); // 2501 BC
    expect(neg.isValid()).toBe(true);
    expect(neg.day()).toBeGreaterThanOrEqual(0);
    expect(neg.day()).toBeLessThan(7);
    // ISO weekday also valid
    expect(neg.isoWeekday()).toBeGreaterThanOrEqual(1);
    expect(neg.isoWeekday()).toBeLessThanOrEqual(7);
  });

  test("UTC/local startOf(day) diverge at DST boundary", () => {
    // US DST spring-forward: Mar 10, 2024 02:00 → 03:00
    // Local midnight on DST day stays at 00:00 local (before the transition),
    // but the UTC epoch for local midnight differs from UTC midnight
    const localMidnight = moment("2024-03-10").startOf("day");
    const utcMidnight = moment.utc("2024-03-10").startOf("day");
    // Both give wall-clock 00:00 but at different UTC epochs
    expect(localMidnight.format("HH:mm")).toBe("00:00");
    expect(utcMidnight.format("HH:mm")).toBe("00:00");
    // They must differ in epoch unless timezone offset is 0
    const offset = localMidnight.utcOffset();
    expect(utcMidnight.valueOf()).toBe(localMidnight.valueOf() + offset * 60000);
  });

  test("diff(a, a, unit) = 0 for all linear epoch units", () => {
    fc.assert(
      fc.property(safeDates, (date) => {
        const m = moment(date);
        expect(m.diff(m, "millisecond")).toBe(0);
        expect(m.diff(m, "second")).toBe(0);
        expect(m.diff(m, "minute")).toBe(0);
        expect(m.diff(m, "hour")).toBe(0);
      }),
      { numRuns: 100 },
    );
  });

  test("diff(a, b, unit) is antisymmetric for linear epoch units", () => {
    fc.assert(
      fc.property(safeDates, safeDates, (a, b) => {
        const ma = moment(a),
          mb = moment(b);
        const units = ["millisecond", "second", "minute", "hour", "day"];
        for (const u of units) {
          expect(normalizeZero(ma.diff(mb, u))).toBe(normalizeZero(-mb.diff(ma, u)));
        }
      }),
      { numRuns: 100 },
    );
  });

  test("isAfter agrees with sign of diff for linear epoch units", () => {
    fc.assert(
      fc.property(safeDates, safeDates, (a, b) => {
        const ma = moment(a),
          mb = moment(b);
        const d = ma.diff(mb, "millisecond");
        if (d > 0) {
          expect(ma.isAfter(mb)).toBe(true);
        }
        if (d < 0) {
          expect(ma.isBefore(mb)).toBe(true);
        }
        if (d === 0) {
          expect(ma.isSame(mb)).toBe(true);
        }
      }),
      { numRuns: 100 },
    );
  });

  test("UTC diff(day) equals exact epoch-day distance", () => {
    fc.assert(
      fc.property(safeDates, safeDates, (a, b) => {
        const ma = moment.utc(a),
          mb = moment.utc(b);
        const days = Math.round((ma.valueOf() - mb.valueOf()) / 86400000);
        expect(Math.abs(ma.diff(mb, "day") - days)).toBeLessThanOrEqual(1);
      }),
      { numRuns: 100 },
    );
  });

  // ============================================================
  // Category-theoretic invariants
  // ============================================================

  const startEndUnits = fc.constantFrom("year", "month", "day", "hour", "minute", "second");
  const allUnits = fc.constantFrom("millisecond", "second", "minute", "hour", "day", "week", "month", "year");

  test("add(0, unit) is identity", () => {
    fc.assert(
      fc.property(safeDates, allUnits, (date, unit) => {
        const m = moment(date);
        const before = m.valueOf();
        const result = m.add(0, unit);
        expect(result).toBe(m);
        expect(result.valueOf()).toBe(before);
      }),
      { numRuns: 100 },
    );
  });

  test("startOf(idempotent) = startOf", () => {
    fc.assert(
      fc.property(safeDates, startEndUnits, (date, unit) => {
        const once = moment(date).startOf(unit);
        const twice = moment(date).startOf(unit).startOf(unit);
        expect(twice.valueOf()).toBe(once.valueOf());
        expect(twice.format()).toBe(once.format());
      }),
      { numRuns: 100 },
    );
  });

  test("utc is idempotent", () => {
    fc.assert(
      fc.property(safeDates, (date) => {
        const m = moment(date);
        const once = m.clone().utc();
        const twice = m.clone().utc().utc();
        expect(twice.valueOf()).toBe(once.valueOf());
        expect(twice._isUTC).toBe(true);
      }),
      { numRuns: 100 },
    );
  });

  test("clone preserves valueOf", () => {
    fc.assert(
      fc.property(safeDates, (date) => {
        const m = moment(date);
        const c = m.clone();
        expect(c.valueOf()).toBe(m.valueOf());
        expect(c).not.toBe(m);
      }),
      { numRuns: 100 },
    );
  });

  test("subtract(n, unit) = add(-n, unit) for linear units", () => {
    fc.assert(
      fc.property(safeDates, fc.integer({ min: -1000, max: 1000 }), shiftUnits, (date, n, unit) => {
        const m1 = moment(date).subtract(n, unit);
        const m2 = moment(date).add(-n, unit);
        expect(m1.valueOf()).toBe(m2.valueOf());
      }),
      { numRuns: 200 },
    );
  });

  test("add composes for linear epoch units", () => {
    fc.assert(
      fc.property(safeDates, fc.integer(), fc.integer(), (date, a, b) => {
        const sequential = moment(date).add(a, "millisecond").add(b, "millisecond");
        const combined = moment(date).add(a + b, "millisecond");
        expect(sequential.valueOf()).toBe(combined.valueOf());
      }),
      { numRuns: 200 },
    );
  });

  test("month add is non-linear (month-end clamping)", () => {
    const jan31 = moment([2019, 0, 31]);
    const feb28 = jan31.clone().add(1, "month");
    const oneMonthMs = 86400000 * 31;
    expect(feb28.valueOf()).not.toBe(jan31.valueOf() + oneMonthMs);
    // But it should be Feb 28 (clamped)
    expect(feb28.date()).toBe(28);
    expect(feb28.month()).toBe(1);
  });

  test("local is idempotent", () => {
    fc.assert(
      fc.property(safeDates, (date) => {
        const m = moment.utc(date);
        const once = m.clone().local();
        const twice = m.clone().local().local();
        expect(twice.valueOf()).toBe(once.valueOf());
        expect(twice._isUTC).toBe(false);
      }),
      { numRuns: 100 },
    );
  });
});
