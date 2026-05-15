import { describe, test, expect } from "bun:test";
import fc from "fast-check";
import {
  euclideanModulo,
  normalizeMonth,
  floorUnitEpoch,
  endOfUnitEpoch,
  daysInMonthFast,
  daysInMonth,
  ymdToEpochDays,
  isLeapYear,
} from "../../src/units.ts";
import _moment from "../../src/index.ts";
import type { MomentStatic } from "../../src/entry/types";

const moment = _moment as unknown as MomentStatic;

const DAY_MS = 86400000;
const HOUR_MS = 3600000;
const MINUTE_MS = 60000;
const SECOND_MS = 1000;

describe("euclideanModulo", () => {
  test("result is always 0 <= r < mod for positive mod", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: -10000, max: 10000 }),
        fc.integer({ min: 1, max: 100 }),
        (a, mod) => {
          const r = euclideanModulo(a, mod);
          expect(r).toBeGreaterThanOrEqual(0);
          expect(r).toBeLessThan(mod);
        },
      ),
      { numRuns: 500 },
    );
  });

  test("matches ((a % mod) + mod) % mod for all integers", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: -10000, max: 10000 }),
        fc.integer({ min: 1, max: 100 }),
        (a, mod) => {
          const expected = ((a % mod) + mod) % mod;
          const result = euclideanModulo(a, mod);
          expect(Object.is(result, expected) || (result === 0 && expected === 0)).toBe(true);
        },
      ),
      { numRuns: 500 },
    );
  });

  test("mod 1 always returns 0", () => {
    fc.assert(
      fc.property(fc.integer({ min: -10000, max: 10000 }), (a) => {
        expect(euclideanModulo(a, 1) === 0).toBe(true);
      }),
      { numRuns: 100 },
    );
  });

  test("mod 7 on standard values", () => {
    expect(euclideanModulo(0, 7)).toBe(0);
    expect(euclideanModulo(1, 7)).toBe(1);
    expect(euclideanModulo(6, 7)).toBe(6);
    expect(euclideanModulo(7, 7)).toBe(0);
    expect(euclideanModulo(-1, 7)).toBe(6);
    expect(euclideanModulo(-7, 7) === 0).toBe(true);
    expect(euclideanModulo(-8, 7)).toBe(6);
  });
});

describe("normalizeMonth", () => {
  test("always returns 0..11", () => {
    fc.assert(
      fc.property(fc.integer({ min: -10000, max: 10000 }), (m) => {
        const r = normalizeMonth(m);
        expect(r).toBeGreaterThanOrEqual(0);
        expect(r).toBeLessThanOrEqual(11);
      }),
      { numRuns: 500 },
    );
  });

  test("already-normalized months stay unchanged", () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 11 }), (m) => {
        expect(normalizeMonth(m)).toBe(m);
      }),
      { numRuns: 100 },
    );
  });

  test("large positive overflow wraps correctly", () => {
    expect(normalizeMonth(12)).toBe(0);
    expect(normalizeMonth(13)).toBe(1);
    expect(normalizeMonth(24)).toBe(0);
    expect(normalizeMonth(36)).toBe(0);
  });

  test("negative values wrap to 0..11", () => {
    expect(normalizeMonth(-1)).toBe(11);
    expect(normalizeMonth(-12) === 0).toBe(true);
    expect(normalizeMonth(-13)).toBe(11);
    expect(normalizeMonth(-24) === 0).toBe(true);
  });
});

