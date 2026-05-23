import { test, expect, describe } from "bun:test";
import fc from "fast-check";
import moment from "../src/index.ts";
import originalMoment from "../moment/moment.js";

import { assertProp } from "./properties/helpers";
import {
  addDays,
  addMonths,
  addYears,
  setYear,
  setMonth,
  setDate,
  setHours,
  setMinutes,
  setSeconds,
  setMilliseconds,
  startOfDay,
  startOfMonth,
  endOfMonth,
  differenceInDays,
  differenceInMonths,
  daysInMonth,
  isLeapYear,
  dayOfYear,
  quarter,
  parseISO,
  format,
} from "../src/fns";

const safeMin = new Date("1900-01-01");
const safeMax = new Date("2100-01-01");
const safeDates = fc.date({ min: safeMin, max: safeMax, noInvalidDate: true });
const smallInt = fc.integer({ min: -50, max: 50 });

function local(y: number, m: number, d: number, ...t: [number?, number?, number?, number?]): Date {
  return new Date(y, m, d, t[0] ?? 0, t[1] ?? 0, t[2] ?? 0, t[3] ?? 0);
}

// ---------------------------------------------------------------------------
// Property-based: compare fns against mmntjs (which == moment.js)
// ---------------------------------------------------------------------------
describe("property-based vs mmntjs", () => {
  test("addDays matches mmntjs", () => {
    assertProp(
      fc.property(safeDates, smallInt, (date, n) => {
        const d = new Date(date);
        const expected = moment(d).add(n, "days").toDate().getTime();
        const actual = addDays(d, n).getTime();
        expect(actual).toBe(expected);
      }),
      { numRuns: 100 },
    );
  });

  test("format matches mmntjs with basic tokens", () => {
    const formats = fc.constantFrom(
      "YYYY-MM-DD",
      "HH:mm:ss",
      "YYYY-MM-DD HH:mm:ss.SSS",
      "MM/DD/YYYY",
      "YYYY",
      "MM",
      "DD",
      "HH:mm",
    );
    assertProp(
      fc.property(safeDates, formats, (date, fmt) => {
        const d = new Date(date);
        const expected = moment(d).format(fmt);
        const actual = format(d, fmt);
        expect(actual).toBe(expected);
      }),
      { numRuns: 100 },
    );
  });

  test("addMonths matches mmntjs", () => {
    assertProp(
      fc.property(safeDates, smallInt, (date, n) => {
        const d = new Date(date);
        const expected = moment(d).add(n, "months").toDate().getTime();
        const actual = addMonths(d, n).getTime();
        expect(actual).toBe(expected);
      }),
      { numRuns: 100 },
    );
  });

  test("addYears matches mmntjs", () => {
    assertProp(
      fc.property(safeDates, fc.integer({ min: -10, max: 10 }), (date, n) => {
        const d = new Date(date);
        const expected = moment(d).add(n, "years").toDate().getTime();
        const actual = addYears(d, n).getTime();
        expect(actual).toBe(expected);
      }),
      { numRuns: 100 },
    );
  });
});

// ---------------------------------------------------------------------------
// Setter verification against mmntjs
// ---------------------------------------------------------------------------
describe("setters vs mmntjs", () => {
  const base = local(2024, 5, 15, 10, 30, 45, 123);

  test("setYear", () => {
    const d = new Date(base);
    expect(setYear(d, 2020).getTime()).toBe(moment(d).year(2020).valueOf());
  });

  test("setMonth", () => {
    const d = new Date(base);
    expect(setMonth(d, 0).getTime()).toBe(moment(d).month(0).valueOf());
  });

  test("setDate", () => {
    const d = new Date(base);
    expect(setDate(d, 1).getTime()).toBe(moment(d).date(1).valueOf());
  });

  test("setHours", () => {
    const d = new Date(base);
    expect(setHours(d, 5).getTime()).toBe(moment(d).hour(5).valueOf());
  });

  test("setMinutes", () => {
    const d = new Date(base);
    expect(setMinutes(d, 0).getTime()).toBe(moment(d).minute(0).valueOf());
  });

  test("setSeconds", () => {
    const d = new Date(base);
    expect(setSeconds(d, 0).getTime()).toBe(moment(d).second(0).valueOf());
  });

  test("setMilliseconds", () => {
    const d = new Date(base);
    expect(setMilliseconds(d, 0).getTime()).toBe(moment(d).millisecond(0).valueOf());
  });
});

