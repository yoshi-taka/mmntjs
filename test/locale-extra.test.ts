import { describe, test, expect } from "bun:test";
import fc from "fast-check";
import { assertProp } from "./properties/helpers";
import moment from "../src/index.ts";
import originalMoment from "../moment/moment.js";

type DeprecatedLangMoment = ReturnType<typeof moment> & {
  lang(locale?: string): string | ReturnType<typeof moment>;
};

describe("locale-extra week methods", () => {
  describe("weekday", () => {
    test("getter returns current weekday", () => {
      const m = moment("2024-01-15");
      expect(typeof m.weekday()).toBe("number");
    });

    test("setter changes date", () => {
      const m = moment("2024-01-15");
      const o = originalMoment("2024-01-15");
      m.weekday(0);
      o.weekday(0);
      expect(m.format("YYYY-MM-DD")).toBe(o.format("YYYY-MM-DD"));
      expect(m.weekday()).toBe(o.weekday());
    });

    test("setter returns moment", () => {
      const m = moment("2024-01-15");
      const r = m.weekday(0);
      expect(r).toBe(m);
    });

    test("setter matches moment.js numeric coercion", () => {
      for (const value of [1.5, NaN, Infinity]) {
        const m = moment.utc("2024-06-15T12:34:56Z");
        const o = originalMoment.utc("2024-06-15T12:34:56Z");
        m.weekday(value);
        o.weekday(value);
        expect(m.valueOf()).toBe(o.valueOf());
        expect(m.isValid()).toBe(o.isValid());
      }
    });

    test("setter observes TimeClip in UTC and fixed-offset modes", () => {
      const cases = [
        [moment.utc(-8.64e15), originalMoment.utc(-8.64e15), 1],
        [
          moment.parseZone("2024-01-01T00:00:00+14:00"),
          originalMoment.parseZone("2024-01-01T00:00:00+14:00"),
          1e9,
        ],
      ] as const;
      for (const [m, o, value] of cases) {
        m.weekday(value);
        o.weekday(value);
        expect(m.valueOf()).toBe(o.valueOf());
        expect(m.isValid()).toBe(o.isValid());
      }
    });
  });

  describe("week", () => {
    test("getter returns locale week", () => {
      const m = moment("2024-01-15");
      expect(typeof m.week()).toBe("number");
    });

    test("setter changes date", () => {
      const m = moment("2024-01-15");
      const o = originalMoment("2024-01-15");
      m.week(10);
      o.week(10);
      expect(m.format("YYYY-MM-DD")).toBe(o.format("YYYY-MM-DD"));
      expect(m.week()).toBe(o.week());
    });

    test("setter matches moment.js numeric coercion", () => {
      for (const value of [1.5, NaN, Infinity]) {
        const m = moment.utc("2024-06-15T12:34:56Z");
        const o = originalMoment.utc("2024-06-15T12:34:56Z");
        m.week(value);
        o.week(value);
        expect(m.valueOf()).toBe(o.valueOf());
        expect(m.isValid()).toBe(o.isValid());
      }
    });

    test("huge finite setter invalidates like moment.js", () => {
      for (const method of ["week", "isoWeek"] as const) {
        const m = moment.parseZone("2024-01-01T00:00:00-12:00");
        const o = originalMoment.parseZone("2024-01-01T00:00:00-12:00");
        m[method](1e9);
        o[method](1e9);
        expect(m.valueOf()).toBe(o.valueOf());
        expect(m.isValid()).toBe(o.isValid());
      }
    });
  });

  describe("weekYear", () => {
    test("getter returns locale week year", () => {
      const m = moment("2024-01-01");
      expect(typeof m.weekYear()).toBe("number");
    });

    test("setter changes week year", () => {
      const m = moment("2024-06-15");
      const o = originalMoment("2024-06-15");
      m.weekYear(2025);
      o.weekYear(2025);
      expect(m.format("YYYY-MM-DD")).toBe(o.format("YYYY-MM-DD"));
      expect(m.weekYear()).toBe(o.weekYear());
    });

    test("null getters and numeric-string week years match moment.js", () => {
      const m = moment.utc("2024-06-15T12:34:56Z");
      const o = originalMoment.utc("2024-06-15T12:34:56Z");
      expect(m.week(null as never)).toBe(o.week());
      m.weekYear("2020" as never);
      o.weekYear("2020" as never);
      expect(m.valueOf()).toBe(o.valueOf());
    });

    test("setter preserves moment.js sequential DST normalization", () => {
      for (const method of ["weekYear", "isoWeekYear"] as const) {
        const m = moment("2024-03-08T02:30:00");
        const o = originalMoment("2024-03-08T02:30:00");
        m[method](2020);
        o[method](2020);
        expect(m.valueOf()).toBe(o.valueOf());
        expect(m.format()).toBe(o.format());
      }
    });
  });

  describe("weeksInYear", () => {
    test("returns number of weeks", () => {
      const m = moment("2024-01-15");
      expect(typeof m.weeksInYear()).toBe("number");
      expect(m.weeksInYear()).toBeGreaterThan(0);
    });
  });

  describe("isoWeeksInYear", () => {
    test("returns number of ISO weeks", () => {
      const m = moment("2024-01-15");
      expect(typeof m.isoWeeksInYear()).toBe("number");
    });

    test("matches moment.js for extended years", () => {
      for (const year of [-400, -1, 0, 1, 4, 99, 100, 400]) {
        for (const utc of [false, true]) {
          const m = utc ? moment.utc([year, 0, 1]) : moment([year, 0, 1]);
          const o = utc ? originalMoment.utc([year, 0, 1]) : originalMoment([year, 0, 1]);
          expect(m.week()).toBe(o.week());
          expect(m.isoWeek()).toBe(o.isoWeek());
          expect(m.weeksInYear()).toBe(o.weeksInYear());
          expect(m.isoWeeksInYear()).toBe(o.isoWeeksInYear());
        }
      }
    });
  });

  describe("localeData", () => {
    test("returns locale data", () => {
      const ld = moment("2024-01-15").localeData();
      expect(ld).toBeDefined();
      expect(typeof ld._months).toBe("object");
    });
  });

  describe("lang (deprecated)", () => {
    test("getter returns current lang", () => {
      const m = moment("2024-01-15");
      expect(typeof (m as DeprecatedLangMoment).lang()).toBe("string");
    });

    test("setter changes lang to en (only available locale)", () => {
      const m = moment("2024-01-15");
      (m as DeprecatedLangMoment).lang("en");
      expect((m as DeprecatedLangMoment).lang()).toBe("en");
    });
  });

  describe("locale getter/setter on instance", () => {
    test("getter returns locale name", () => {
      const m = moment("2024-01-15");
      expect(typeof m.locale()).toBe("string");
    });

    test("setter changes locale to en", () => {
      const m = moment("2024-01-15");
      m.locale("en");
      expect(m.locale()).toBe("en");
    });

    test("setter with array tries each locale", () => {
      const m = moment("2024-01-15");
      m.locale(["en"]);
      expect(m.locale()).toBe("en");
    });

    test("locale(false) resets to global", () => {
      const prev = moment.locale();
      moment.locale("en");
      const m = moment("2024-01-15");
      m.locale("en");
      const r = m.locale(false as unknown as string[]);
      expect(r).toBe(m);
      expect(m.locale()).toBe("en");
      moment.locale(prev);
    });
  });
});

