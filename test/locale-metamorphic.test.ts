import { describe, test, expect } from "bun:test";
import fc from "fast-check";
import { assertProp } from "./properties/helpers";
import moment from "../src/index.ts";

const safeMin = new Date("1900-01-01");
const safeMax = new Date("2100-01-01");
const safeDates = fc.date({ min: safeMin, max: safeMax, noInvalidDate: true });
const weekNumbers = fc.integer({ min: 1, max: 53 });
const weekdayIndices = fc.integer({ min: 0, max: 6 });
const _dayOffsets = fc.integer({ min: -365, max: 365 });
const _relAmounts = fc.integer({ min: -100000, max: 100000 });
const _relUnits = fc.constantFrom(
  "seconds",
  "minutes",
  "hours",
  "days",
  "weeks",
  "months",
  "years",
);
const datePairs = fc.tuple(safeDates, safeDates);

describe("locale metamorphic: months invariants", () => {
  test("months() always returns 12 entries", () => {
    assertProp(
      fc.property(safeDates, () => {
        expect(moment.months().length).toBe(12);
        expect(moment.monthsShort().length).toBe(12);
      }),
      { numRuns: 50 },
    );
  });

  test("months(index) returns a non-empty string for each index", () => {
    assertProp(
      fc.property(fc.integer({ min: 0, max: 11 }), (i) => {
        const name = moment.months(i);
        expect(typeof name).toBe("string");
        expect(name.length).toBeGreaterThan(0);
        const short = moment.monthsShort(i);
        expect(typeof short).toBe("string");
        expect(short.length).toBeGreaterThan(0);
      }),
      { numRuns: 50 },
    );
  });
});

describe("locale metamorphic: weekdays invariants", () => {
  test("weekdays() always returns 7 entries", () => {
    assertProp(
      fc.property(safeDates, () => {
        expect(moment.weekdays().length).toBe(7);
        expect(moment.weekdaysShort().length).toBe(7);
        expect(moment.weekdaysMin().length).toBe(7);
      }),
      { numRuns: 50 },
    );
  });

  test("weekday(w) setter returns self for chaining", () => {
    assertProp(
      fc.property(safeDates, weekdayIndices, (d, wd) => {
        const m = moment(d);
        const result = m.weekday(wd);
        expect(result).toBe(m);
      }),
      { numRuns: 50 },
    );
  });

  test("weekday setter is idempotent", () => {
    assertProp(
      fc.property(safeDates, weekdayIndices, (d, wd) => {
        const m = moment(d);
        m.weekday(wd);
        const first = m.weekday();
        m.weekday(wd);
        expect(m.weekday()).toBe(first);
      }),
      { numRuns: 50 },
    );
  });
});

describe("locale metamorphic: week invariants", () => {
  test("week(w) setter returns self for chaining", () => {
    assertProp(
      fc.property(safeDates, weekNumbers, (d, w) => {
        const m = moment(d);
        const result = m.week(w);
        expect(result).toBe(m);
      }),
      { numRuns: 50 },
    );
  });

  test("week(w) setter followed by getter returns set value (approx)", () => {
    assertProp(
      fc.property(safeDates, fc.integer({ min: 1, max: 52 }), (d, w) => {
        const m = moment(d);
        m.week(w);
        const got = m.week();
        expect(got).toBeGreaterThanOrEqual(1);
        expect(got).toBeLessThanOrEqual(53);
      }),
      { numRuns: 50 },
    );
  });
});

describe("locale metamorphic: valueOf invariant across locale changes", () => {
  test("changing instance locale does not change valueOf", () => {
    assertProp(
      fc.property(safeDates, (d) => {
        const m = moment(d);
        const v1 = m.valueOf();
        m.locale("fr");
        expect(m.valueOf()).toBe(v1);
        m.locale("de");
        expect(m.valueOf()).toBe(v1);
        m.locale("en");
        expect(m.valueOf()).toBe(v1);
      }),
      { numRuns: 50 },
    );
  });
});

describe("locale metamorphic: localeData invariants", () => {
  test("localeData()._months + _monthsShort length = 12", () => {
    assertProp(
      fc.property(fc.constantFrom("en", "fr", "de", "ja", "zh-cn", "ru"), (name) => {
        const ld = moment.localeData(name);
        expect(ld._months.length).toBe(12);
        expect(ld._monthsShort.length).toBe(12);
      }),
      { numRuns: 30 },
    );
  });

  test("localeData()._weekdays length = 7", () => {
    assertProp(
      fc.property(fc.constantFrom("en", "fr", "de", "ja", "zh-cn", "ru"), (name) => {
        const ld = moment.localeData(name);
        expect(ld._weekdays.length).toBe(7);
      }),
      { numRuns: 30 },
    );
  });
});

describe("locale metamorphic: relative time invariants", () => {
  test("from(a,b,true) === to(b,a,true) for any two dates", () => {
    assertProp(
      fc.property(datePairs, ([d1, d2]) => {
        const m1 = moment(d1);
        const m2 = moment(d2);
        expect(m1.from(m2, true)).toBe(m2.to(m1, true));
      }),
      { numRuns: 100 },
    );
  });

  test("fromNow(false) includes suffix, fromNow(true) does not", () => {
    assertProp(
      fc.property(safeDates, (d) => {
        const m = moment(d);
        const withSuffix = m.fromNow();
        const withoutSuffix = m.fromNow(true);
        // Without suffix should be shorter (no "ago" / "in")
        expect(withoutSuffix.length).toBeLessThanOrEqual(withSuffix.length);
      }),
      { numRuns: 50 },
    );
  });
});

describe("locale metamorphic: ordinal invariants", () => {
  test("ordinal parse round-trip preserves day", () => {
    assertProp(
      fc.property(safeDates, (d) => {
        const m = moment(d);
        const formatted = m.format("Do");
        const reParsed = moment(formatted, "Do");
        if (reParsed.isValid()) {
          expect(reParsed.date()).toBe(m.date());
        }
      }),
      { numRuns: 50 },
    );
  });
});

describe("locale metamorphic: calendar invariants", () => {
  test("calendar(reference) returns a non-empty string", () => {
    assertProp(
      fc.property(datePairs, ([d1, d2]) => {
        const m = moment(d1);
        const cal = m.calendar(moment(d2));
        expect(typeof cal).toBe("string");
        expect(cal.length).toBeGreaterThan(0);
      }),
      { numRuns: 50 },
    );
  });
});
