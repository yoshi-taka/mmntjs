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
});
