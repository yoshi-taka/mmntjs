import { describe, test, expect } from "bun:test";
import fc from "fast-check";
import { assertProp } from "./helpers";
import _moment from "../../src/index.ts";
import type { MomentStatic } from "../../src/entry/types";
import type { Moment } from "../../src/moment-class";
import type { Duration } from "../../src/duration";
import _originalMoment from "../../moment/moment";
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

describe("Property-based: boundary values", () => {
  test("boundary and degenerate inputs", () => {
    const cases = [null, undefined, 0, "", NaN, Infinity, -Infinity, false, true];
    for (const input of cases) {
      const m2 = moment(input as unknown);
      const mOrig = originalMoment(input as unknown);
      expect(m2.isValid()).toBe(mOrig.isValid());
      if (mOrig.isValid()) {
        if (input === undefined) {
          expect(Math.abs(m2.valueOf() - mOrig.valueOf())).toBeLessThan(1000);
        } else {
          expect(m2.valueOf()).toBe(mOrig.valueOf());
        }
      }
    }
  });

  test("string inputs", () => {
    assertProp(
      fc.property(
        fc.oneof(
          fc.constantFrom(
            "2024-01-01",
            "2024-01-01T00:00:00",
            "2024-01-01T12:30:00.000Z",
            "2024-01",
            "",
            " ",
            "\t",
            "\n",
            "\0",
            "Invalid date",
            "undefined",
            "null",
            "NaN",
            "hello",
            "abc",
          ),
        ),
        (input) => {
          const m2 = moment(input);
          const mOrig = originalMoment(input);
          expect(m2.isValid()).toBe(mOrig.isValid());
        },
      ),
      { numRuns: 200 },
    );
  });

  test("array inputs", () => {
    assertProp(
      fc.property(fc.array(fc.integer({ min: -10000, max: 10000 }), { maxLength: 10 }), (arr) => {
        const m2 = moment(arr);
        const mOrig = (originalMoment as Function)(arr);
        expect(m2.isValid()).toBe(mOrig.isValid());
        if (mOrig.isValid()) {
          expect(m2.format("YYYY-MM-DD")).toBe(mOrig.format("YYYY-MM-DD"));
        }
      }),
      { numRuns: 200 },
    );
  });

  test("object inputs with year/month/day", () => {
    assertProp(
      fc.property(
        fc.record({
          year: fc.option(fc.integer()),
          month: fc.option(fc.integer({ min: -1, max: 13 })),
          day: fc.option(fc.integer({ min: -1, max: 32 })),
        }),
        (obj) => {
          const m2 = moment(obj);
          const mOrig = (originalMoment as Function)(obj);
          expect(m2.isValid()).toBe(mOrig.isValid());
        },
      ),
      { numRuns: 200 },
    );
  });

  // ============================================================
  // ENHANCED BOUNDARY TESTS
  // ============================================================

  test("empty string and whitespace inputs", () => {
    assertProp(
      fc.property(
        fc.oneof(fc.constantFrom("", " ", "\t", "\n", "\r", "\r\n", "  ", "\t\t")),
        (input) => {
          const m2 = moment(input);
          const mOrig = originalMoment(input);
          expect(m2.isValid()).toBe(mOrig.isValid());
        },
      ),
      { numRuns: 50 },
    );
  });

  test("null undefined NaN Infinity", () => {
    assertProp(
      fc.property(fc.constantFrom(null, undefined, NaN, Infinity, -Infinity), (input) => {
        const m2 = moment(input as unknown);
        const mOrig = originalMoment(input as unknown);
        expect(m2.isValid()).toBe(mOrig.isValid());
      }),
      { numRuns: 50 },
    );
  });

  test("negative years", () => {
    assertProp(
      fc.property(fc.constantFrom(-1, -100, -1000, -5000, -10000, -99999), (year) => {
        const m2 = moment([year, 1, 1]);
        const mOrig = originalMoment([year, 1, 1]);
        expect(m2.isValid()).toBe(mOrig.isValid());
        if (mOrig.isValid()) {
          expect(m2.year()).toBe(mOrig.year());
          expect(m2.format("YYYY-MM-DD")).toBe(mOrig.format("YYYY-MM-DD"));
        }
      }),
      { numRuns: 50 },
    );
  });

  test("unix epoch boundaries", () => {
    assertProp(
      fc.property(
        fc.constantFrom(0, -1, 1, 86400000, -86400000, 1000, -1000, 31536000000, -31536000000),
        (ts) => {
          const d = new Date(ts);
          const m2 = moment(d);
          const mOrig = originalMoment(d);
          expect(m2.isValid()).toBe(mOrig.isValid());
          if (mOrig.isValid()) {
            expect(m2.valueOf()).toBe(mOrig.valueOf());
            expect(m2.format("YYYY-MM-DD HH:mm:ss")).toBe(mOrig.format("YYYY-MM-DD HH:mm:ss"));
          }
        },
      ),
      { numRuns: 50 },
    );
  });

  test("negative UTC timestamps preserve startOf/endOf bucket semantics", () => {
    assertProp(
      fc.property(
        fc.integer({ min: -2208988800000, max: -1 }),
        fc.constantFrom("day", "hour", "minute", "second"),
        (ts, unit) => {
          const m2Start = moment.utc(ts).startOf(unit);
          const origStart = originalMoment.utc(ts).startOf(unit);
          const m2End = moment.utc(ts).endOf(unit);
          const origEnd = originalMoment.utc(ts).endOf(unit);
          expect(m2Start.valueOf()).toBe(origStart.valueOf());
          expect(m2End.valueOf()).toBe(origEnd.valueOf());
        },
      ),
      { numRuns: 200 },
    );
  });

  test("large month overflow via add(month) matches moment", () => {
    assertProp(
      fc.property(
        fc.integer({ min: 1900, max: 4000 }),
        fc.integer({ min: -240, max: 240 }),
        fc.integer({ min: 1, max: 28 }),
        (year, month, day) => {
          const base = `${String(year).padStart(4, "0")}-01-${String(day).padStart(2, "0")}`;
          const m2 = moment.utc(base).add(month, "month");
          const mOrig = originalMoment.utc(base).add(month, "month");
          expect(m2.valueOf()).toBe(mOrig.valueOf());
        },
      ),
      { numRuns: 200 },
    );
  });

  test("two digit year boundaries (68/69 split)", () => {
    assertProp(
      fc.property(
        fc.constantFrom(
          "1/1/68",
          "1/1/69",
          "01/01/68",
          "01/01/69",
          "01-01-68",
          "01-01-69",
          "01 01 68",
          "01 01 69",
          "68",
          "69",
          "70",
          "99",
          "00",
          "01",
        ),
        (input) => {
          const m2 = moment(input, "MM/DD/YY");
          const mOrig = originalMoment(input, "MM/DD/YY");
          expect(m2.isValid()).toBe(mOrig.isValid());
          if (mOrig.isValid()) {
            expect(m2.valueOf()).toBe(mOrig.valueOf());
          }
        },
      ),
      { numRuns: 50 },
    );
  });

  test("two digit year boundary range", () => {
    assertProp(
      fc.property(fc.integer({ min: 0, max: 99 }), (yy) => {
        const str = `01/01/${String(yy).padStart(2, "0")}`;
        const m2 = moment(str, "MM/DD/YY");
        const mOrig = originalMoment(str, "MM/DD/YY");
        expect(m2.isValid()).toBe(mOrig.isValid());
        if (mOrig.isValid()) {
          expect(m2.year()).toBe(mOrig.year());
        }
      }),
      { numRuns: 100 },
    );
  });

  test("month end boundaries (Jan 31 + 1 month)", () => {
    assertProp(
      fc.property(
        fc.constantFrom(
          [2024, 0, 31],
          [2023, 0, 31],
          [2024, 11, 31],
          [2023, 11, 31],
          [2024, 1, 29],
          [2023, 1, 28],
          [2024, 1, 30],
          [2023, 1, 30],
        ),
        (arr) => {
          const m2 = moment(arr);
          const mOrig = (originalMoment as Function)(arr);
          expect(m2.isValid()).toBe(mOrig.isValid());
          if (mOrig.isValid()) {
            expect(m2.format("YYYY-MM-DD")).toBe(mOrig.format("YYYY-MM-DD"));

            const added2 = moment(arr).add(1, "month");
            const addedOrig = originalMoment(arr).add(1, "month");
            expect(added2.format("YYYY-MM-DD")).toBe(addedOrig.format("YYYY-MM-DD"));
          }
        },
      ),
      { numRuns: 50 },
    );
  });

  test("month end boundaries via property testing", () => {
    assertProp(
      fc.property(
        fc.integer({ min: 1, max: 12 }),
        fc.integer({ min: 1, max: 31 }),
        fc.integer({ min: -5, max: 5 }),
        (month, day, monthShift) => {
          const year = 2023;
          const m2 = moment([year, month - 1, day]).add(monthShift, "month");
          const mOrig = originalMoment([year, month - 1, day]).add(monthShift, "month");
          expect(m2.format("YYYY-MM-DD")).toBe(mOrig.format("YYYY-MM-DD"));
        },
      ),
      { numRuns: 200 },
    );
  });

  test("leap year dates", () => {
    assertProp(
      fc.property(fc.constantFrom(2024, 2020, 2000, 2400, 2023, 2025, 2100, 1900), (year) => {
        const m2 = moment([year, 1, 29]);
        const mOrig = originalMoment([year, 1, 29]);
        expect(m2.isValid()).toBe(mOrig.isValid());
        if (mOrig.isValid()) {
          expect(m2.format("YYYY-MM-DD")).toBe(mOrig.format("YYYY-MM-DD"));
          expect(m2.isLeapYear()).toBe(mOrig.isLeapYear());
        }
      }),
      { numRuns: 50 },
    );
  });

  test("leap year detection", () => {
    assertProp(
      fc.property(fc.integer({ min: 1800, max: 2200 }), (year) => {
        const m2 = moment([year, 0, 1]);
        const mOrig = originalMoment([year, 0, 1]);
        expect(m2.isLeapYear()).toBe(mOrig.isLeapYear());
      }),
      { numRuns: 200 },
    );
  });

  test("special year values", () => {
    assertProp(
      fc.property(
        fc.constantFrom(0, 1, 99, 100, 999, 1900, 1901, 2000, 9999, 10000, 100000),
        (year) => {
          const m2 = moment([year, 0, 1]);
          const mOrig = originalMoment([year, 0, 1]);
          expect(m2.isValid()).toBe(mOrig.isValid());
          if (mOrig.isValid()) {
            expect(m2.year()).toBe(mOrig.year());
            expect(m2.format("YYYY-MM-DD")).toBe(mOrig.format("YYYY-MM-DD"));
          }
        },
      ),
      { numRuns: 50 },
    );
  });

  test("date value boundaries", () => {
    assertProp(
      fc.property(fc.integer({ min: -100000, max: 100000 }), (ts) => {
        const d = new Date(ts);
        const m2 = moment(d);
        const mOrig = originalMoment(d);
        expect(m2.isValid()).toBe(mOrig.isValid());
        if (mOrig.isValid()) {
          expect(m2.valueOf()).toBe(mOrig.valueOf());
          expect(m2.year()).toBe(mOrig.year());
          expect(m2.month()).toBe(mOrig.month());
          expect(m2.date()).toBe(mOrig.date());
        }
      }),
      { numRuns: 500 },
    );
  });

  test("string with offset formats", () => {
    assertProp(
      fc.property(
        fc.constantFrom(
          "2024-01-01T00:00:00+00:00",
          "2024-01-01T00:00:00+05:30",
          "2024-01-01T00:00:00-05:00",
          "2024-01-01T00:00:00+0000",
          "2024-01-01T00:00:00Z",
          "2024-01-01T00:00:00.000+00:00",
          "2024-06-15T12:30:45.123+05:30",
        ),
        (input) => {
          const m2 = moment(input);
          const mOrig = originalMoment(input);
          expect(m2.isValid()).toBe(mOrig.isValid());
          if (mOrig.isValid()) {
            expect(m2.valueOf()).toBe(mOrig.valueOf());
          }
        },
      ),
      { numRuns: 50 },
    );
  });

  test("minimum and maximum date values", () => {
    assertProp(
      fc.property(
        fc.constantFrom(
          new Date(0),
          new Date(-8640000000000000),
          new Date(8640000000000000),
          new Date(8.64e15),
          new Date(-8.64e15),
        ),
        (d) => {
          const m2 = moment(d);
          const mOrig = originalMoment(d);
          expect(m2.isValid()).toBe(mOrig.isValid());
          if (mOrig.isValid()) {
            expect(m2.valueOf()).toBe(mOrig.valueOf());
          }
        },
      ),
      { numRuns: 50 },
    );
  });

  // ============================================================
  // SYSTEMATIC BOUNDARY VALUE ANALYSIS (追加)
  // ============================================================

  test("month boundaries: -1, 0, 11, 12", () => {
    assertProp(
      fc.property(fc.constantFrom(-1, 0, 11, 12), (m) => {
        const m2 = moment([2024, m, 15]);
        const mOrig = originalMoment([2024, m, 15]);
        expect(m2.isValid()).toBe(mOrig.isValid());
        expect(m2.month()).toBe(mOrig.month());
        expect(m2.format("YYYY-MM-DD")).toBe(mOrig.format("YYYY-MM-DD"));
      }),
      { numRuns: 50 },
    );
  });

  test("day boundaries: 0, 1, 28, 29, 30, 31, 32 across January", () => {
    assertProp(
      fc.property(fc.constantFrom(0, 1, 28, 29, 30, 31, 32), (d) => {
        const m2 = moment([2024, 0, d]);
        const mOrig = originalMoment([2024, 0, d]);
        expect(m2.isValid()).toBe(mOrig.isValid());
        expect(m2.date()).toBe(mOrig.date());
        expect(m2.format("YYYY-MM-DD")).toBe(mOrig.format("YYYY-MM-DD"));
      }),
      { numRuns: 50 },
    );
  });

  test("day boundaries across February (non-leap)", () => {
    assertProp(
      fc.property(fc.constantFrom(0, 1, 27, 28, 29, 30, 31, 32), (d) => {
        const m2 = moment([2023, 1, d]);
        const mOrig = originalMoment([2023, 1, d]);
        expect(m2.isValid()).toBe(mOrig.isValid());
        expect(m2.format("YYYY-MM-DD")).toBe(mOrig.format("YYYY-MM-DD"));
      }),
      { numRuns: 50 },
    );
  });

  test("day boundaries across February (leap)", () => {
    assertProp(
      fc.property(fc.constantFrom(0, 1, 28, 29, 30, 31, 32), (d) => {
        const m2 = moment([2024, 1, d]);
        const mOrig = originalMoment([2024, 1, d]);
        expect(m2.isValid()).toBe(mOrig.isValid());
        expect(m2.format("YYYY-MM-DD")).toBe(mOrig.format("YYYY-MM-DD"));
      }),
      { numRuns: 50 },
    );
  });

  test("day boundaries across month with 30 days (April)", () => {
    assertProp(
      fc.property(fc.constantFrom(0, 1, 29, 30, 31, 32), (d) => {
        const m2 = moment([2024, 3, d]);
        const mOrig = originalMoment([2024, 3, d]);
        expect(m2.isValid()).toBe(mOrig.isValid());
        expect(m2.format("YYYY-MM-DD")).toBe(mOrig.format("YYYY-MM-DD"));
      }),
      { numRuns: 50 },
    );
  });

  test("hour boundaries: -1, 0, 23, 24", () => {
    assertProp(
      fc.property(fc.constantFrom(-1, 0, 23, 24), (h) => {
        const m2 = moment([2024, 0, 15, h, 0, 0]);
        const mOrig = originalMoment([2024, 0, 15, h, 0, 0]);
        expect(m2.isValid()).toBe(mOrig.isValid());
        expect(m2.format("HH:mm:ss")).toBe(mOrig.format("HH:mm:ss"));
        if (mOrig.isValid()) {
          expect(m2.hour()).toBe(mOrig.hour());
        }
      }),
      { numRuns: 50 },
    );
  });

  test("minute boundaries: -1, 0, 59, 60", () => {
    assertProp(
      fc.property(fc.constantFrom(-1, 0, 59, 60), (min) => {
        const m2 = moment([2024, 0, 15, 12, min, 0]);
        const mOrig = originalMoment([2024, 0, 15, 12, min, 0]);
        expect(m2.isValid()).toBe(mOrig.isValid());
        expect(m2.format("HH:mm:ss")).toBe(mOrig.format("HH:mm:ss"));
        if (mOrig.isValid()) {
          expect(m2.minute()).toBe(mOrig.minute());
        }
      }),
      { numRuns: 50 },
    );
  });

  test("second boundaries: -1, 0, 59, 60", () => {
    assertProp(
      fc.property(fc.constantFrom(-1, 0, 59, 60), (s) => {
        const m2 = moment([2024, 0, 15, 12, 0, s]);
        const mOrig = originalMoment([2024, 0, 15, 12, 0, s]);
        expect(m2.isValid()).toBe(mOrig.isValid());
        expect(m2.format("HH:mm:ss")).toBe(mOrig.format("HH:mm:ss"));
        if (mOrig.isValid()) {
          expect(m2.second()).toBe(mOrig.second());
        }
      }),
      { numRuns: 50 },
    );
  });

  test("millisecond boundaries: -1, 0, 999, 1000", () => {
    assertProp(
      fc.property(fc.constantFrom(-1, 0, 999, 1000), (ms) => {
        const d = new Date(2024, 0, 15, 12, 0, 0, ms);
        const m2 = moment(d);
        const mOrig = originalMoment(d);
        expect(m2.isValid()).toBe(mOrig.isValid());
        if (mOrig.isValid()) {
          expect(m2.millisecond()).toBe(mOrig.millisecond());
          expect(m2.format("HH:mm:ss.SSS")).toBe(mOrig.format("HH:mm:ss.SSS"));
        }
      }),
      { numRuns: 50 },
    );
  });

  test("year boundaries: 0, 1, 9999, 10000", () => {
    assertProp(
      fc.property(fc.constantFrom(0, 1, 9999, 10000), (y) => {
        const m2 = moment([y, 0, 1]);
        const mOrig = originalMoment([y, 0, 1]);
        expect(m2.isValid()).toBe(mOrig.isValid());
        if (mOrig.isValid()) {
          expect(m2.year()).toBe(mOrig.year());
          expect(m2.format("YYYY-MM-DD")).toBe(mOrig.format("YYYY-MM-DD"));
        }
      }),
      { numRuns: 50 },
    );
  });

  test("duration boundaries: MIN_SAFE_INTEGER, -1, 0, 1, MAX_SAFE_INTEGER", () => {
    assertProp(
      fc.property(
        fc.constantFrom(Number.MIN_SAFE_INTEGER, -1, 0, 1, Number.MAX_SAFE_INTEGER),
        (n) => {
          const m2 = moment.duration(n).asMilliseconds();
          const mOrig = originalMoment.duration(n).asMilliseconds();
          if (!isFinite(m2) && !isFinite(mOrig)) {
            expect(true).toBe(true);
          } else if (isNaN(m2) && isNaN(mOrig)) {
            expect(true).toBe(true);
          } else {
            expect(m2).toBe(mOrig);
          }
        },
      ),
      { numRuns: 50 },
    );
  });

  test("unix timestamp integer boundaries around 0", () => {
    assertProp(
      fc.property(
        fc.constantFrom(0, -1, 1, -86400000, 86400000, -31536000000, 31536000000),
        (ts) => {
          const d = new Date(ts);
          const m2 = moment(d);
          const mOrig = originalMoment(d);
          expect(m2.isValid()).toBe(mOrig.isValid());
          if (mOrig.isValid()) {
            expect(m2.valueOf()).toBe(mOrig.valueOf());
            expect(m2.unix()).toBe(mOrig.unix());
          }
        },
      ),
      { numRuns: 50 },
    );
  });
});
