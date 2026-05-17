import { describe, test, expect } from "bun:test";
import moment from "../src/index.ts";
import originalMoment from "../moment/moment.js";

// Equivalence class testing for locale functionality

describe("month index equivalence classes", () => {
  const validIndices = [0, 6, 11];
  const invalidIndices = [-1, 12, Number.NaN];

  test.each(validIndices)("months(%p) returns string for valid index", (index) => {
    const result = moment.months(index as number);
    expect(typeof result).toBe("string");
    expect((result as string).length).toBeGreaterThan(0);
  });

  test.each(invalidIndices)("months(%p) returns undefined for invalid index", (index) => {
    // moment.js also returns undefined for out-of-range indices
    const result = moment.months(index as number);
    expect(result).toBeUndefined();
  });

  test.each(validIndices)("monthsShort(%p) returns string for valid index", (index) => {
    const result = moment.monthsShort(index as number);
    expect(typeof result).toBe("string");
  });

  test.each(invalidIndices)("monthsShort(%p) returns undefined for invalid index", (index) => {
    const result = moment.monthsShort(index as number);
    expect(result).toBeUndefined();
  });
});

describe("weekday index equivalence classes", () => {
  const validIndices = [0, 3, 6];
  const invalidIndices = [-1, 7];

  test.each(validIndices)("weekdays(%p) returns string for valid index", (index) => {
    const result = moment.weekdays(index as number);
    expect(typeof result).toBe("string");
  });

  test.each(invalidIndices)("weekdays(%p) returns undefined for invalid index", (index) => {
    // moment.js returns undefined for out-of-range
    const result = moment.weekdays(index as number);
    expect(result).toBeUndefined();
  });

  test.each(validIndices)("weekdaysShort(%p) returns string", (index) => {
    const result = moment.weekdaysShort(index as number);
    expect(typeof result).toBe("string");
  });

  test.each(invalidIndices)("weekdaysShort(%p) returns undefined", (index) => {
    const result = moment.weekdaysShort(index as number);
    expect(result).toBeUndefined();
  });

  test.each(validIndices)("weekdaysMin(%p) returns string", (index) => {
    const result = moment.weekdaysMin(index as number);
    expect(typeof result).toBe("string");
  });

  test.each(invalidIndices)("weekdaysMin(%p) returns undefined", (index) => {
    const result = moment.weekdaysMin(index as number);
    expect(result).toBeUndefined();
  });
});

describe("en locale is fully available without registration", () => {
  test("localeData en matches moment.js", () => {
    const ld = moment.localeData("en");
    const old = originalMoment.localeData("en");
    expect(ld._months).toEqual(old._months);
    expect(ld._weekdays).toEqual(old._weekdays);
    expect(ld._abbr).toBe(old._abbr);
  });

  test("months() with format token matches moment.js (en)", () => {
    expect(moment.months("MMM", 0)).toBe(originalMoment.months("MMM", 0));
    expect(moment.months("MMMM", 0)).toBe(originalMoment.months("MMMM", 0));
  });

  test("weekdays with format token matches moment.js (en)", () => {
    expect(moment.weekdays("format")).toBe(originalMoment.weekdays("format"));
    expect(moment.weekdays("shortFormat")).toBe(originalMoment.weekdays("shortFormat"));
    expect(moment.weekdays("minFormat")).toBe(originalMoment.weekdays("minFormat"));
  });
});

describe("non-registered locales fall back to en", () => {
  const locales = ["fr", "de", "ja", "zh-cn", "ru", "ar", "ko", "it", "es"];

  test.each(locales)("%s localeData falls back to en months", (name) => {
    // Without explicit registration, moment2 uses en data
    const ld = moment.localeData(name);
    expect(ld._months).toBeDefined();
    expect(ld._months.length).toBe(12);
    // The locale is created but uses en as fallback
    expect(ld._abbr).toBe(name);
  });
});

describe("locale-extra week method equivalence", () => {
  const dateClasses = [
    ["2024-01-01", "start-of-year"],
    ["2024-06-15", "mid-year"],
    ["2024-12-31", "end-of-year"],
  ] as const;

  test.each(dateClasses)("weekday/week/weekYear on %s matches moment.js", (dateStr) => {
    const m = moment(dateStr);
    const o = originalMoment(dateStr);
    expect(m.weekday()).toBe(o.weekday());
    expect(m.week()).toBe(o.week());
    expect(m.weekYear()).toBe(o.weekYear());
    expect(m.isoWeek()).toBe(o.isoWeek());
    expect(m.isoWeekYear()).toBe(o.isoWeekYear());
  });
});

describe("long date format equivalence (uppercase only)", () => {
  const formats = ["L", "LL", "LLL", "LLLL", "LT", "LTS"];

  const testDate = moment("2024-06-15T14:30:45");

  test.each(formats)("format(%s) returns non-empty string", (fmt) => {
    const result = testDate.format(fmt);
    expect(typeof result).toBe("string");
    expect(result.length).toBeGreaterThan(0);
  });

  test.each(formats)("format(%s) matches moment.js oracle", (fmt) => {
    const m = moment("2024-06-15T14:30:45");
    const o = originalMoment("2024-06-15T14:30:45");
    expect(m.format(fmt)).toBe(o.format(fmt));
  });
});

describe("locale-aware startOf/endOf week equivalence", () => {
  const testDates = ["2024-01-15", "2024-06-15", "2024-09-01"];

  test.each(testDates)("startOf isoWeek on %s matches moment.js", (dateStr) => {
    const m = moment(dateStr).startOf("isoWeek");
    const o = originalMoment(dateStr).startOf("isoWeek");
    expect(m.valueOf()).toBe(o.valueOf());
    expect(m.format("YYYY-MM-DD")).toBe(o.format("YYYY-MM-DD"));
  });

  test.each(testDates)("endOf isoWeek on %s matches moment.js", (dateStr) => {
    const m = moment(dateStr).endOf("isoWeek");
    const o = originalMoment(dateStr).endOf("isoWeek");
    expect(m.valueOf()).toBe(o.valueOf());
    expect(m.format("YYYY-MM-DD")).toBe(o.format("YYYY-MM-DD"));
  });
});
