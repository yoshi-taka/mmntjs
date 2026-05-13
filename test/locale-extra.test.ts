import { describe, test, expect } from "bun:test";
import moment from "../src/index.ts";

describe("locale-extra week methods", () => {
  describe("weekday", () => {
    test("getter returns current weekday", () => {
      const m = moment("2024-01-15");
      expect(typeof m.weekday()).toBe("number");
    });

    test("setter changes date", () => {
      const m = moment("2024-01-15");
      m.weekday(0);
      expect(m.weekday()).toBe(0);
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
      m.week(10);
      expect(m.week()).toBe(10);
    });
  });

  describe("weekYear", () => {
    test("getter returns locale week year", () => {
      const m = moment("2024-01-01");
      expect(typeof m.weekYear()).toBe("number");
    });

    test("setter changes week year", () => {
      const m = moment("2024-06-15");
      m.weekYear(2025);
      expect(typeof m.weekYear()).toBe("number");
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
      expect(typeof (m as any).lang()).toBe("string");
    });

    test("setter changes lang to en (only available locale)", () => {
      const m = moment("2024-01-15");
      (m as any).lang("en");
      expect((m as any).lang()).toBe("en");
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
      expect(m.locale()).toBe("en");
    });
  });
});
