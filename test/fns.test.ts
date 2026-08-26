import { test, expect, describe } from "bun:test";
import fc from "fast-check";
import moment from "../src/index.ts";
import originalMoment from "../moment/moment.js";

import { assertProp } from "./properties/helpers";
import {
  year,
  month,
  date,
  day,
  hour,
  minute,
  second,
  millisecond,
  valueOf,
  unix,
  isBefore,
  isAfter,
  isSame,
  isSameOrBefore,
  isSameOrAfter,
  isBetween,
  addDays,
  addMonths,
  addYears,
  addHours,
  addMinutes,
  addSeconds,
  addMilliseconds,
  subtractDays,
  subtractHours,
  subtractMinutes,
  subtractSeconds,
  subtractMilliseconds,
  setYear,
  setMonth,
  setDate,
  setHours,
  setMinutes,
  setSeconds,
  setMilliseconds,
  startOfDay,
  startOfMonth,
  startOfYear,
  endOfDay,
  endOfWeek,
  endOfMonth,
  endOfYear,
  differenceInDays,
  differenceInMonths,
  diffMilliseconds,
  diffSeconds,
  diffMinutes,
  diffHours,
  diffDays,
  diffMonths,
  diffYears,
  daysInMonth,
  isLeapYear,
  dayOfYear,
  week,
  isoWeek,
  weekday,
  isoWeekday,
  quarter,
  toDate,
  toISOString,
  parseISO,
  parseMoment,
  format,
  formatMoment,
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
      fc.property(safeDates, smallInt, (dt, n) => {
        const d = new Date(dt);
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
      fc.property(safeDates, formats, (dt, fmt) => {
        const d = new Date(dt);
        const expected = moment(d).format(fmt);
        const actual = format(d, fmt);
        expect(actual).toBe(expected);
      }),
      { numRuns: 100 },
    );
  });

  test("addMonths matches mmntjs", () => {
    assertProp(
      fc.property(safeDates, smallInt, (dt, n) => {
        const d = new Date(dt);
        const expected = moment(d).add(n, "months").toDate().getTime();
        const actual = addMonths(d, n).getTime();
        expect(actual).toBe(expected);
      }),
      { numRuns: 100 },
    );
  });

  test("addYears matches mmntjs", () => {
    assertProp(
      fc.property(safeDates, fc.integer({ min: -10, max: 10 }), (dt, n) => {
        const d = new Date(dt);
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
// formatMoment vs moment.js
// ---------------------------------------------------------------------------
describe("formatMoment vs moment.js", () => {
  const d = local(2024, 0, 15, 10, 5, 3, 456);

  test("full datetime", () => {
    expect(formatMoment(d, "YYYY-MM-DD HH:mm:ss.SSS")).toBe(
      moment(d).format("YYYY-MM-DD HH:mm:ss.SSS"),
    );
  });

  test("MMMM (locale-aware month name)", () => {
    expect(formatMoment(d, "MMMM")).toBe(moment(d).format("MMMM"));
  });

  test("dddd (locale-aware day name)", () => {
    expect(formatMoment(d, "dddd")).toBe(moment(d).format("dddd"));
  });

  test("LL (locale-aware date)", () => {
    expect(formatMoment(d, "LL")).toBe(moment(d).format("LL"));
  });

  test("LTS (locale-aware time)", () => {
    expect(formatMoment(d, "LTS")).toBe(moment(d).format("LTS"));
  });

  test("h:mm A (12-hour)", () => {
    expect(formatMoment(d, "h:mm A")).toBe(moment(d).format("h:mm A"));
  });

  test("ordinal Do", () => {
    expect(formatMoment(d, "Do")).toBe(moment(d).format("Do"));
  });

  test("timezone Z", () => {
    const d2 = new Date();
    expect(formatMoment(d2, "Z")).toBe(moment(d2).format("Z"));
  });

  test("timezone ZZ", () => {
    const d2 = new Date();
    expect(formatMoment(d2, "ZZ")).toBe(moment(d2).format("ZZ"));
  });

  test("Invalid Date", () => {
    expect(formatMoment(new Date(NaN), "YYYY-MM-DD")).toBe("Invalid date");
  });
});

// ---------------------------------------------------------------------------
// parseMoment vs moment.js
// ---------------------------------------------------------------------------
describe("parseMoment vs moment.js", () => {
  test("YYYY-MM-DD", () => {
    const r = parseMoment("2024-06-15", "YYYY-MM-DD");
    expect(r.getTime()).toBe(moment("2024-06-15", "YYYY-MM-DD").valueOf());
  });

  test("MMMM DD, YYYY", () => {
    const r = parseMoment("January 15, 2024", "MMMM DD, YYYY");
    expect(r.getTime()).toBe(moment("January 15, 2024", "MMMM DD, YYYY").valueOf());
  });

  test("DD/MM/YYYY", () => {
    const r = parseMoment("15/06/2024", "DD/MM/YYYY");
    expect(r.getTime()).toBe(moment("15/06/2024", "DD/MM/YYYY").valueOf());
  });

  test("MM/DD/YYYY h:mm A", () => {
    const r = parseMoment("06/15/2024 10:30 AM", "MM/DD/YYYY h:mm A");
    expect(r.getTime()).toBe(moment("06/15/2024 10:30 AM", "MM/DD/YYYY h:mm A").valueOf());
  });

  test("strict mode", () => {
    const r = parseMoment("2024-06-15", "YYYY-MM-DD", true);
    expect(r.getTime()).toBe(moment("2024-06-15", "YYYY-MM-DD", true).valueOf());
  });

  test("MMMM D, YYYY (short day)", () => {
    const r = parseMoment("January 5, 2024", "MMMM D, YYYY");
    expect(r.getTime()).toBe(moment("January 5, 2024", "MMMM D, YYYY").valueOf());
  });

  test("MMM D, YYYY", () => {
    const r = parseMoment("Jan 5, 2024", "MMM D, YYYY");
    expect(r.getTime()).toBe(moment("Jan 5, 2024", "MMM D, YYYY").valueOf());
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

// ---------------------------------------------------------------------------
// Getter tests vs mmntjs
// ---------------------------------------------------------------------------
describe("getters vs mmntjs", () => {
  const base = local(2024, 5, 15, 10, 30, 45, 123);

  test("year", () => {
    expect(year(base)).toBe(moment(base).year());
  });

  test("month", () => {
    expect(month(base)).toBe(moment(base).month());
  });

  test("date", () => {
    expect(date(base)).toBe(moment(base).date());
  });

  test("day", () => {
    expect(day(base)).toBe(moment(base).day());
  });

  test("hour", () => {
    expect(hour(base)).toBe(moment(base).hour());
  });

  test("minute", () => {
    expect(minute(base)).toBe(moment(base).minute());
  });

  test("second", () => {
    expect(second(base)).toBe(moment(base).second());
  });

  test("millisecond", () => {
    expect(millisecond(base)).toBe(moment(base).millisecond());
  });

  test("valueOf", () => {
    expect(valueOf(base)).toBe(moment(base).valueOf());
  });

  test("unix", () => {
    expect(unix(base)).toBe(moment(base).unix());
  });
});

// ---------------------------------------------------------------------------
// Comparison tests
// ---------------------------------------------------------------------------
describe("comparison functions", () => {
  const a = local(2024, 5, 15);
  const b = local(2024, 5, 16);

  test("isBefore true", () => {
    expect(isBefore(a, b)).toBe(true);
  });

  test("isBefore false", () => {
    expect(isBefore(b, a)).toBe(false);
  });

  test("isBefore same", () => {
    expect(isBefore(a, a)).toBe(false);
  });

  test("isAfter true", () => {
    expect(isAfter(b, a)).toBe(true);
  });

  test("isAfter false", () => {
    expect(isAfter(a, b)).toBe(false);
  });

  test("isAfter same", () => {
    expect(isAfter(a, a)).toBe(false);
  });

  test("isSame true", () => {
    expect(isSame(a, a)).toBe(true);
  });

  test("isSame false", () => {
    expect(isSame(a, b)).toBe(false);
  });

  test("isSameOrBefore earlier", () => {
    expect(isSameOrBefore(a, b)).toBe(true);
  });

  test("isSameOrBefore same", () => {
    expect(isSameOrBefore(a, a)).toBe(true);
  });

  test("isSameOrBefore later", () => {
    expect(isSameOrBefore(b, a)).toBe(false);
  });

  test("isSameOrAfter later", () => {
    expect(isSameOrAfter(b, a)).toBe(true);
  });

  test("isSameOrAfter same", () => {
    expect(isSameOrAfter(a, a)).toBe(true);
  });

  test("isSameOrAfter earlier", () => {
    expect(isSameOrAfter(a, b)).toBe(false);
  });

  test("isBetween exclusive", () => {
    expect(isBetween(b, a, local(2024, 5, 17))).toBe(true);
  });

  test("isBetween exclusive from", () => {
    expect(isBetween(a, a, b)).toBe(false);
  });

  test("isBetween exclusive to", () => {
    expect(isBetween(b, a, b)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Diff tests vs mmntjs
// ---------------------------------------------------------------------------
describe("diff functions vs mmntjs", () => {
  const base = local(2024, 5, 15, 10, 30, 45, 123);
  const earlier = local(2024, 5, 10, 8, 20, 30, 50);

  test("diffMilliseconds", () => {
    expect(diffMilliseconds(base, earlier)).toBe(
      moment(base).diff(moment(earlier), "milliseconds", true),
    );
  });

  test("diffSeconds", () => {
    expect(diffSeconds(base, earlier)).toBe(moment(base).diff(moment(earlier), "seconds", true));
  });

  test("diffMinutes", () => {
    expect(diffMinutes(base, earlier)).toBe(moment(base).diff(moment(earlier), "minutes", true));
  });

  test("diffHours", () => {
    expect(diffHours(base, earlier)).toBe(moment(base).diff(moment(earlier), "hours", true));
  });

  test("diffDays vs moment.diff('days')", () => {
    expect(diffDays(base, earlier)).toBe(moment(base).diff(moment(earlier), "days"));
  });

  test("diffMonths vs moment.diff('months')", () => {
    expect(diffMonths(base, earlier)).toBe(moment(base).diff(moment(earlier), "months"));
  });

  test("diffYears vs moment.diff('months', true) / 12", () => {
    const expected = moment(base).diff(moment(earlier), "months", true) / 12;
    expect(Math.abs(diffYears(base, earlier) - expected)).toBeLessThan(0.001);
  });

  test("diffDays antisymmetry", () => {
    expect(diffDays(base, earlier)).toBe(-diffDays(earlier, base));
  });

  test("diffMonths antisymmetry", () => {
    const a = local(2024, 0, 15);
    const b = local(2024, 5, 15);
    expect(diffMonths(a, b)).toBe(-diffMonths(b, a));
  });

  test("diffMilliseconds same date", () => {
    const d = local(2024, 0, 1);
    expect(diffMilliseconds(d, d)).toBe(0);
  });

  test("diffDays same date", () => {
    const d = local(2024, 0, 1);
    expect(diffDays(d, d)).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Add time helpers vs mmntjs
// ---------------------------------------------------------------------------
describe("add time helpers vs mmntjs", () => {
  const base = local(2024, 5, 15, 10, 30, 45, 123);

  test("addHours", () => {
    expect(addHours(base, 5).getTime()).toBe(moment(base).add(5, "hours").valueOf());
  });

  test("addHours negative", () => {
    expect(addHours(base, -3).getTime()).toBe(moment(base).add(-3, "hours").valueOf());
  });

  test("addMinutes", () => {
    expect(addMinutes(base, 30).getTime()).toBe(moment(base).add(30, "minutes").valueOf());
  });

  test("addSeconds", () => {
    expect(addSeconds(base, 45).getTime()).toBe(moment(base).add(45, "seconds").valueOf());
  });

  test("addMilliseconds", () => {
    expect(addMilliseconds(base, 500).getTime()).toBe(
      moment(base).add(500, "milliseconds").valueOf(),
    );
  });

  test("addHours round-trip", () => {
    expect(addHours(addHours(base, 7), -7).getTime()).toBe(base.getTime());
  });

  test("addMinutes round-trip", () => {
    expect(addMinutes(addMinutes(base, 20), -20).getTime()).toBe(base.getTime());
  });

  test("addSeconds round-trip", () => {
    expect(addSeconds(addSeconds(base, 15), -15).getTime()).toBe(base.getTime());
  });

  test("addMilliseconds round-trip", () => {
    expect(addMilliseconds(addMilliseconds(base, 250), -250).getTime()).toBe(base.getTime());
  });
});

// ---------------------------------------------------------------------------
// Subtract helpers vs mmntjs
// ---------------------------------------------------------------------------
describe("subtract helpers vs mmntjs", () => {
  const base = local(2024, 5, 15, 10, 30, 45, 123);

  test("subtractDays", () => {
    expect(subtractDays(base, 5).getTime()).toBe(moment(base).subtract(5, "days").valueOf());
  });

  test("subtractHours", () => {
    expect(subtractHours(base, 3).getTime()).toBe(moment(base).subtract(3, "hours").valueOf());
  });

  test("subtractMinutes", () => {
    expect(subtractMinutes(base, 15).getTime()).toBe(
      moment(base).subtract(15, "minutes").valueOf(),
    );
  });

  test("subtractSeconds", () => {
    expect(subtractSeconds(base, 30).getTime()).toBe(
      moment(base).subtract(30, "seconds").valueOf(),
    );
  });

  test("subtractMilliseconds", () => {
    expect(subtractMilliseconds(base, 200).getTime()).toBe(
      moment(base).subtract(200, "milliseconds").valueOf(),
    );
  });

  test("subtractDays round-trip", () => {
    expect(subtractDays(subtractDays(base, 7), -7).getTime()).toBe(base.getTime());
  });
});

// ---------------------------------------------------------------------------
// More boundary functions vs mmntjs
// ---------------------------------------------------------------------------
describe("boundary functions vs mmntjs", () => {
  const base = local(2024, 5, 15, 10, 30, 45, 123);

  test("startOfYear", () => {
    expect(startOfYear(base).getTime()).toBe(moment(base).startOf("year").valueOf());
  });

  test("endOfDay", () => {
    expect(endOfDay(base).getTime()).toBe(moment(base).endOf("day").valueOf());
  });

  test("endOfWeek", () => {
    expect(endOfWeek(base).getTime()).toBe(moment(base).endOf("week").valueOf());
  });

  test("endOfYear", () => {
    expect(endOfYear(base).getTime()).toBe(moment(base).endOf("year").valueOf());
  });

  test("endOfWeek Saturday boundary", () => {
    // Sunday should endOf('week') = next Saturday
    const sun = local(2024, 5, 16); // Sunday Jun 16, 2024
    expect(endOfWeek(sun).getTime()).toBe(moment(sun).endOf("week").valueOf());
  });
});

// ---------------------------------------------------------------------------
// Calendar helpers vs mmntjs
// ---------------------------------------------------------------------------
describe("calendar helpers vs mmntjs", () => {
  test("week matches mmntjs", () => {
    const d1 = local(2024, 0, 1);
    expect(week(d1)).toBe(moment(d1).week());
    const d2 = local(2024, 5, 15);
    expect(week(d2)).toBe(moment(d2).week());
    const d3 = local(2024, 11, 31);
    expect(week(d3)).toBe(moment(d3).week());
  });

  test("week matches moment.js for extended years", () => {
    for (const extendedYear of [-400, -1, 0, 1, 4, 99, 100, 400]) {
      const d = new Date(0);
      d.setFullYear(extendedYear, 0, 1);
      d.setHours(12, 0, 0, 0);
      expect(week(d)).toBe(originalMoment(d).week());
    }
  });

  test("isoWeek matches mmntjs", () => {
    const d1 = local(2024, 0, 1);
    expect(isoWeek(d1)).toBe(moment(d1).isoWeek());
    const d2 = local(2024, 11, 31);
    expect(isoWeek(d2)).toBe(moment(d2).isoWeek());
    const d3 = local(2020, 11, 31);
    expect(isoWeek(d3)).toBe(moment(d3).isoWeek());
    const d4 = local(2027, 0, 1);
    expect(isoWeek(d4)).toBe(moment(d4).isoWeek());
  });

  test("isoWeek known values", () => {
    // Jan 1, 2024 (Mon) = ISO week 1
    expect(isoWeek(local(2024, 0, 1))).toBe(1);
    // Dec 31, 2020 (Thu) = ISO week 53
    expect(isoWeek(local(2020, 11, 31))).toBe(53);
  });

  test("weekday matches mmntjs", () => {
    const d = local(2024, 5, 15);
    expect(weekday(d)).toBe(moment(d).weekday());
  });

  test("isoWeekday matches mmntjs", () => {
    const d1 = local(2024, 5, 15); // Saturday
    expect(isoWeekday(d1)).toBe(moment(d1).isoWeekday());
    const d2 = local(2024, 5, 16); // Sunday
    expect(isoWeekday(d2)).toBe(moment(d2).isoWeekday());
    const d3 = local(2024, 0, 1); // Monday
    expect(isoWeekday(d3)).toBe(moment(d3).isoWeekday());
  });

  test("isoWeekday values", () => {
    expect(isoWeekday(local(2024, 0, 1))).toBe(1); // Mon
    expect(isoWeekday(local(2024, 0, 7))).toBe(7); // Sun
  });
});

// ---------------------------------------------------------------------------
// Conversion helpers
// ---------------------------------------------------------------------------
describe("conversion helpers", () => {
  const base = local(2024, 5, 15, 10, 30, 45, 123);

  test("toDate returns a clone (not same reference)", () => {
    const cloned = toDate(base);
    expect(cloned).not.toBe(base);
  });

  test("toDate has same time", () => {
    expect(toDate(base).getTime()).toBe(base.getTime());
  });

  test("toISOString matches native", () => {
    expect(toISOString(base)).toBe(base.toISOString());
  });

  test("toISOString invalid date", () => {
    expect(toISOString(new Date(NaN))).toBe("Invalid Date");
  });
});

// ---------------------------------------------------------------------------
// Property-based tests for new functions
// ---------------------------------------------------------------------------
describe("property-based new functions vs mmntjs", () => {
  test("addHours matches mmntjs", () => {
    assertProp(
      fc.property(safeDates, smallInt, (dt, n) => {
        const d = new Date(dt);
        const expected = moment(d).add(n, "hours").toDate().getTime();
        const actual = addHours(d, n).getTime();
        expect(actual).toBe(expected);
      }),
      { numRuns: 100 },
    );
  });

  test("diffDays antisymmetry", () => {
    assertProp(
      fc.property(safeDates, safeDates, (a, b) => {
        expect(diffDays(a, b) + diffDays(b, a)).toBe(0);
      }),
      { numRuns: 100 },
    );
  });

  test("startOfYear idempotent", () => {
    assertProp(
      fc.property(safeDates, (dt) => {
        const d = new Date(dt);
        const once = startOfYear(d);
        expect(startOfYear(once).getTime()).toBe(once.getTime());
      }),
      { numRuns: 100 },
    );
  });

  test("endOfDay idempotent", () => {
    assertProp(
      fc.property(safeDates, (dt) => {
        const d = new Date(dt);
        const once = endOfDay(d);
        expect(endOfDay(once).getTime()).toBe(once.getTime());
      }),
      { numRuns: 100 },
    );
  });

  test("endOfYear idempotent", () => {
    assertProp(
      fc.property(safeDates, (dt) => {
        const d = new Date(dt);
        const once = endOfYear(d);
        expect(endOfYear(once).getTime()).toBe(once.getTime());
      }),
      { numRuns: 100 },
    );
  });

  test("isBefore antisymmetry", () => {
    assertProp(
      fc.property(safeDates, safeDates, (a, b) => {
        if (a.getTime() < b.getTime()) {
          expect(isBefore(a, b)).toBe(true);
          expect(isAfter(a, b)).toBe(false);
        } else if (a.getTime() > b.getTime()) {
          expect(isBefore(a, b)).toBe(false);
          expect(isAfter(a, b)).toBe(true);
        } else {
          expect(isBefore(a, b)).toBe(false);
          expect(isAfter(a, b)).toBe(false);
          expect(isSame(a, b)).toBe(true);
        }
      }),
      { numRuns: 100 },
    );
  });

  test("isBetween exclusive", () => {
    assertProp(
      fc.property(safeDates, safeDates, safeDates, (a, b, c) => {
        const sorted = [a, b, c].sort((p, q) => p.getTime() - q.getTime());
        const [l, m, r] = sorted;
        if (m.getTime() > l.getTime() && m.getTime() < r.getTime()) {
          expect(isBetween(m, l, r)).toBe(true);
        }
      }),
      { numRuns: 100 },
    );
  });
});

// ---------------------------------------------------------------------------
// DST edge cases for new functions
// ---------------------------------------------------------------------------
describe("DST edge cases", () => {
  test("addHours across DST", () => {
    const before = new Date("2024-03-10T01:00:00");
    const result = addHours(before, 2);
    // The wall clock time after adding 2 hours across spring-forward
    expect(result.getTime()).toBe(moment(before).add(2, "hours").valueOf());
  });

  test("addDays across DST spring-forward", () => {
    const before = new Date("2024-03-09T12:00:00");
    expect(addDays(before, 1).getTime()).toBe(moment(before).add(1, "days").valueOf());
  });

  test("addDays across DST fall-back", () => {
    const before = new Date("2024-11-02T12:00:00");
    expect(addDays(before, 1).getTime()).toBe(moment(before).add(1, "days").valueOf());
  });

  test("endOfDay DST spring-forward", () => {
    const d = new Date("2024-03-10T10:00:00");
    expect(endOfDay(d).getTime()).toBe(moment(d).endOf("day").valueOf());
  });

  test("diffDays across DST", () => {
    const a = new Date("2024-03-09T12:00:00");
    const b = new Date("2024-03-11T12:00:00");
    expect(diffDays(b, a)).toBe(moment(b).diff(moment(a), "days"));
  });
});

// ---------------------------------------------------------------------------
// No mutation for new functions
// ---------------------------------------------------------------------------
describe("no mutation new functions", () => {
  const d = local(2024, 5, 15, 10, 30, 45, 123);

  test("addHours", () => {
    const c = new Date(d);
    addHours(d, 5);
    expect(d).toEqual(c);
  });

  test("addMinutes", () => {
    const c = new Date(d);
    addMinutes(d, 10);
    expect(d).toEqual(c);
  });

  test("addSeconds", () => {
    const c = new Date(d);
    addSeconds(d, 20);
    expect(d).toEqual(c);
  });

  test("addMilliseconds", () => {
    const c = new Date(d);
    addMilliseconds(d, 300);
    expect(d).toEqual(c);
  });

  test("subtractDays", () => {
    const c = new Date(d);
    subtractDays(d, 3);
    expect(d).toEqual(c);
  });

  test("subtractHours", () => {
    const c = new Date(d);
    subtractHours(d, 2);
    expect(d).toEqual(c);
  });

  test("startOfYear", () => {
    const c = new Date(d);
    startOfYear(d);
    expect(d).toEqual(c);
  });

  test("endOfDay", () => {
    const c = new Date(d);
    endOfDay(d);
    expect(d).toEqual(c);
  });

  test("endOfWeek", () => {
    const c = new Date(d);
    endOfWeek(d);
    expect(d).toEqual(c);
  });

  test("endOfYear", () => {
    const c = new Date(d);
    endOfYear(d);
    expect(d).toEqual(c);
  });

  test("toDate does not mutate", () => {
    const c = new Date(d);
    toDate(d);
    expect(d).toEqual(c);
  });
});

// ---------------------------------------------------------------------------
// NaN handling for new functions
// ---------------------------------------------------------------------------
describe("NaN handling new functions", () => {
  const nan = new Date(NaN);
  const valid = local(2024, 0, 15);

  test("year", () => {
    expect(isNaN(year(nan))).toBe(true);
  });

  test("month", () => {
    expect(isNaN(month(nan))).toBe(true);
  });

  test("date", () => {
    expect(isNaN(date(nan))).toBe(true);
  });

  test("day", () => {
    expect(isNaN(day(nan))).toBe(true);
  });

  test("hour", () => {
    expect(isNaN(hour(nan))).toBe(true);
  });

  test("addHours", () => {
    expect(addHours(nan, 1).getTime()).toBe(NaN);
  });

  test("addMinutes", () => {
    expect(addMinutes(nan, 1).getTime()).toBe(NaN);
  });

  test("addSeconds", () => {
    expect(addSeconds(nan, 1).getTime()).toBe(NaN);
  });

  test("addMilliseconds", () => {
    expect(addMilliseconds(nan, 1).getTime()).toBe(NaN);
  });

  test("startOfYear", () => {
    expect(startOfYear(nan).getTime()).toBe(NaN);
  });

  test("endOfDay", () => {
    expect(endOfDay(nan).getTime()).toBe(NaN);
  });

  test("endOfWeek", () => {
    expect(endOfWeek(nan).getTime()).toBe(NaN);
  });

  test("endOfYear", () => {
    expect(endOfYear(nan).getTime()).toBe(NaN);
  });

  test("diffMilliseconds", () => {
    expect(diffMilliseconds(nan, valid)).toBe(NaN);
  });

  test("diffSeconds", () => {
    expect(isNaN(diffSeconds(nan, valid))).toBe(true);
  });

  test("diffHours", () => {
    expect(isNaN(diffHours(nan, valid))).toBe(true);
  });

  test("isBefore", () => {
    expect(isBefore(nan, valid)).toBe(false);
  });

  test("isAfter", () => {
    expect(isAfter(nan, valid)).toBe(false);
  });

  test("isSame invalid", () => {
    expect(isSame(nan, valid)).toBe(false);
  });

  test("toISOString", () => {
    expect(toISOString(nan)).toBe("Invalid Date");
  });

  test("week", () => {
    expect(isNaN(week(nan))).toBe(true);
  });

  test("isoWeek", () => {
    expect(isNaN(isoWeek(nan))).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Overflow behavior
// ---------------------------------------------------------------------------
describe("overflow behavior", () => {
  test("addHours overflows to next day", () => {
    const d = local(2024, 0, 31, 22);
    const r = addHours(d, 4);
    expect(year(r)).toBe(2024);
    expect(month(r)).toBe(1); // Feb
    expect(date(r)).toBe(1);
    expect(hour(r)).toBe(2);
  });

  test("addMinutes overflows to next hour", () => {
    const d = local(2024, 0, 1, 10, 45);
    const r = addMinutes(d, 30);
    expect(hour(r)).toBe(11);
    expect(minute(r)).toBe(15);
  });

  test("addSeconds overflows to next minute", () => {
    const d = local(2024, 0, 1, 10, 30, 45);
    const r = addSeconds(d, 20);
    expect(minute(r)).toBe(31);
    expect(second(r)).toBe(5);
  });

  test("subtractDays crosses month boundary", () => {
    const d = local(2024, 0, 1);
    const r = subtractDays(d, 1);
    expect(year(r)).toBe(2023);
    expect(month(r)).toBe(11);
    expect(date(r)).toBe(31);
  });

  test("addMilliseconds overflows to seconds", () => {
    const d = local(2024, 0, 1, 0, 0, 0, 500);
    const r = addMilliseconds(d, 600);
    expect(second(r)).toBe(1);
    expect(millisecond(r)).toBe(100);
  });
});

// ---------------------------------------------------------------------------
// Metamorphic invariants for new functions
// ---------------------------------------------------------------------------
describe("metamorphic new functions", () => {
  const d = local(2024, 5, 15, 10, 30, 45, 123);

  test("addHours then subtractHours round-trip", () => {
    expect(subtractHours(addHours(d, 7), 7).getTime()).toBe(d.getTime());
  });

  test("addMinutes then subtractMinutes round-trip", () => {
    expect(subtractMinutes(addMinutes(d, 15), 15).getTime()).toBe(d.getTime());
  });

  test("startOfYear <= startOfDay", () => {
    expect(startOfYear(d).getTime()).toBeLessThanOrEqual(startOfDay(d).getTime());
  });

  test("endOfDay >= startOfDay", () => {
    expect(endOfDay(d).getTime()).toBeGreaterThanOrEqual(startOfDay(d).getTime());
  });

  test("endOfWeek >= endOfDay", () => {
    expect(endOfWeek(d).getTime()).toBeGreaterThanOrEqual(endOfDay(d).getTime());
  });

  test("endOfYear >= endOfMonth", () => {
    expect(endOfYear(d).getTime()).toBeGreaterThanOrEqual(endOfMonth(d).getTime());
  });
});