describe("floorUnitEpoch / endOfUnitEpoch", () => {
  const units: [string, number][] = [
    ["ms", 1],
    ["second", SECOND_MS],
    ["minute", MINUTE_MS],
    ["hour", HOUR_MS],
    ["day", DAY_MS],
  ];

  for (const [name, ms] of units) {
    test(`floorUnitEpoch(value, ${name}) <= value`, () => {
      fc.assert(
        fc.property(fc.integer({ min: -1e12, max: 1e12 }), (v) => {
          const floored = floorUnitEpoch(v, ms);
          expect(floored).toBeLessThanOrEqual(v);
        }),
        { numRuns: 200 },
      );
    });

    test(`endOfUnitEpoch(value, ${name}) >= value`, () => {
      fc.assert(
        fc.property(fc.integer({ min: -1e12, max: 1e12 }), (v) => {
          const ended = endOfUnitEpoch(v, ms);
          expect(ended).toBeGreaterThanOrEqual(v);
        }),
        { numRuns: 200 },
      );
    });

    test(`endOfUnitEpoch(value, ${name}) - floorUnitEpoch(value, ${name}) == ${ms} - 1`, () => {
      fc.assert(
        fc.property(fc.integer({ min: -1e12, max: 1e12 }), (v) => {
          expect(endOfUnitEpoch(v, ms) - floorUnitEpoch(v, ms)).toBe(ms - 1);
        }),
        { numRuns: 200 },
      );
    });
  }

  test("floorUnitEpoch and endOfUnitEpoch work for negative timestamps", () => {
    const negCases = [-1, -1000, -86400000, -86400001, -3600001, -1e12, -1e11];
    for (const t of negCases) {
      const floored = floorUnitEpoch(t, DAY_MS);
      const ended = endOfUnitEpoch(t, DAY_MS);
      expect(floored).toBeLessThanOrEqual(t);
      expect(ended).toBeGreaterThanOrEqual(t);
      expect(ended - floored).toBe(DAY_MS - 1);
      expect(Object.is(floored % DAY_MS, 0) || Object.is(floored % DAY_MS, -0)).toBe(true);
      // Verify: floored is the start of the UTC day
      const d = new Date(floored);
      expect(d.getUTCHours()).toBe(0);
      expect(d.getUTCMinutes()).toBe(0);
      expect(d.getUTCSeconds()).toBe(0);
      expect(d.getUTCMilliseconds()).toBe(0);
    }
  });
});

describe("ymdToEpochDays", () => {
  function utcDays(y: number, m: number, d: number): number {
    if (y >= 0 && y <= 99) {
      const tmp = new Date(0);
      tmp.setUTCFullYear(y, m, d);
      tmp.setUTCHours(0, 0, 0, 0);
      return Math.round(tmp.getTime() / 86400000);
    }
    return Math.round(Date.UTC(y, m, d) / 86400000);
  }

  test("known epoch dates match Date.UTC based computation", () => {
    const cases: [number, number, number][] = [
      [1970, 0, 1],
      [1970, 0, 2],
      [1969, 11, 31],
      [1969, 0, 1],
      [2024, 0, 1],
      [2024, 2, 1], // Mar 1 = Feb 1 + 29 days (2024 is leap)
      [2000, 0, 1],
      [1, 0, 1],
      [0, 0, 1],
      [-1, 0, 1],
      [-400, 0, 1],
    ];
    for (const [y, m, d] of cases) {
      const result = ymdToEpochDays(y, m, d);
      const expected = utcDays(y, m, d);
      expect(result).toBe(expected);
    }
  });

  test("round-trip via Date.UTC: ymdToEpochDays -> Date for 1970 ± 10000 days", () => {
    fc.assert(
      fc.property(fc.integer({ min: -100000, max: 100000 }), (z) => {
        const [y, m, d] = (() => {
          const t = new Date(z * 86400000);
          return [t.getUTCFullYear(), t.getUTCMonth(), t.getUTCDate()];
        })();
        const expected = Date.UTC(y, m, d);
        const actual = ymdToEpochDays(y, m, d) * 86400000;
        expect(actual).toBe(expected);
      }),
      { numRuns: 500 },
    );
  });

  test("UTC startOf('year') with ymdToEpochDays matches Date.UTC result", () => {
    fc.assert(
      fc.property(fc.integer({ min: -10000, max: 10000 }), (y) => {
        if (!isFinite(y)) {
          return;
        }
        const expected = utcDays(y, 0, 1) * 86400000;
        const actual = ymdToEpochDays(y, 0, 1) * 86400000;
        expect(actual).toBe(expected);
      }),
      { numRuns: 200 },
    );
  });

  test("UTC startOf('month') with ymdToEpochDays matches Date.UTC result", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: -1000, max: 10000 }),
        fc.integer({ min: 0, max: 11 }),
        (y, m) => {
          if (!isFinite(y)) {
            return;
          }
          const expected = utcDays(y, m, 1) * 86400000;
          const actual = ymdToEpochDays(y, m, 1) * 86400000;
          expect(actual).toBe(expected);
        },
      ),
      { numRuns: 500 },
    );
  });

  test("UTC endOf('month') with ymdToEpochDays matches Date.UTC result", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: -1000, max: 10000 }),
        fc.integer({ min: 0, max: 11 }),
        (y, m) => {
          if (!isFinite(y)) {
            return;
          }
          const maxDay = daysInMonthFast(y, m);
          const expected = utcDays(y, m, maxDay) * 86400000 + 86400000 - 1;
          const actual = (ymdToEpochDays(y, m, maxDay) + 1) * 86400000 - 1;
          expect(actual).toBe(expected);
        },
      ),
      { numRuns: 500 },
    );
  });
});

