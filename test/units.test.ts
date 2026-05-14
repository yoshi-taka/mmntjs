import { describe, test, expect } from "bun:test";
import { normalizeUnits, normalizeUnitCode, isLeapYear, daysInMonth } from "../src/units.ts";

describe("normalizeUnits", () => {
  test("recognizes all unit aliases", () => {
    const cases: [string, string | undefined][] = [
      ["year", "year"],
      ["years", "year"],
      ["y", "year"],
      ["Y", "year"],
      ["month", "month"],
      ["months", "month"],
      ["M", "month"],
      ["date", "date"],
      ["dates", "date"],
      ["D", "date"],
      ["day", "day"],
      ["days", "day"],
      ["d", "day"],
      ["hour", "hour"],
      ["hours", "hour"],
      ["h", "hour"],
      ["minute", "minute"],
      ["minutes", "minute"],
      ["m", "minute"],
      ["second", "second"],
      ["seconds", "second"],
      ["s", "second"],
      ["millisecond", "millisecond"],
      ["milliseconds", "millisecond"],
      ["ms", "millisecond"],
      ["week", "week"],
      ["weeks", "week"],
      ["w", "week"],
      ["isoWeek", "isoWeek"],
      ["isoWeeks", "isoWeek"],
      ["W", "isoWeek"],
      ["weekday", "weekday"],
      ["weekdays", "weekday"],
      ["e", "weekday"],
      ["isoWeekday", "isoWeekday"],
      ["isoWeekdays", "isoWeekday"],
      ["E", "isoWeekday"],
      ["quarter", "quarter"],
      ["quarters", "quarter"],
      ["Q", "quarter"],
      ["dayOfYear", "dayOfYear"],
      ["dayOfYears", "dayOfYear"],
      ["DDD", "dayOfYear"],
      ["weekYear", "weekYear"],
      ["weekYears", "weekYear"],
      ["gg", "weekYear"],
      ["isoWeekYear", "isoWeekYear"],
      ["isoWeekYears", "isoWeekYear"],
      ["GG", "isoWeekYear"],
    ];
    for (const [input, expected] of cases) {
      expect(normalizeUnits(input)).toBe(expected as ReturnType<typeof normalizeUnits>);
    }
  });

  test("returns undefined for unknown input", () => {
    expect(normalizeUnits("")).toBeUndefined();
    expect(normalizeUnits("foo")).toBeUndefined();
    expect(normalizeUnits("xyz")).toBeUndefined();
  });
});

describe("normalizeUnitCode", () => {
  test("returns correct codes for known units", () => {
    expect(normalizeUnitCode("year")).toBe(0);
    expect(normalizeUnitCode("month")).toBe(1);
    expect(normalizeUnitCode("date")).toBe(2);
    expect(normalizeUnitCode("hour")).toBe(3);
    expect(normalizeUnitCode("minute")).toBe(4);
    expect(normalizeUnitCode("second")).toBe(5);
    expect(normalizeUnitCode("millisecond")).toBe(6);
    expect(normalizeUnitCode("week")).toBe(7);
    expect(normalizeUnitCode("weekday")).toBe(8);
    expect(normalizeUnitCode("dayOfYear")).toBe(9);
    expect(normalizeUnitCode("quarter")).toBe(10);
    expect(normalizeUnitCode("isoWeek")).toBe(11);
    expect(normalizeUnitCode("isoWeekday")).toBe(12);
    expect(normalizeUnitCode("weekYear")).toBe(13);
    expect(normalizeUnitCode("isoWeekYear")).toBe(14);
    expect(normalizeUnitCode("day")).toBe(15);
  });

  test("returns INVALID_UNIT for unknown input", () => {
    expect(normalizeUnitCode("")).toBe(-1);
    expect(normalizeUnitCode("foo")).toBeUndefined();
  });
});

describe("isLeapYear", () => {
  test("returns true for leap years", () => {
    expect(isLeapYear(2024)).toBe(true);
    expect(isLeapYear(2000)).toBe(true);
    expect(isLeapYear(1600)).toBe(true);
    expect(isLeapYear(0)).toBe(true);
  });

  test("returns false for non-leap years", () => {
    expect(isLeapYear(2023)).toBe(false);
    expect(isLeapYear(1900)).toBe(false);
    expect(isLeapYear(2100)).toBe(false);
    expect(isLeapYear(1)).toBe(false);
  });

  test("returns false for non-finite values", () => {
    expect(isLeapYear(Infinity)).toBe(false);
    expect(isLeapYear(-Infinity)).toBe(false);
    expect(isLeapYear(NaN)).toBe(false);
  });
});

describe("daysInMonth", () => {
  test("returns correct days for each month", () => {
    expect(daysInMonth(2024, 0)).toBe(31);
    expect(daysInMonth(2024, 1)).toBe(29);
    expect(daysInMonth(2023, 1)).toBe(28);
    expect(daysInMonth(2024, 3)).toBe(30);
  });

  test("returns NaN for NaN year/month", () => {
    expect(daysInMonth(NaN, 0)).toBeNaN();
    expect(daysInMonth(2024, NaN)).toBeNaN();
  });

  test("handles negative month wrapping", () => {
    const result = daysInMonth(2024, -1);
    expect(result).toBe(31);
  });

  test("handles overflow month wrapping", () => {
    expect(daysInMonth(2024, 12)).toBe(31);
    expect(daysInMonth(2025, 1)).toBe(28);
  });
});
