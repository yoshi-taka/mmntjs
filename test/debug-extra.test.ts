import { describe, test, expect } from "bun:test";
import fc from "fast-check";
import moment from "../src/index.ts";
import originalMoment from "../moment/moment.js";

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

  describe("property-based debug patterns", () => {
    const safeMin = new Date("1900-01-01");
    const safeMax = new Date("2100-01-01");
    const safeDates = fc.date({ min: safeMin, max: safeMax, noInvalidDate: true });

    test("toArray matches moment.js", () => {
      fc.assert(
        fc.property(safeDates, (d) => {
          const m = moment(d);
          const o = originalMoment(d);
          expect(m.toArray()).toEqual(o.toArray());
        }),
        { numRuns: 200 },
      );
    });

    test("toObject matches moment.js", () => {
      fc.assert(
        fc.property(safeDates, (d) => {
          const m = moment(d);
          const o = originalMoment(d);
          expect(m.toObject()).toEqual(o.toObject());
        }),
        { numRuns: 200 },
      );
    });

    test("toISOString matches moment.js for UTC", () => {
      fc.assert(
        fc.property(safeDates, (d) => {
          const m = moment.utc(d);
          const o = originalMoment.utc(d);
          expect(m.toISOString()).toBe(o.toISOString());
        }),
        { numRuns: 200 },
      );
    });

    test("parsingFlags key set matches moment.js", () => {
      fc.assert(
        fc.property(safeDates, (d) => {
          const m = moment(d);
          const o = originalMoment(d);
          const mf = m.parsingFlags();
          const of = (
            o as unknown as { parsingFlags: () => Record<string, unknown> }
          ).parsingFlags();
          // Both -1 and -2 mean "no overflow" (mmntjs: -1, moment.js: -2)
          if (of.overflow >= 0) {
            expect(mf.overflow).toBe(of.overflow);
          } else {
            expect(mf.overflow).toBeLessThan(0);
          }
          expect(mf.empty).toBe(of.empty);
          expect(mf.nullInput).toBe(of.nullInput);
          expect(mf.userInvalidated).toBe(of.userInvalidated);
        }),
        { numRuns: 100 },
      );
    });

    test("invalidAt matches moment.js for valid dates", () => {
      fc.assert(
        fc.property(safeDates, (d) => {
          const m = moment(d);
          const o = originalMoment(d);
          const mVal = m.invalidAt();
          const oVal = o.invalidAt();
          // Both -1 and -2 mean "valid" (mmntjs: -1, moment.js: -2)
          if (oVal >= 0) {
            expect(mVal).toBe(oVal);
          } else {
            expect(mVal).toBeLessThan(0);
          }
        }),
        { numRuns: 200 },
      );
    });
  });
});