// ---------------------------------------------------------------------------
// Unit tests: addDays / addMonths / addYears vs mmntjs
// ---------------------------------------------------------------------------
describe("add functions vs mmntjs", () => {
  test("addDays crosses month boundary", () => {
    const d = local(2024, 0, 31);
    expect(addDays(d, 1).getTime()).toBe(moment(d).add(1, "days").valueOf());
  });

  test("addMonths clamps Feb 29 in non-leap", () => {
    const d = local(2020, 1, 29);
    expect(addMonths(d, 12).getTime()).toBe(moment(d).add(12, "months").valueOf());
  });

  test("addMonths preserves Feb 29 in leap", () => {
    const d = local(2020, 1, 29);
    expect(addMonths(d, 48).getTime()).toBe(moment(d).add(48, "months").valueOf());
  });

  test("addYears clamps Feb 29", () => {
    const d = local(2020, 1, 29);
    expect(addYears(d, 1).getTime()).toBe(moment(d).add(1, "years").valueOf());
  });
});

// ---------------------------------------------------------------------------
// Boundary verification
// ---------------------------------------------------------------------------
describe("boundary functions vs mmntjs", () => {
  test("endOfMonth february leap", () => {
    const d = local(2020, 1, 15);
    expect(endOfMonth(d).getTime()).toBe(moment(d).endOf("month").valueOf());
  });

  test("endOfMonth february non-leap", () => {
    const d = local(2023, 1, 15);
    expect(endOfMonth(d).getTime()).toBe(moment(d).endOf("month").valueOf());
  });

  test("endOfMonth 31-day month", () => {
    const d = local(2024, 0, 15);
    expect(endOfMonth(d).getTime()).toBe(moment(d).endOf("month").valueOf());
  });
});

// ---------------------------------------------------------------------------
// Calendar helpers vs mmntjs
// ---------------------------------------------------------------------------
describe("calendar helpers vs mmntjs", () => {
  test("daysInMonth february leap", () => {
    expect(daysInMonth(local(2020, 1, 1))).toBe(29);
    expect(daysInMonth(local(2020, 1, 1))).toBe(moment(local(2020, 1, 1)).daysInMonth());
  });

  test("daysInMonth february non-leap", () => {
    expect(daysInMonth(local(2023, 1, 1))).toBe(moment(local(2023, 1, 1)).daysInMonth());
  });

  test("isLeapYear matches mmntjs", () => {
    for (const y of [1900, 2000, 2020, 2021, 2024]) {
      const d = local(y, 0, 1);
      expect(isLeapYear(d)).toBe(moment(d).isLeapYear());
    }
  });

  test("dayOfYear matches mmntjs", () => {
    const d1 = local(2020, 1, 29);
    expect(dayOfYear(d1)).toBe(moment(d1).dayOfYear());
    const d2 = local(2020, 11, 31);
    expect(dayOfYear(d2)).toBe(moment(d2).dayOfYear());
    const d3 = local(2023, 11, 31);
    expect(dayOfYear(d3)).toBe(moment(d3).dayOfYear());
  });

  test("quarter matches mmntjs", () => {
    for (const m of [0, 2, 3, 5, 6, 8, 9, 11]) {
      const d = local(2024, m, 1);
      expect(quarter(d)).toBe(moment(d).quarter());
    }
  });
});