describe("UTC startOf/endOf equivalence", () => {
  const safeMin = new Date("1900-01-01T00:00:00.000Z");
  const safeMax = new Date("2100-01-01T00:00:00.000Z");
  const safeDates = fc.date({ min: safeMin, max: safeMax, noInvalidDate: true });
  const startEndUnits = fc.constantFrom("year", "month", "day", "hour", "minute", "second");

  test("UTC startOf matches Date-based reference", () => {
    fc.assert(
      fc.property(safeDates, startEndUnits, (d, unit) => {
        const m = moment.utc(d);
        const ref = moment.utc(d);
        // reference implementation using Date API
        const r = ref.toDate();
        if (unit === "year") {
          r.setUTCMonth(0, 1);
          r.setUTCHours(0, 0, 0, 0);
        } else if (unit === "month") {
          r.setUTCDate(1);
          r.setUTCHours(0, 0, 0, 0);
        } else if (unit === "day") {
          r.setUTCHours(0, 0, 0, 0);
        } else if (unit === "hour") {
          r.setUTCMinutes(0, 0, 0);
        } else if (unit === "minute") {
          r.setUTCSeconds(0, 0);
        } else {
          r.setUTCMilliseconds(0);
        }
        const expected = r.getTime();
        m.startOf(unit);
        expect(m.valueOf()).toBe(expected);
      }),
      { numRuns: 200 },
    );
  });

  test("UTC endOf matches Date-based reference", () => {
    fc.assert(
      fc.property(safeDates, startEndUnits, (d, unit) => {
        const m = moment.utc(d);
        const ref = moment.utc(d);
        const r = ref.toDate();
        if (unit === "year") {
          r.setUTCMonth(11, 31);
          r.setUTCHours(23, 59, 59, 999);
        } else if (unit === "month") {
          r.setUTCDate(new Date(Date.UTC(r.getUTCFullYear(), r.getUTCMonth() + 1, 0)).getUTCDate());
          r.setUTCHours(23, 59, 59, 999);
        } else if (unit === "day") {
          r.setUTCHours(23, 59, 59, 999);
        } else if (unit === "hour") {
          r.setUTCMinutes(59, 59, 999);
        } else if (unit === "minute") {
          r.setUTCSeconds(59, 999);
        } else {
          r.setUTCMilliseconds(999);
        }
        const expected = r.getTime();
        m.endOf(unit);
        expect(m.valueOf()).toBe(expected);
      }),
      { numRuns: 200 },
    );
  });
});

describe("daysInMonthFast", () => {
  test("matches daysInMonth for already-normalized months", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: -5000, max: 5000 }),
        fc.integer({ min: 0, max: 11 }),
        (y, m) => {
          expect(daysInMonthFast(y, m)).toBe(daysInMonth(y, m));
        },
      ),
      { numRuns: 200 },
    );
  });

  test("February is 29 in leap years, 28 otherwise", () => {
    fc.assert(
      fc.property(fc.integer({ min: -5000, max: 5000 }), (y) => {
        const d = daysInMonthFast(y, 1);
        if (isLeapYear(y)) {
          expect(d).toBe(29);
        } else {
          expect(d).toBe(28);
        }
      }),
      { numRuns: 200 },
    );
  });
});

describe("local DST behavior unchanged", () => {
  test("local startOf preserves DST offset", () => {
    // DST transition: March 10, 2024 at 2:00 AM in US/Eastern
    const dstDate = new Date("2024-03-10T01:30:00.000Z");
    const m = moment(dstDate);
    const beforeOffset = m.utcOffset();
    m.startOf("day");
    expect(m.utcOffset()).toBe(beforeOffset);
  });
});

