import { describe, test, expect } from "bun:test";
import moment from "../src/index.ts";
import originalMoment from "../moment/moment.js";
import { brLocale } from "../src/locale/br.ts";

describe("calendar-extra week methods", () => {
  describe("isoWeek", () => {
    test("isoWeek getter", () => {
      expect(moment("2024-01-15").isoWeek()).toBe(originalMoment("2024-01-15").isoWeek());
    });

    test("isoWeek setter", () => {
      const m = moment("2024-06-15");
      const o = originalMoment("2024-06-15");
      m.isoWeek(20);
      o.isoWeek(20);
      expect(m.isoWeek()).toBe(o.isoWeek());
      expect(m.format("YYYY-MM-DD")).toBe(o.format("YYYY-MM-DD"));
    });

    test("setter matches moment.js coercion and invalidation", () => {
      for (const value of [1.5, NaN, Infinity]) {
        const m = moment.utc("2024-06-15T12:34:56Z");
        const o = originalMoment.utc("2024-06-15T12:34:56Z");
        m.isoWeek(value);
        o.isoWeek(value);
        expect(m.valueOf()).toBe(o.valueOf());
        expect(m.isValid()).toBe(o.isValid());
      }
    });
  });

  describe("isoWeekday", () => {
    test("isoWeekday getter (Mon=1, Sun=7)", () => {
      const m = moment("2024-01-15");
      expect(typeof m.isoWeekday()).toBe("number");
    });

    test("isoWeekday setter", () => {
      const m = moment("2024-01-15");
      const o = originalMoment("2024-01-15");
      m.isoWeekday(1);
      o.isoWeekday(1);
      expect(m.isoWeekday()).toBe(o.isoWeekday());
      expect(m.format("YYYY-MM-DD")).toBe(o.format("YYYY-MM-DD"));
    });

    test("isoWeekday handles null and NaN like moment.js", () => {
      const getter = moment.utc("2024-03-10T07:30:00Z");
      expect(getter.isoWeekday(null as never)).toBe(
        originalMoment.utc("2024-03-10T07:30:00Z").isoWeekday(),
      );

      const m = moment.utc("2024-03-10T07:30:00Z");
      const o = originalMoment.utc("2024-03-10T07:30:00Z");
      m.isoWeekday(NaN);
      o.isoWeekday(NaN);
      expect(m.valueOf()).toBe(o.valueOf());
    });

    test("isoWeekday parses locale names and prefixes like moment.js", () => {
      for (const value of ["Mo", "mondayx", "foobar"]) {
        const m = moment("2024-06-12");
        const o = originalMoment("2024-06-12");
        m.isoWeekday(value);
        o.isoWeekday(value);
        expect(m.valueOf()).toBe(o.valueOf());
      }
    });

    test("isoWeekday honors locale weekday parse tables", () => {
      moment.defineLocale("x-br-weekday", brLocale);
      originalMoment.defineLocale("x-br-weekday", brLocale);
      for (const value of ["Me", "Mer", "Mercʼher"]) {
        const m = moment("2024-06-12").locale("x-br-weekday");
        const o = originalMoment("2024-06-12").locale("x-br-weekday");
        m.isoWeekday(value);
        o.isoWeekday(value);
        expect(m.valueOf()).toBe(o.valueOf());
      }
      moment.locale("en");
      originalMoment.locale("en");
    });

    test("isoWeekday matches generated locale regex punctuation semantics", () => {
      const config = {
        weekdays: ["Sa.na", "Day1", "Day2", "Day3", "Day4", "Day5", "Day6"],
        weekdaysShort: ["Sh0", "Sh1", "Sh2", "Sh3", "Sh4", "Sh5", "Sh6"],
        weekdaysMin: ["M0", "M1", "M2", "M3", "M4", "M5", "M6"],
      };
      moment.defineLocale("x-regex-weekday", config);
      originalMoment.defineLocale("x-regex-weekday", config);
      const m = moment("2024-06-12").locale("x-regex-weekday").isoWeekday("Sana");
      const o = originalMoment("2024-06-12").locale("x-regex-weekday").isoWeekday("Sana");
      expect(m.valueOf()).toBe(o.valueOf());
      moment.locale("en");
      originalMoment.locale("en");
    });

    test("strict exact parsing without a format uses minimum names", () => {
      const config = {
        weekdays: ["Sunx", "Monx", "Tuex", "Wedx", "Thux", "Frix", "Satx"],
        weekdaysShort: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
        weekdaysMin: ["Sx", "Mx", "Tx", "Wx", "Hx", "Fx", "Ax"],
        weekdaysParseExact: true,
      };
      const mmLocale = moment.defineLocale("x-exact-weekday", config);
      const omLocale = originalMoment.defineLocale("x-exact-weekday", config);
      expect(mmLocale?.weekdaysParse("Sx", undefined, true)).toBe(
        omLocale?.weekdaysParse("Sx", undefined, true),
      );
      moment.locale("en");
      originalMoment.locale("en");
    });
  });

  describe("isoWeekYear", () => {
    test("isoWeekYear getter", () => {
      expect(moment("2024-01-01").isoWeekYear()).toBe(originalMoment("2024-01-01").isoWeekYear());
    });

    test("isoWeekYear setter", () => {
      const m = moment("2024-06-15");
      const o = originalMoment("2024-06-15");
      m.isoWeekYear(2025);
      o.isoWeekYear(2025);
      expect(m.isoWeekYear()).toBe(o.isoWeekYear());
      expect(m.format("YYYY-MM-DD")).toBe(o.format("YYYY-MM-DD"));
    });

    test("setter matches fractional, non-finite, and TimeClip behavior", () => {
      for (const value of [2024.5, NaN, Infinity, -271821, 275761]) {
        const m = moment.utc("2024-06-15T12:34:56Z");
        const o = originalMoment.utc("2024-06-15T12:34:56Z");
        m.isoWeekYear(value);
        o.isoWeekYear(value);
        expect(m.valueOf()).toBe(o.valueOf());
        expect(m.isValid()).toBe(o.isValid());
      }

      const m = moment.utc("2024-06-15T12:34:56Z");
      const o = originalMoment.utc("2024-06-15T12:34:56Z");
      m.isoWeekYear("2024" as never);
      o.isoWeekYear("2024" as never);
      expect(m.valueOf()).toBe(o.valueOf());
    });
  });

  describe("dayOfYear", () => {
    test("dayOfYear getter", () => {
      const m = moment("2024-01-15");
      expect(m.dayOfYear()).toBe(15);
    });

    test("dayOfYear setter", () => {
      const m = moment("2024-01-15");
      m.dayOfYear(32);
      expect(m.dayOfYear()).toBe(32);
      expect(m.format("MM-DD")).toBe("02-01");
    });

    test("dayOfYear 366 in leap year", () => {
      const m = moment("2024-01-01");
      m.dayOfYear(366);
      expect(m.format("MM-DD")).toBe("12-31");
    });

    test("null and the negative TimeClip year match moment.js", () => {
      const m = moment.utc(-8_639_977_881_600_001);
      const o = originalMoment.utc(-8_639_977_881_600_001);
      expect(m.dayOfYear(null as never)).toBe(o.dayOfYear());
    });
  });

  test("invalid null week getters match moment.js", () => {
    const m = moment.invalid();
    for (const method of [
      "weekday",
      "isoWeekday",
      "week",
      "isoWeek",
      "weekYear",
      "isoWeekYear",
    ] as const) {
      expect(m[method](null as never)).toBeNaN();
    }
  });

  describe("weekday with locale", () => {
    test("weekday with en locale", () => {
      const m = moment("2024-01-15");
      expect(typeof m.weekday()).toBe("number");
    });
  });

  describe("locale-aware startOf/endOf week", () => {
    const testDates = [
      "2024-01-15", // Monday
      "2024-06-15", // Saturday
      "2024-09-01", // Sunday
      "2024-03-10", // Sunday (DST spring-forward in US)
      "2024-11-03", // Sunday (DST fall-back in US)
    ];

    // Test each dow value 0-6 (Sunday=0, Monday=1, ..., Saturday=6)
    const dows = [0, 1, 2, 3, 4, 5, 6];

    dows.forEach((dow) => {
      const localeName = `x-start-end-${dow}`;

      test(`startOf("week") with dow=${dow} matches moment.js`, () => {
        moment.defineLocale(localeName, { week: { dow } } as unknown as Record<string, unknown>);
        originalMoment.defineLocale(localeName, { week: { dow } } as unknown as Record<
          string,
          unknown
        >);

        for (const dateStr of testDates) {
          const m = moment(dateStr).locale(localeName);
          const o = originalMoment(dateStr).locale(localeName);

          const mStart = m.clone().startOf("week");
          const oStart = o.clone().startOf("week");

          expect(mStart.valueOf()).toBe(oStart.valueOf());
          expect(mStart.day()).toBe(oStart.day());
          expect(mStart.isoWeekday()).toBe(oStart.isoWeekday());
          expect(mStart.format("YYYY-MM-DD")).toBe(oStart.format("YYYY-MM-DD"));
        }

        moment.locale("en");
        originalMoment.locale("en");
      });

      test(`endOf("week") with dow=${dow} matches moment.js`, () => {
        moment.defineLocale(localeName, { week: { dow } } as unknown as Record<string, unknown>);
        originalMoment.defineLocale(localeName, { week: { dow } } as unknown as Record<
          string,
          unknown
        >);

        for (const dateStr of testDates) {
          const m = moment(dateStr).locale(localeName);
          const o = originalMoment(dateStr).locale(localeName);

          const mEnd = m.clone().endOf("week");
          const oEnd = o.clone().endOf("week");

          expect(mEnd.valueOf()).toBe(oEnd.valueOf());
          expect(mEnd.day()).toBe(oEnd.day());
          expect(mEnd.isoWeekday()).toBe(oEnd.isoWeekday());
          expect(mEnd.format("YYYY-MM-DD")).toBe(oEnd.format("YYYY-MM-DD"));
        }

        moment.locale("en");
        originalMoment.locale("en");
      });
    });

    test("startOf isoWeek matches moment.js", () => {
      for (const dateStr of testDates) {
        const m = moment(dateStr);
        const o = originalMoment(dateStr);
        const mStart = m.clone().startOf("isoWeek");
        const oStart = o.clone().startOf("isoWeek");
        expect(mStart.valueOf()).toBe(oStart.valueOf());
        expect(mStart.isoWeekday()).toBe(oStart.isoWeekday());
        expect(mStart.day()).toBe(oStart.day());
        expect(mStart.format("YYYY-MM-DD")).toBe(oStart.format("YYYY-MM-DD"));
      }
    });

    test("endOf isoWeek matches moment.js", () => {
      for (const dateStr of testDates) {
        const m = moment(dateStr);
        const o = originalMoment(dateStr);
        const mEnd = m.clone().endOf("isoWeek");
        const oEnd = o.clone().endOf("isoWeek");
        expect(mEnd.valueOf()).toBe(oEnd.valueOf());
        expect(mEnd.isoWeekday()).toBe(oEnd.isoWeekday());
        expect(mEnd.day()).toBe(oEnd.day());
        expect(mEnd.format("YYYY-MM-DD")).toBe(oEnd.format("YYYY-MM-DD"));
      }
    });

    test("startOf/endOf week with dow=0 (default) round-trip", () => {
      const m = moment("2024-06-15");
      const start = m.clone().startOf("week");
      const end = m.clone().endOf("week");
      expect(start.isSameOrBefore(m)).toBe(true);
      expect(end.isSameOrAfter(m)).toBe(true);
      expect(start.valueOf()).toBeLessThanOrEqual(end.valueOf());
    });

    test("startOf week with custom dow preserves correct $W", () => {
      const dow = 3; // Wednesday
      moment.defineLocale("x-w-start", { week: { dow } } as unknown as Record<string, unknown>);
      const m = moment("2024-06-15").locale("x-w-start").startOf("week");
      expect(m.day()).toBe(3);
      expect(m.isoWeekday()).toBe(3);
      expect(m.format("dddd")).toBe("Wednesday");
      moment.locale("en");
    });

    test("startOf isoWeek preserves correct $W", () => {
      const m = moment("2024-06-15").startOf("isoWeek");
      expect(m.day()).toBe(1);
      expect(m.isoWeekday()).toBe(1);
      expect(m.format("dddd")).toBe("Monday");
    });

    test("isoWeekday setter preserves time fields", () => {
      const m = moment("2024-06-15T14:30:45.123");
      m.isoWeekday(1);
      expect(m.hour()).toBe(14);
      expect(m.minute()).toBe(30);
      expect(m.second()).toBe(45);
      expect(m.millisecond()).toBe(123);
    });

    test("isoWeekday setter preserves time fields with oracle", () => {
      const dates = [
        "2024-06-15T14:30:45.123",
        "2024-01-01T00:00:00.000",
        "2024-12-31T23:59:59.999",
      ];
      for (const dateStr of dates) {
        const m = moment(dateStr);
        const o = originalMoment(dateStr);
        m.isoWeekday(3);
        o.isoWeekday(3);
        expect(m.valueOf()).toBe(o.valueOf());
        expect(m.format("HH:mm:ss.SSS")).toBe(o.format("HH:mm:ss.SSS"));
        expect(m.isoWeekday()).toBe(o.isoWeekday());
      }
    });

    test("dayOfYear setter preserves time fields", () => {
      const m = moment("2024-06-15T14:30:45.123");
      m.dayOfYear(1);
      expect(m.format("MM-DD")).toBe("01-01");
      expect(m.hour()).toBe(14);
      expect(m.minute()).toBe(30);
      expect(m.second()).toBe(45);
      expect(m.millisecond()).toBe(123);
    });

    test("dayOfYear setter preserves time fields with oracle", () => {
      const dates = [
        "2024-06-15T14:30:45.123",
        "2024-01-01T00:00:00.000",
        "2024-12-31T23:59:59.999",
      ];
      for (const dateStr of dates) {
        const m = moment(dateStr);
        const o = originalMoment(dateStr);
        m.dayOfYear(200);
        o.dayOfYear(200);
        expect(m.valueOf()).toBe(o.valueOf());
        expect(m.format("HH:mm:ss.SSS")).toBe(o.format("HH:mm:ss.SSS"));
        expect(m.format("MM-DD")).toBe(o.format("MM-DD"));
      }
    });
  });
});
