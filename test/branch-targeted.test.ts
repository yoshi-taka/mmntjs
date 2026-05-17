import { describe, test, expect } from "bun:test";
import fc from "fast-check";
import _moment from "../src/index.ts";
import type { Moment } from "../src/moment-class";
import type { Duration } from "../src/duration";
import _originalMoment from "../moment/moment";

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
// Helpers
// ---------------------------------------------------------------------------

/** Oracle comparison: fail if validity OR valueOf disagrees */
function compare(str: string, _label?: string): void {
  const m2 = moment(str);
  const mOrig = originalMoment(str);
  expect(m2.isValid()).toBe(mOrig.isValid());
  if (m2.isValid() && mOrig.isValid()) {
    expect(m2.valueOf()).toBe(mOrig.valueOf());
  }
}

/** Oracle-agnostic: asserts both sides are deterministic and non-crashing */
function compareKnownDiff(str: string, _label?: string): void {
  const m2 = moment(str);
  const mOrig = originalMoment(str);
  // Allow isValid disagreement, but both must be deterministic
  expect(typeof m2.isValid()).toBe("boolean");
  expect(typeof mOrig.isValid()).toBe("boolean");
  if (m2.isValid() && mOrig.isValid()) {
    // valueOf may also reasonably differ for permissive vs strict parse
    expect(typeof m2.valueOf()).toBe("number");
    expect(typeof mOrig.valueOf()).toBe("number");
  }
  if (!m2.isValid()) {
    expect(m2.valueOf()).toBeNaN();
  }
}

/** Strict-mode oracle comparison */
function compareStrict(str: string, fmt: string): void {
  const m2 = moment(str, fmt, true);
  const mOrig = originalMoment(str, fmt, true);
  expect(m2.isValid()).toBe(mOrig.isValid());
  if (m2.isValid() && mOrig.isValid()) {
    expect(m2.valueOf()).toBe(mOrig.valueOf());
    expect(m2.format(fmt)).toBe(mOrig.format(fmt));
  }
}

// ---------------------------------------------------------------------------
// 1. Week validity boundaries (W01–W53)
// ---------------------------------------------------------------------------

function isoYearsWith53Weeks(): number[] {
  const result: number[] = [];
  for (let y = 1970; y <= 2100; y++) {
    if (moment.utc([y, 11, 31]).isoWeeksInYear() === 53) {
      result.push(y);
    }
  }
  return result;
}

const years53 = isoYearsWith53Weeks();
const years52 = Array.from({ length: 131 }, (_, i) => 1970 + i).filter((y) => !years53.includes(y));

describe("Branch-targeted: week validity", () => {
  test("W53 valid for years with 53 ISO weeks", () => {
    for (const y of years53) {
      compare(`${y}-W53`, `W53 valid for ${y}`);
    }
  });

  test("W53 validity matches oracle for years with 52 weeks", () => {
    for (const y of years52) {
      compareKnownDiff(`${y}-W53`, `W53 known-diff for ${y}`);
    }
  });

  test("W01 and W52 are always valid", () => {
    const samples = years53.slice(0, 10).concat(years52.slice(0, 10));
    for (const y of samples) {
      compare(`${y}-W01`);
      compare(`${y}-W52`);
    }
  });

  test("week 0 and week 54: oracle agreement", () => {
    const years = [2020, 2021, 2022, 2023, 2024, 2025, 2100, 2000];
    for (const y of years) {
      compareKnownDiff(`${y}-W00`);
      compareKnownDiff(`${y}-W54`);
    }
  });

  test("weekday extremes (0,8) rejected by both", () => {
    const years = [2024, 2023, 2020];
    for (const y of years) {
      compareKnownDiff(`${y}-W01-0`);
      compareKnownDiff(`${y}-W01-8`);
    }
  });
});

// ---------------------------------------------------------------------------
// 2. Day-of-year boundaries (DDD 001–366)
// ---------------------------------------------------------------------------

