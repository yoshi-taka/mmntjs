import { describe, test, expect } from "bun:test";
import moment from "../src/lite.ts";

describe("factory-lite-impl", () => {
  describe("moment() with null", () => {
    test("null input returns invalid", () => {
      const m = moment(null);
      expect(m.isValid()).toBe(false);
    });
  });

  describe("moment() with format but no input", () => {
    test("format without input returns invalid", () => {
      const m = moment(undefined, "YYYY-MM-DD");
      expect(m.isValid()).toBe(false);
    });

    test("empty array format without input returns valid", () => {
      const m = moment(undefined, []);
      expect(m.isValid()).toBe(true);
    });
  });

  describe("moment.utc()", () => {
    test("utc with null input", () => {
      const m = moment.utc(null);
      expect(m.isValid()).toBe(false);
    });

    test("utc with undefined", () => {
      const m = moment.utc();
      expect(m.isValid()).toBe(true);
    });

    test("utc with string", () => {
      const m = moment.utc("2024-01-15");
      expect(m.isValid()).toBe(true);
    });
  });

  describe("moment() with number and format", () => {
    test("number with X format (unix seconds)", () => {
      const m = moment(1705276800, "X");
      expect(m.isValid()).toBe(true);
    });

    test("number with x format (unix ms)", () => {
      const m = moment(1705276800000, "x");
      expect(m.isValid()).toBe(true);
    });

    test("number with unknown format returns invalid", () => {
      const m = moment(1000, "YYYY");
      expect(m.isValid()).toBe(false);
    });

    test("NaN input returns invalid", () => {
      const m = moment(NaN);
      expect(m.isValid()).toBe(false);
    });

    test("Infinity input returns invalid", () => {
      const m = moment(Infinity);
      expect(m.isValid()).toBe(false);
    });
  });

  describe("moment() with format boolean arg", () => {
    test("strict mode with boolean as format arg", () => {
      const m = moment("2024-01-15", true);
      expect(m.isValid()).toBe(true);
    });
  });

  describe("moment() with locale", () => {
    test("locale as third arg (format parsing not available in lite)", () => {
      const m = moment("2024-01-15", "YYYY-MM-DD", "en");
      expect(m.isValid()).toBe(false);
    });
  });

  describe("moment() with object input", () => {
    test("object input returns invalid (not supported in lite)", () => {
      const m = moment({ year: 2024, month: 0, day: 15 });
      expect(m.isValid()).toBe(false);
    });
  });
});
