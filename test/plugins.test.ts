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

    test("moment.unix", () => {
      const m = moment.unix(1704067200);
      expect(m.isValid()).toBe(true);
      expect(m.valueOf()).toBe(1704067200000);
    });

    test("moment.invalid", () => {
      const m = moment.invalid();
      expect(m.isValid()).toBe(false);
    });

    test("moment.invalid with object", () => {
      const m = moment.invalid({ foo: "bar" });
      expect(m.isValid()).toBe(false);
      expect(m.parsingFlags().userInvalidated).toBe(true);
    });

    test("moment.invalid with Date", () => {
      const m = moment.invalid(new Date());
      expect(m.isValid()).toBe(false);
    });
  });

  describe("core-lite", () => {
    test("moment.version", () => {
      expect(typeof moment.version).toBe("string");
      expect(moment.version).toBe("2.30.1");
    });

    test("moment.ISO_8601", () => {
      expect(moment.ISO_8601).toBe("ISO_8601");
    });

    test("moment.unix via lite", () => {
      const m = moment.unix(0);
      expect(m.isValid()).toBe(true);
    });

    test("moment.invalid via lite", () => {
      const m = moment.invalid();
      expect(m.isValid()).toBe(false);
    });

    test("moment.invalid with number", () => {
      const m = moment.invalid(123);
      expect(m.isValid()).toBe(false);
    });

    test("moment.now getter returns number", () => {
      const n = moment.now();
      expect(typeof n).toBe("number");
      expect(n).toBeGreaterThan(0);
    });

    test("moment.parseTwoDigitYear", () => {
      const fn = moment.parseTwoDigitYear;
      expect(typeof fn).toBe("function");
      const result = fn("68");
      expect(typeof result).toBe("number");
    });

    test("moment.utc exists", () => {
      expect(typeof moment.utc).toBe("function");
      const m = moment.utc("2024-01-15");
      expect(m.isValid()).toBe(true);
    });
  });

  describe("display", () => {
    test("moment.relativeTimeRounding", () => {
      expect(typeof moment.relativeTimeRounding()).toBe("function");
    });

    test("moment.relativeTimeThreshold", () => {
      expect(typeof moment.relativeTimeThreshold).toBe("function");
    });
  });
});
