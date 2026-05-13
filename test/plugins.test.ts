import { describe, test, expect } from "bun:test";
import moment from "../src/index.ts";

describe("plugins", () => {
  describe("core-base", () => {
    test("moment.min", () => {
      const a = moment("2024-01-15");
      const b = moment("2024-06-15");
      const m = moment.min(a, b);
      expect(m.format("MM")).toBe("01");
    });

    test("moment.max", () => {
      const a = moment("2024-01-15");
      const b = moment("2024-06-15");
      const m = moment.max(a, b);
      expect(m.format("MM")).toBe("06");
    });

    test("moment.now", () => {
      const n = moment.now();
      expect(typeof n).toBe("number");
    });

    test("moment.isMoment", () => {
      expect(moment.isMoment(moment())).toBe(true);
      expect(moment.isMoment(new Date())).toBe(false);
    });

    test("moment.isDate", () => {
      expect(moment.isDate(new Date())).toBe(true);
      expect(moment.isDate(moment())).toBe(false);
    });

    test("moment.suppressDeprecationWarnings", () => {
      moment.suppressDeprecationWarnings = true;
      expect(moment.suppressDeprecationWarnings).toBe(true);
      moment.suppressDeprecationWarnings = false;
    });
  });

  describe("core-lite", () => {
    // lite-specific methods tested separately
  });

  describe("display", () => {
    test("moment.relativeTimeRounding", () => {
      expect(typeof moment.relativeTimeRounding()).toBe("function");
    });

    test("moment.relativeTimeThreshold", () => {
      const s = moment.relativeTimeThreshold("s");
      expect(typeof s).toBe("number");
    });
  });

  describe("locale", () => {
    test("moment.locale returns current locale", () => {
      const loc = moment.locale();
      expect(typeof loc).toBe("string");
    });

    test("moment.localeData returns locale data", () => {
      const ld = moment.localeData();
      expect(ld).toBeDefined();
    });
  });

  describe("utc", () => {
    test("moment.utc returns UTC moment", () => {
      const m = moment.utc("2024-01-15");
      expect(m.isUTC()).toBe(true);
    });

    test("moment.parseZone", () => {
      const m = moment.parseZone("2024-01-15T10:30:00+05:30");
      expect(m.utcOffset()).toBe(330);
    });
  });
});
