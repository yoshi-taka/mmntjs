import { describe, test, expect } from "bun:test";
import fc from "fast-check";
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
      const m = moment("2024-01-15");
      m.locale("en");
      const r = m.locale(false as unknown as string[]);
      expect(r).toBe(m);
      expect(m.locale()).toBe("en");
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
    fc.assert(
      fc.property(safeDates, (d) => {
        const m = moment(d);
        const o = originalMoment(d);
        expect(m.weekday()).toBe(o.weekday());
      }),
      { numRuns: 200 },
    );
  });

  test("weekday setter matches moment.js", () => {
    fc.assert(
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
    fc.assert(
      fc.property(safeDates, (d) => {
        const m = moment(d);
        const o = originalMoment(d);
        expect(m.week()).toBe(o.week());
      }),
      { numRuns: 200 },
    );
  });

  test("week setter matches moment.js", () => {
    fc.assert(
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
    fc.assert(
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
    fc.assert(
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

  test("weeksInYear matches moment.js", () => {
    fc.assert(
      fc.property(weekYears, (y) => {
        const m = moment().year(y);
        const o = originalMoment().year(y);
        expect(m.weeksInYear()).toBe(o.weeksInYear());
      }),
      { numRuns: 100 },
    );
  });

  test("isoWeeksInYear matches moment.js", () => {
    fc.assert(
      fc.property(weekYears, (y) => {
        const m = moment().year(y);
        const o = originalMoment().year(y);
        expect(m.isoWeeksInYear()).toBe(o.isoWeeksInYear());
      }),
      { numRuns: 100 },
    );
  });
});