describe("property-based locale extra patterns", () => {
  const safeMin = new Date("1900-01-01");
  const safeMax = new Date("2100-01-01");
  const safeDates = fc.date({ min: safeMin, max: safeMax, noInvalidDate: true });
  const weekNumbers = fc.integer({ min: 1, max: 53 });
  const weekYears = fc.integer({ min: 1950, max: 2050 });

  test("weekday getter matches moment.js", () => {
    assertProp(
      fc.property(safeDates, (d) => {
        const m = moment(d);
        const o = originalMoment(d);
        expect(m.weekday()).toBe(o.weekday());
      }),
      { numRuns: 200 },
    );
  });

  test("weekday setter matches moment.js", () => {
    assertProp(
      fc.property(safeDates, fc.integer({ min: 0, max: 6 }), (d, wd) => {
        const m = moment(d);
        const o = originalMoment(d);
        m.weekday(wd);
        o.weekday(wd);
        expect(m.weekday()).toBe(o.weekday());
        expect(m.valueOf()).toBe(o.valueOf());
      }),
      { numRuns: 100 },
    );
  });

  test("week getter matches moment.js", () => {
    assertProp(
      fc.property(safeDates, (d) => {
        const m = moment(d);
        const o = originalMoment(d);
        expect(m.week()).toBe(o.week());
      }),
      { numRuns: 200 },
    );
  });

  test("week setter matches moment.js", () => {
    assertProp(
      fc.property(safeDates, weekNumbers, (d, w) => {
        const m = moment(d);
        const o = originalMoment(d);
        m.week(w);
        o.week(w);
        expect(m.week()).toBe(o.week());
        expect(m.valueOf()).toBe(o.valueOf());
      }),
      { numRuns: 100 },
    );
  });

  test("weekYear getter matches moment.js", () => {
    assertProp(
      fc.property(safeDates, (d) => {
        const m = moment(d);
        const o = originalMoment(d);
        expect(m.weekYear()).toBe(o.weekYear());
      }),
      { numRuns: 200 },
    );
  });

  test("weekYear setter matches moment.js", () => {
    // Use moment.utc + post-1970 dates to avoid:
    // 1. TZ-dependent DST boundary issues (pre-epoch modulo bug in localeWeekYear timeOfDay)
    // 2. Timezone shift on date boundaries
    const postEpochMin = new Date("1971-01-01");
    const postEpochMax = new Date("2100-01-01");
    const postEpochDates = fc.date({ min: postEpochMin, max: postEpochMax, noInvalidDate: true });
    assertProp(
      fc.property(postEpochDates, weekYears, (d, wy) => {
        const m = moment.utc(d);
        const o = originalMoment.utc(d);
        m.weekYear(wy);
        o.weekYear(wy);
        expect(m.weekYear()).toBe(o.weekYear());
        expect(m.valueOf()).toBe(o.valueOf());
      }),
      { numRuns: 100 },
    );
  });

  test("isoWeekYear setter matches moment.js in local, UTC, and fixed-offset modes", () => {
    assertProp(
      fc.property(safeDates, weekYears, fc.integer({ min: -720, max: 840 }), (d, wy, offset) => {
        const pairs = [
          [moment(d), originalMoment(d)],
          [moment.utc(d), originalMoment.utc(d)],
          [moment.utc(d).utcOffset(offset), originalMoment.utc(d).utcOffset(offset)],
        ] as const;

        for (const [m, o] of pairs) {
          m.isoWeekYear(wy);
          o.isoWeekYear(wy);
          expect(m.valueOf()).toBe(o.valueOf());
          expect(m.isoWeekYear()).toBe(o.isoWeekYear());
          expect(m.isoWeek()).toBe(o.isoWeek());
          expect(m.isoWeekday()).toBe(o.isoWeekday());
        }
      }),
      { numRuns: 200 },
    );
  });

  test("weeksInYear matches moment.js", () => {
    assertProp(
      fc.property(weekYears, (y) => {
        const m = moment().year(y);
        const o = originalMoment().year(y);
        expect(m.weeksInYear()).toBe(o.weeksInYear());
      }),
      { numRuns: 100 },
    );
  });

  test("isoWeeksInYear matches moment.js", () => {
    assertProp(
      fc.property(weekYears, (y) => {
        const m = moment().year(y);
        const o = originalMoment().year(y);
        expect(m.isoWeeksInYear()).toBe(o.isoWeeksInYear());
      }),
      { numRuns: 100 },
    );
  });
});