// ---------------------------------------------------------------------------
// parseISO vs mmntjs
// ---------------------------------------------------------------------------
describe("parseISO vs mmntjs", () => {
  test("YYYY-MM-DD", () => {
    const r = parseISO("2024-06-15");
    expect(r.getTime()).toBe(moment("2024-06-15").valueOf());
  });

  test("YYYY-MM-DDTHH:mm:ss", () => {
    const r = parseISO("2024-06-15T10:30:45");
    expect(r.getTime()).toBe(moment("2024-06-15T10:30:45").valueOf());
  });

  test("YYYY-MM-DDTHH:mm:ss.sss", () => {
    const r = parseISO("2024-06-15T10:30:45.123");
    expect(r.getTime()).toBe(moment("2024-06-15T10:30:45.123").valueOf());
  });

  test("YYYY-MM-DDTHH:mm:ssZ", () => {
    const r = parseISO("2024-06-15T10:30:00Z");
    expect(r.getTime()).toBe(moment("2024-06-15T10:30:00Z").valueOf());
  });

  test("YYYY-MM-DDTHH:mm:ss+HH:mm", () => {
    const r = parseISO("2024-06-15T10:30:00+05:00");
    expect(r.getTime()).toBe(moment("2024-06-15T10:30:00+05:00").valueOf());
  });

  test("YYYYMMDD compact", () => {
    const r = parseISO("20240615");
    expect(r.getTime()).toBe(moment("20240615").valueOf());
  });
});

// ---------------------------------------------------------------------------
// format vs mmntjs
// ---------------------------------------------------------------------------
describe("format vs mmntjs", () => {
  const d = local(2024, 0, 15, 10, 5, 3, 456);

  test("YYYY-MM-DD", () => {
    expect(format(d, "YYYY-MM-DD")).toBe(moment(d).format("YYYY-MM-DD"));
  });

  test("HH:mm:ss.SSS", () => {
    expect(format(d, "HH:mm:ss.SSS")).toBe(moment(d).format("HH:mm:ss.SSS"));
  });

  test("full datetime", () => {
    expect(format(d, "YYYY-MM-DD HH:mm:ss.SSS")).toBe(moment(d).format("YYYY-MM-DD HH:mm:ss.SSS"));
  });

  test("empty format", () => {
    expect(format(d, "")).toBe("");
  });

  test("escape char", () => {
    expect(format(d, "YYYY\\M")).toBe(moment(d).format("YYYY\\M"));
  });

  test("Invalid Date", () => {
    expect(format(new Date(NaN), "YYYY-MM-DD")).toBe("Invalid date");
  });
});

// ---------------------------------------------------------------------------
// No mutation
// ---------------------------------------------------------------------------
describe("no mutation", () => {
  const d = local(2024, 5, 15, 10, 30, 45, 123);

  test("setYear", () => {
    const c = new Date(d);
    setYear(d, 2020);
    expect(d).toEqual(c);
  });
  test("setMonth", () => {
    const c = new Date(d);
    setMonth(d, 0);
    expect(d).toEqual(c);
  });
  test("setDate", () => {
    const c = new Date(d);
    setDate(d, 1);
    expect(d).toEqual(c);
  });
  test("setHours", () => {
    const c = new Date(d);
    setHours(d, 0);
    expect(d).toEqual(c);
  });
  test("setMinutes", () => {
    const c = new Date(d);
    setMinutes(d, 0);
    expect(d).toEqual(c);
  });
  test("setSeconds", () => {
    const c = new Date(d);
    setSeconds(d, 0);
    expect(d).toEqual(c);
  });
  test("setMilliseconds", () => {
    const c = new Date(d);
    setMilliseconds(d, 0);
    expect(d).toEqual(c);
  });
  test("addDays", () => {
    const c = new Date(d);
    addDays(d, 5);
    expect(d).toEqual(c);
  });
  test("addMonths", () => {
    const c = new Date(d);
    addMonths(d, 2);
    expect(d).toEqual(c);
  });
  test("addYears", () => {
    const c = new Date(d);
    addYears(d, 1);
    expect(d).toEqual(c);
  });
  test("startOfDay", () => {
    const c = new Date(d);
    startOfDay(d);
    expect(d).toEqual(c);
  });
  test("startOfMonth", () => {
    const c = new Date(d);
    startOfMonth(d);
    expect(d).toEqual(c);
  });
  test("endOfMonth", () => {
    const c = new Date(d);
    endOfMonth(d);
    expect(d).toEqual(c);
  });
});

