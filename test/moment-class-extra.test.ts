import { describe, test, expect } from "bun:test";
import moment from "../src/index.ts";

describe("Moment class edge cases", () => {
  describe("set()", () => {
    test("set with object", () => {
      const m = moment("2024-01-15");
      m.set({ year: 2025, month: 5 });
      expect(m.year()).toBe(2025);
      expect(m.month()).toBe(5);
    });

    test("set with unit and value", () => {
      const m = moment("2024-01-15");
      m.set("year", 2025);
      expect(m.year()).toBe(2025);
    });

    test("set with invalid unit returns same", () => {
      const m = moment("2024-01-15");
      const r = m.set("invalid" as any, 1);
      expect(r).toBe(m);
    });
  });

  describe("get()", () => {
    test("get with string unit", () => {
      const m = moment("2024-01-15");
      expect(m.get("year")).toBe(2024);
      expect(m.get("month")).toBe(0);
      expect(m.get("date")).toBe(15);
    });

    test("get with invalid unit returns NaN", () => {
      const m = moment("2024-01-15");
      expect(m.get("invalid" as any)).toBeNaN();
    });
  });

  describe("day() setter", () => {
    test("set day of week", () => {
      const m = moment("2024-01-15");
      m.day(0);
      expect(m.day()).toBe(0);
    });
  });

  describe("local() and utc() switching", () => {
    test("local() on UTC moment", () => {
      const m = moment.utc("2024-01-15");
      expect(m.isUTC()).toBe(true);
      m.local();
      expect(m.isLocal()).toBe(true);
    });
  });

  describe("parsingFlags", () => {
    test("valid moment flags", () => {
      const f = moment("2024-01-15").parsingFlags();
      expect(f.overflow).toBe(-1);
      expect(f.empty).toBe(false);
    });

    test("invalid month triggers overflow", () => {
      const f = moment([2024, 13, 1]).parsingFlags();
      expect(f.overflow).toBeGreaterThanOrEqual(0);
    });

    test("invalid day triggers overflow", () => {
      const f = moment([2024, 0, 32]).parsingFlags();
      expect(f.overflow).toBeGreaterThanOrEqual(0);
    });

    test("null input flag", () => {
      const f = moment(null as any).parsingFlags();
      expect(f.nullInput).toBe(true);
    });

    test("invalid month flag", () => {
      const f = moment("2024-Xxx-15", "YYYY-MMM-DD").parsingFlags();
      expect(f.invalidMonth).toBeDefined();
    });
  });

  describe("creationData", () => {
    test("returns input info", () => {
      const data = moment("2024-01-15", "YYYY-MM-DD").creationData();
      expect(data.input).toBe("2024-01-15");
      expect(data.format).toBe("YYYY-MM-DD");
      expect(typeof data.locale).toBe("object");
    });
  });

  describe("invalidAt", () => {
    test("valid returns -1", () => {
      expect(moment("2024-01-15").invalidAt()).toBe(-1);
    });

    test("invalid returns > -1 for overflow", () => {
      const at = moment([2024, 13, 1]).invalidAt();
      expect(at).toBeGreaterThanOrEqual(0);
    });
  });

  describe("toArray/toObject", () => {
    test("toArray", () => {
      const a = moment("2024-01-15 10:30:45.500").toArray();
      expect(a).toEqual([2024, 0, 15, 10, 30, 45, 500]);
    });

    test("toObject", () => {
      const o = moment("2024-01-15 10:30:45.500").toObject();
      expect(o.years).toBe(2024);
      expect(o.months).toBe(0);
      expect(o.date).toBe(15);
    });
  });

  describe("valueOf / unix", () => {
    test("valueOf returns epoch ms", () => {
      const v = moment.utc("2024-01-15").valueOf();
      expect(Math.abs(v - 1705276800000)).toBeLessThan(86400000);
    });

    test("unix returns seconds", () => {
      const u = moment("2024-01-15").unix();
      expect(typeof u).toBe("number");
    });

    test("invalid valueOf returns NaN", () => {
      expect(moment("invalid").valueOf()).toBeNaN();
    });
  });

  describe("isBetween", () => {
    test("isBetween default (exclusive)", () => {
      const m = moment("2024-06-15");
      const a = moment("2024-01-01");
      const b = moment("2024-12-31");
      expect(m.isBetween(a, b)).toBe(true);
    });

    test("isBetween inclusive []", () => {
      const m = moment("2024-06-15");
      expect(m.isBetween(m, m, "day", "[]")).toBe(true);
    });

    test("isBetween exclusive ()", () => {
      const m = moment("2024-06-15");
      expect(m.isBetween(m, m, "day", "()")).toBe(false);
    });
  });

  describe("isDST", () => {
    test("isDST returns boolean", () => {
      expect(typeof moment("2024-06-15").isDST()).toBe("boolean");
    });
  });

  describe("isLeapYear", () => {
    test("leap year detection", () => {
      expect(moment("2024-01-01").isLeapYear()).toBe(true);
      expect(moment("2023-01-01").isLeapYear()).toBe(false);
    });
  });

  describe("daysInMonth", () => {
    test("feb in leap year", () => {
      expect(moment("2024-02-01").daysInMonth()).toBe(29);
      expect(moment("2023-02-01").daysInMonth()).toBe(28);
    });
  });
});