// -------------------------------------------------------------------------
// LATTICE VALIDATION — local-valid vs global-invalid date coordinates
// Calendar lattice is ℤ⁷: (y, m, d, h, min, s, ms).
// A point is "locally valid" if each coordinate is in its individual range.
// A point is "globally valid" if the combined coordinates form a real date.
// -------------------------------------------------------------------------
describe("calendar lattice: local-valid but global-invalid", () => {
  // These have each field in its individual range but the combination is invalid
  const localValidGlobalInvalid: [number, number, number][] = [
    [2024, 1, 30], // Feb 30 — month-end overflow, not a real date
    [2023, 1, 29], // Feb 29 in non-leap year
    [2024, 3, 31], // Apr 31
    [2024, 5, 31], // Jun 31
    [2024, 8, 31], // Sep 31
    [2024, 10, 31], // Nov 31
    [2100, 1, 29], // Feb 29 in non-leap century year
    [2000, 1, 30], // Feb 30 in leap year (Feb 29 exists but 30 doesn't)
  ];

  for (const [y, m, d] of localValidGlobalInvalid) {
    test(`${y}-${m + 1}-${d} is invalid`, () => {
      const m2 = moment([y, m, d]);
      expect(m2.isValid()).toBe(false);
    });
  }

  // These should be VALID (same local ranges, different global combination)
  const localValidGlobalValid: [number, number, number][] = [
    [2024, 1, 29], // Feb 29 in leap year
    [2024, 0, 31], // Jan 31
    [2024, 2, 31], // Mar 31
    [2024, 6, 31], // Jul 31
    [2024, 7, 31], // Aug 31
    [2024, 9, 31], // Oct 31
    [2024, 11, 31], // Dec 31
    [2000, 1, 29], // Feb 29 in leap century year
    [2100, 2, 31], // Mar 31 in non-leap century year (day 31 is fine for March)
  ];

  for (const [y, m, d] of localValidGlobalValid) {
    test(`${y}-${m + 1}-${d} is valid`, () => {
      const m2 = moment([y, m, d]);
      expect(m2.isValid()).toBe(true);
    });
  }
});

describe("calendar lattice: month overflow early exit", () => {
  test("month=13, day=1 fails at month before day check", () => {
    // checkOverflow steps: month (1) before day (2).
    // month=13 should return 1 before reaching day check.
    const m2 = moment([2024, 13, 1]);
    expect(m2.isValid()).toBe(false);
  });

  test("month=-1, day=31 fails at month before day check", () => {
    const m2 = moment([2024, -1, 31]);
    expect(m2.isValid()).toBe(false);
  });

  test("month=0, day=0 fails at day (0 is below min)", () => {
    const m2 = moment([2024, 0, 0]);
    expect(m2.isValid()).toBe(false);
  });
});

describe("calendar lattice: singular boundaries", () => {
  // Month-end: add 1 month from Jan 31 should clamp to Feb 28 (non-leap)
  test("Jan 31 + 1 month = Feb 28 (non-leap)", () => {
    const m2 = moment([2023, 0, 31]).add(1, "month");
    expect(m2.date()).toBe(28);
    expect(m2.month()).toBe(1);
  });

  // Month-end: add 1 month from Jan 31 should clamp to Feb 29 (leap)
  test("Jan 31 + 1 month = Feb 29 (leap)", () => {
    const m2 = moment([2024, 0, 31]).add(1, "month");
    expect(m2.date()).toBe(29);
    expect(m2.month()).toBe(1);
  });

  // Month-end: subtract 1 month from Mar 31 should clamp to Feb 28
  test("Mar 31 - 1 month = Feb 28 (non-leap)", () => {
    const m2 = moment([2023, 2, 31]).subtract(1, "month");
    expect(m2.date()).toBe(28);
    expect(m2.month()).toBe(1);
  });

  // Leap year boundary
  test("add 1 year from Feb 29 in leap year = Feb 28 in non-leap", () => {
    const m2 = moment([2024, 1, 29]).add(1, "year");
    expect(m2.date()).toBe(28);
    expect(m2.month()).toBe(1);
    expect(m2.year()).toBe(2025);
  });

  // Negative timestamp: _t is correctly negative for pre-epoch dates
  test("pre-epoch _t is negative", () => {
    const m2 = moment.utc(-1);
    expect(m2.year()).toBe(1969);
    expect(m2.month()).toBe(11);
    expect(m2.date()).toBe(31);
    expect(m2.valueOf()).toBe(-1);
  });

  // UTC add(1,"day") always adds exactly 86400000 ms
  test("UTC add(1, 'day') adds exactly 86400000 ms", () => {
    const m2 = moment.utc([2024, 2, 9]);
    const next = m2.clone().add(1, "day");
    expect(next.valueOf() - m2.valueOf()).toBe(86400000);
  });

  // Local add(1,"day") accounts for DST via setDate, so the wall clock
  // day advances by 1 regardless of DST. The UTC ms difference depends
  // on whether a DST transition occurred.
  test("local add(1, 'day') advances calendar date by 1", () => {
    const m2 = moment([2024, 2, 9]);
    const next = m2.clone().add(1, "day");
    expect(next.date()).toBe(m2.date() + 1);
  });
});