// ---------------------------------------------------------------------------
// Metamorphic (invariant-based)
// ---------------------------------------------------------------------------
describe("metamorphic", () => {
  const d = local(2024, 5, 15, 10, 30, 45, 123);

  test("addDays round-trip", () => {
    expect(addDays(addDays(d, 7), -7).getTime()).toBe(d.getTime());
  });

  test("addMonths round-trip", () => {
    expect(addMonths(addMonths(d, 3), -3).getTime()).toBe(d.getTime());
  });

  test("addYears round-trip", () => {
    expect(addYears(addYears(d, 2), -2).getTime()).toBe(d.getTime());
  });

  test("startOfDay idempotent", () => {
    const once = startOfDay(d);
    expect(startOfDay(once).getTime()).toBe(once.getTime());
  });

  test("startOfMonth idempotent", () => {
    const once = startOfMonth(d);
    expect(startOfMonth(once).getTime()).toBe(once.getTime());
  });

  test("endOfMonth idempotent", () => {
    const once = endOfMonth(d);
    expect(endOfMonth(once).getTime()).toBe(once.getTime());
  });

  test("startOfDay <= original <= endOfMonth", () => {
    expect(startOfDay(d).getTime()).toBeLessThanOrEqual(d.getTime());
    expect(d.getTime()).toBeLessThanOrEqual(endOfMonth(d).getTime());
  });

  test("differenceInDays antisymmetry", () => {
    const a = local(2024, 0, 15);
    const b = local(2024, 5, 20);
    expect(differenceInDays(a, b)).toBe(-differenceInDays(b, a));
  });

  test("differenceInMonths antisymmetry", () => {
    const a = local(2024, 0, 15);
    const b = local(2024, 5, 15);
    expect(differenceInMonths(a, b)).toBe(-differenceInMonths(b, a));
  });
});

// ---------------------------------------------------------------------------
// Edge cases: NaN
// ---------------------------------------------------------------------------
describe("NaN handling", () => {
  const nan = new Date(NaN);
  const valid = local(2024, 0, 15);

  test("addDays", () => {
    expect(addDays(nan, 1).getTime()).toBe(NaN);
  });
  test("addMonths", () => {
    expect(addMonths(nan, 1).getTime()).toBe(NaN);
  });
  test("addYears", () => {
    expect(addYears(nan, 1).getTime()).toBe(NaN);
  });
  test("startOfDay", () => {
    expect(startOfDay(nan).getTime()).toBe(NaN);
  });
  test("startOfMonth", () => {
    expect(startOfMonth(nan).getTime()).toBe(NaN);
  });
  test("endOfMonth", () => {
    expect(endOfMonth(nan).getTime()).toBe(NaN);
  });
  test("daysInMonth", () => {
    expect(isNaN(daysInMonth(nan))).toBe(true);
  });
  test("isLeapYear", () => {
    expect(isLeapYear(nan)).toBe(false);
  });
  test("differenceInDays", () => {
    expect(differenceInDays(nan, valid)).toBe(NaN);
  });
  test("differenceInMonths", () => {
    // Both NaN → month diff returns NaN-propagated value
    const r = differenceInMonths(nan, valid);
    expect(r === 0 || isNaN(r)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Snapshots: verify fns matches original moment.js directly
// ---------------------------------------------------------------------------
describe("moment.js direct comparison", () => {
  test("Feb 29 clamping chain", () => {
    const d = local(2020, 1, 29);
    expect(addYears(d, 1).getTime()).toBe(originalMoment(d).add(1, "years").valueOf());
    expect(addMonths(d, 12).getTime()).toBe(originalMoment(d).add(12, "months").valueOf());
  });

  test("Jan 31 + 1 month", () => {
    const d = local(2024, 0, 31);
    expect(addMonths(d, 1).getTime()).toBe(originalMoment(d).add(1, "months").valueOf());
  });

  test("cross-DST day diff", () => {
    const a = new Date("1975-01-08T23:00:00.000Z");
    const b = new Date("1970-01-01T00:00:00.000Z");
    expect(differenceInDays(a, b)).toBe(originalMoment(a).diff(originalMoment(b), "days"));
  });
});
