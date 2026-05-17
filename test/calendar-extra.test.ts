import { describe, test, expect } from "bun:test";
import moment from "../src/index.ts";
import originalMoment from "../moment/moment.js";

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
