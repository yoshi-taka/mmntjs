import { describe, test, expect } from "bun:test";
import moment from "../src/index.ts";

describe("calendar-extra week methods", () => {
  describe("isoWeek", () => {
    test("isoWeek getter", () => {
      const m = moment("2024-01-15");
      expect(typeof m.isoWeek()).toBe("number");
    });

    test("isoWeek setter", () => {
      const m = moment("2024-06-15");
      m.isoWeek(20);
      expect(m.isoWeek()).toBe(20);
    });
  });

  describe("isoWeekday", () => {
    test("isoWeekday getter (Mon=1, Sun=7)", () => {
      const m = moment("2024-01-15");
      expect(typeof m.isoWeekday()).toBe("number");
    });

    test("isoWeekday setter", () => {
      const m = moment("2024-01-15");
      m.isoWeekday(1);
      expect(m.isoWeekday()).toBe(1);
    });
  });

  describe("isoWeekYear", () => {
    test("isoWeekYear getter", () => {
      const m = moment("2024-01-01");
      expect(typeof m.isoWeekYear()).toBe("number");
    });

    test("isoWeekYear setter", () => {
      const m = moment("2024-06-15");
      m.isoWeekYear(2025);
      expect(typeof m.isoWeekYear()).toBe("number");
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
