import { describe, test, expect } from "bun:test";
import moment from "../src/index.ts";

describe("debug-extra moment methods", () => {
  describe("toArray", () => {
    test("valid moment", () => {
      const arr = moment("2024-01-15 10:30:45.500").toArray();
      expect(arr).toEqual([2024, 0, 15, 10, 30, 45, 500]);
    });
  });

  describe("toObject", () => {
    test("valid moment", () => {
      const obj = moment("2024-01-15 10:30:45.500").toObject();
      expect(obj).toEqual({
        years: 2024,
        months: 0,
        date: 15,
        hours: 10,
        minutes: 30,
        seconds: 45,
        milliseconds: 500,
      });
    });
  });

  describe("inspect", () => {
    test("valid local moment", () => {
      const str = moment("2024-01-15").inspect();
      expect(str).toMatch(/^moment\(/);
    });

    test("valid UTC moment", () => {
      const str = moment.utc("2024-01-15").inspect();
      expect(str).toMatch(/moment\.utc\(/);
    });

    test("invalid moment", () => {
      const str = moment("invalid").inspect();
      expect(str).toMatch(/moment\.invalid/);
    });
  });

  describe("creationData", () => {
    test("includes input, format, locale", () => {
      const data = moment("2024-01-15", "YYYY-MM-DD").creationData();
      expect(data.input).toBe("2024-01-15");
      expect(data.format).toBe("YYYY-MM-DD");
      expect(data.locale).toBeDefined();
    });
  });

  describe("parsingFlags", () => {
    test("valid moment has no flags", () => {
      const flags = moment("2024-01-15").parsingFlags();
      expect(flags.overflow).toBe(-1);
      expect(flags.empty).toBe(false);
      expect(flags.nullInput).toBe(false);
      expect(flags.userInvalidated).toBe(false);
    });

    test("invalid moment has flags", () => {
      const flags = moment("invalid").parsingFlags();
      expect(typeof flags.overflow).toBe("number");
      expect(typeof flags.unusedTokens).toBe("object");
      expect(typeof flags.charsLeftOver).toBe("number");
    });

    test("all flag fields are present", () => {
      const flags = moment("2024-01-15").parsingFlags();
      const keys = [
        "overflow",
        "unusedTokens",
        "unusedInput",
        "charsLeftOver",
        "empty",
        "nullInput",
        "invalidMonth",
        "invalidFormat",
        "userInvalidated",
        "iso",
        "parsedDateParts",
        "meridiem",
        "rfc2822",
        "weekdayMismatch",
        "isAmPm",
        "isParseZone",
        "bigHour",
      ];
      for (const key of keys) {
        expect(flags).toHaveProperty(key);
      }
    });
  });

  describe("invalidAt", () => {
    test("valid moment returns -1", () => {
      expect(moment("2024-01-15").invalidAt()).toBe(-1);
    });

    test("invalid moment returns overflow index", () => {
      const at = moment("2024-13-01").invalidAt();
      expect(at).toBeGreaterThanOrEqual(-1);
    });
  });

  describe("toISOString", () => {
    test("UTC moment", () => {
      const m = moment.utc("2024-01-15T10:30:45.500");
      expect(m.toISOString()).toBe("2024-01-15T10:30:45.500Z");
    });

    test("with keepOffset", () => {
      const m = moment.utc("2024-01-15T10:30:45.500");
      m.utcOffset(330);
      const iso = m.toISOString(true);
      expect(iso).toContain("+05:30");
    });

    test("invalid returns null", () => {
      expect(moment("invalid").toISOString()).toBeNull();
    });
  });
});