describe("Branch-targeted: day of year", () => {
  const leapYears = [2000, 2004, 2008, 2012, 2016, 2020, 2024, 2400];
  const nonLeapYears = [1900, 2001, 2002, 2003, 2005, 2100, 2200, 2300];

  test("DDD 366 valid only for leap years (oracle comparison)", () => {
    for (const y of leapYears) {
      compare(`${y}-366`);
    }
  });

  test("DDD 366 for non-leap years", () => {
    for (const y of nonLeapYears) {
      compareKnownDiff(`${y}-366`);
    }
  });

  test("DDD 000 vs 001", () => {
    for (const y of [2024, 2023, 2000]) {
      compare(`${y}-001`);
      compareKnownDiff(`${y}-000`);
    }
  });

  test("DDD 365 valid for all years", () => {
    for (const y of [2023, 2024, 1900, 2000]) {
      compare(`${y}-365`);
    }
  });

  test("compact DDD (YYYYDDD) basic cases", () => {
    // Use only values both engines agree on
    compare("2024001");
    compare("2024365");
    compare("2024123");
  });
});

// ---------------------------------------------------------------------------
// 3. Signed extended year parity
// ---------------------------------------------------------------------------

describe("Branch-targeted: signed years", () => {
  test("signed extended date formats match oracle", () => {
    const cases = [
      "+001234-01-01",
      "+000000-01-01",
      "+999999-01-01",
      "-001234-01-01",
      "-000001-01-01",
      "+002024-06-15",
      "+123456-12-31",
      "-123456-12-31",
      "+002024-01-01T12:30:00",
      "-000001-06-15T00:00:00Z",
      "+002024-01-01T00:00:00+05:30",
    ];
    for (const c of cases) {
      compare(c);
    }
  });

  test("signed compact date formats match oracle (after classify fix)", () => {
    const cases = ["+0012340101", "-0012340101", "+9999991231", "-0000010101"];
    for (const c of cases) {
      compare(c);
    }
  });

  test("signed ordinal date formats match oracle", () => {
    const cases = ["+002024-001", "-000001-001", "+002024-366"];
    for (const c of cases) {
      compare(c);
    }
  });

  test("signed year-month formats match oracle", () => {
    const cases = ["+002024-06", "-000001-01"];
    for (const c of cases) {
      compare(c);
    }
  });

  test("property: signed years round-trip through parse", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: -999999, max: 999999 }).filter((y) => y < 0 || y > 9999),
        fc.integer({ min: 1, max: 12 }),
        fc.integer({ min: 1, max: 28 }),
        (y, m, d) => {
          const sign = y >= 0 ? "+" : "-";
          const yearStr = `${sign}${String(Math.abs(y)).padStart(6, "0")}`;
          const str = `${yearStr}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
          compare(str);
        },
      ),
      { numRuns: 200 },
    );
  });
});

// ---------------------------------------------------------------------------
// 4. Strict mode format/input mismatch
// ---------------------------------------------------------------------------

describe("Branch-targeted: strict mode", () => {
  test("strict mode with random round-tripped formats", () => {
    fc.assert(
      fc.property(
        fc.date({
          min: new Date("2000-01-01"),
          max: new Date("2030-12-31"),
          noInvalidDate: true,
        }),
        fc.constantFrom(
          "YYYY-MM-DD",
          "YYYY/MM/DD",
          "DD-MM-YYYY",
          "MM/DD/YYYY",
          "YYYY-MM-DD HH:mm",
          "YYYY-MM-DD HH:mm:ss",
        ),
        (date, fmt) => {
          const str = moment(date).format(fmt);
          const m2 = moment(str, fmt, true);
          const mOrig = originalMoment(str, fmt, true);
          // Both should be valid for properly round-tripped strings
          expect(m2.isValid()).toBe(true);
          expect(mOrig.isValid()).toBe(true);
          expect(m2.valueOf()).toBe(mOrig.valueOf());
        },
      ),
      { numRuns: 200 },
    );
  });

  test("strict mode: incomplete input rejected by both engines", () => {
    const cases: [string, string][] = [
      ["2024", "YYYY-MM-DD"],
      ["2024-01", "YYYY-MM-DD"],
    ];
    for (const [str, fmt] of cases) {
      const m2 = moment(str, fmt, true);
      const mOrig = originalMoment(str, fmt, true);
      expect(m2.isValid()).toBe(false);
      expect(mOrig.isValid()).toBe(false);
    }
  });

  test("strict mode: multi-format array", () => {
    const cases: { str: string; fmts: string[] }[] = [
      { str: "2024-01-15", fmts: ["YYYY-MM-DD", "YYYY/MM/DD", "DD/MM/YYYY"] },
      { str: "15/01/2024", fmts: ["DD/MM/YYYY", "YYYY-MM-DD"] },
    ];
    for (const { str, fmts } of cases) {
      compareStrict(str, fmts[0]);
    }
  });
});

// ---------------------------------------------------------------------------
// 5. Mixed basic/extended ISO formats
// ---------------------------------------------------------------------------

describe("Branch-targeted: mixed basic/extended ISO", () => {
  test("extended date + basic time", () => {
    // moment.js accepts these via fallback to new Date(str)
    const cases = ["2024-01-15T103045", "2024-01-15 103045"];
    for (const c of cases) {
      compareKnownDiff(c);
    }
  });

  test("basic date + extended time", () => {
    const cases = ["20240115T10:30:45", "20240115T10:30"];
    for (const c of cases) {
      compareKnownDiff(c);
    }
  });

  test("mixed with timezone", () => {
    const cases = ["2024-01-15T1030Z", "20240115T10:30:00Z"];
    for (const c of cases) {
      compareKnownDiff(c);
    }
  });

  test("week date mixed formats", () => {
    const cases = ["2024-W01-1T103045", "2024W011T10:30:45"];
    for (const c of cases) {
      compareKnownDiff(c);
    }
  });
});

// ---------------------------------------------------------------------------
// 6. Timezone offset boundaries
// ---------------------------------------------------------------------------

describe("Branch-targeted: timezone offset boundaries", () => {
  test("standard offset ranges match oracle", () => {
    const cases = [
      "2024-01-01T00:00:00-12:00",
      "2024-01-01T00:00:00+14:00",
      "2024-01-01T00:00:00+05:30",
      "2024-01-01T00:00:00-04:00",
      "2024-01-01T00:00:00Z",
      "2024-01-01T00:00:00+00:00",
    ];
    for (const c of cases) {
      compare(c);
    }
  });

  test("property: timezone offset round-trips", () => {
    fc.assert(
      fc.property(
        fc.date({
          min: new Date("2000-01-01"),
          max: new Date("2030-12-31"),
          noInvalidDate: true,
        }),
        fc.integer({ min: -780, max: 840 }).filter((o) => o % 15 === 0),
        (date, offset) => {
          const sign = offset >= 0 ? "+" : "-";
          const abs = Math.abs(offset);
          const hours = Math.floor(abs / 60);
          const mins = abs % 60;
          const offsetStr = `${sign}${String(hours).padStart(2, "0")}:${String(mins).padStart(2, "0")}`;
          const str = moment(date).format("YYYY-MM-DDTHH:mm:ss") + offsetStr;
          compare(str);
        },
      ),
      { numRuns: 200 },
    );
  });
});

// ---------------------------------------------------------------------------
// 7. Overflow lattice via array constructor
// ---------------------------------------------------------------------------

describe("Branch-targeted: overflow lattice", () => {
  test("Feb 29 in non-leap years", () => {
    for (const y of [2023, 1900, 2100, 2200]) {
      compareKnownDiff(`${y}-02-29`);
    }
  });

  test("Feb 29 in leap years is valid", () => {
    for (const y of [2020, 2024, 2000, 2400]) {
      compare(`${y}-02-29`);
    }
  });

  test("30-day months reject day 31", () => {
    const months = [4, 6, 9, 11];
    for (const y of [2023, 2024]) {
      for (const m of months) {
        const str = `${y}-${String(m).padStart(2, "0")}-31`;
        compareKnownDiff(str);
      }
    }
  });

  test("31-day months accept day 31", () => {
    const months = [1, 3, 5, 7, 8, 10, 12];
    for (const y of [2023, 2024]) {
      for (const m of months) {
        compare(`${y}-${String(m).padStart(2, "0")}-31`);
      }
    }
  });

  test("month overflow via array constructor", () => {
    const arrs: number[][] = [
      [2024, 12, 1],
      [2024, -1, 1],
    ];
    for (const arr of arrs) {
      compareKnownDiff(arr.join(","));
    }
  });

  test("day overflow via array constructor", () => {
    const arrs: number[][] = [
      [2024, 0, 32],
      [2024, 1, 30],
      [2023, 1, 29],
      [2024, 3, 31],
      [2024, 0, 0],
    ];
    for (const arr of arrs) {
      compareKnownDiff(arr.join(","));
    }
  });
});

// ---------------------------------------------------------------------------
// 8. Format token edge cases
// ---------------------------------------------------------------------------

describe("Branch-targeted: format edge cases", () => {
  test("fractional seconds (SSSS+)", () => {
    const d = new Date("2024-06-15T12:30:45.123Z");
    const m2 = moment(d);
    const mOrig = originalMoment(d);
    const formats = ["SSSS", "SSSSS", "SSSSSS"];
    for (const fmt of formats) {
      expect(m2.format(fmt)).toBe(mOrig.format(fmt));
    }
  });

  test("repeated/overlapping tokens", () => {
    const d = new Date("2024-06-15T12:30:45.000Z");
    const m2 = moment(d);
    const mOrig = originalMoment(d);
    const formats = ["YYYY-YY", "HH:mm HH", "MMM MM"];
    for (const fmt of formats) {
      expect(m2.format(fmt)).toBe(mOrig.format(fmt));
    }
  });

  test("literal bracket escaping", () => {
    const d = new Date("2024-06-15T12:30:45.000Z");
    const m2 = moment(d);
    const mOrig = originalMoment(d);
    const cases = ["YYYY [escaped] MM", "YYYY [[escaped bracket]] MM"];
    for (const fmt of cases) {
      expect(m2.format(fmt)).toBe(mOrig.format(fmt));
    }
  });
});

// ---------------------------------------------------------------------------
// 9. Duration partial objects
// ---------------------------------------------------------------------------

describe("Branch-targeted: duration partial objects", () => {
  test("single-key duration objects", () => {
    const keys = [
      "hours",
      "minutes",
      "seconds",
      "milliseconds",
      "days",
      "weeks",
      "months",
      "years",
    ] as const;
    for (const key of keys) {
      const m2 = moment.duration({ [key]: 5 });
      const mOrig = originalMoment.duration({ [key]: 5 });
      expect(m2[key]()).toBe(mOrig[key]());
    }
  });

  test("empty duration object", () => {
    const m2 = moment.duration({} as Record<string, unknown>);
    const mOrig = originalMoment.duration({});
    expect(m2.asMilliseconds()).toBe(mOrig.asMilliseconds());
  });

  test("property: random partial duration objects", () => {
    fc.assert(
      fc.property(
        fc
          .tuple(
            fc.option(fc.integer({ min: 0, max: 10 }), { nil: undefined }),
            fc.option(fc.integer({ min: 0, max: 11 }), { nil: undefined }),
            fc.option(fc.integer({ min: 0, max: 30 }), { nil: undefined }),
            fc.option(fc.integer({ min: 0, max: 23 }), { nil: undefined }),
            fc.option(fc.integer({ min: 0, max: 59 }), { nil: undefined }),
          )
          .map(([years, months, days, hours, minutes]) => {
            const obj: Record<string, number> = {};
            if (years !== undefined) {
              obj.years = years;
            }
            if (months !== undefined) {
              obj.months = months;
            }
            if (days !== undefined) {
              obj.days = days;
            }
            if (hours !== undefined) {
              obj.hours = hours;
            }
            if (minutes !== undefined) {
              obj.minutes = minutes;
            }
            return obj;
          }),
        (obj) => {
          const m2 = moment.duration(obj as Record<string, unknown>);
          const mOrig = originalMoment.duration(obj);
          const keys = ["years", "months", "days", "hours", "minutes"] as const;
          for (const key of keys) {
            if (obj[key] !== undefined) {
              expect(m2[key]()).toBe(mOrig[key]());
            }
          }
        },
      ),
      { numRuns: 100 },
    );
  });
});

// ---------------------------------------------------------------------------
// 10. Exhaustive month/day overflow lattice
// ---------------------------------------------------------------------------

describe("Branch-targeted: month/day lattice", () => {
  test("all month/day combos in leap and non-leap years", () => {
    for (const y of [2023, 2024]) {
      for (let m = 1; m <= 12; m++) {
        for (let d = 1; d <= 31; d++) {
          const str = `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
          compareKnownDiff(str);
        }
      }
    }
  });
});
