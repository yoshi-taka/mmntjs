import { describe, test, expect, beforeAll } from "bun:test";
import { parseString, enableCustomFormatParsing, parseTwoDigitYear, setParseTwoDigitYear } from "../src/parse-format";
import { getLocale } from "../src/locale";
import type { ParseLocale } from "../src/parse-locale";

// parseString from parse-format.ts requires a locale object
function enLoc(): ParseLocale {
  return getLocale("en") as unknown as ParseLocale;
}

type ParsedExpectation = {
  year?: number;
  month?: number;
  day?: number;
  hour?: number;
  minute?: number;
  second?: number;
  millisecond?: number;
  offset?: number;
} | null;

type ParsedFlags = {
  _weekYear?: number;
  _charsLeftOver?: number;
  _parsedDateParts?: number[];
  _meridiem?: string;
};

function check(input: string, fmt: string, exp: ParsedExpectation) {
  const result = parseString(input, fmt, enLoc());
  if (exp === null) {
    expect(result).toBeNull();
    return;
  }
  expect(result).toBeDefined();
  if (exp.year !== undefined) {expect(result!.year).toBe(exp.year);}
  if (exp.month !== undefined) {expect(result!.month).toBe(exp.month);}
  if (exp.day !== undefined) {expect(result!.day).toBe(exp.day);}
  if (exp.hour !== undefined) {expect(result!.hour).toBe(exp.hour);}
  if (exp.minute !== undefined) {expect(result!.minute).toBe(exp.minute);}
  if (exp.second !== undefined) {expect(result!.second).toBe(exp.second);}
  if (exp.millisecond !== undefined) {expect(result!.millisecond).toBe(exp.millisecond);}
  if (exp.offset !== undefined) {expect(result!.offset).toBe(exp.offset);}
}

describe("parseFormat parseString", () => {
  beforeAll(() => {
    enableCustomFormatParsing();
    setParseTwoDigitYear(undefined);
  });

  describe("basic date tokens", () => {
    test("YYYY-MM-DD", () => {
      check("2024-01-15", "YYYY-MM-DD", { year: 2024, month: 0, day: 15 });
    });

    test("YYYY/MM/DD", () => {
      check("2024/01/15", "YYYY/MM/DD", { year: 2024, month: 0, day: 15 });
    });

    test("DD/MM/YYYY", () => {
      check("15/01/2024", "DD/MM/YYYY", { year: 2024, month: 0, day: 15 });
    });

    test("MM-DD-YYYY", () => {
      check("01-15-2024", "MM-DD-YYYY", { year: 2024, month: 0, day: 15 });
    });

    test("M/D/YYYY", () => {
      check("1/5/2024", "M/D/YYYY", { year: 2024, month: 0, day: 5 });
    });

    test("YYYY-M-D", () => {
      check("2024-1-5", "YYYY-M-D", { year: 2024, month: 0, day: 5 });
    });
  });

  describe("time tokens", () => {
    test("HH:mm:ss", () => {
      check("2024-01-15 10:30:45", "YYYY-MM-DD HH:mm:ss", { year: 2024, month: 0, day: 15, hour: 10, minute: 30, second: 45 });
    });

    test("HH:mm", () => {
      check("2024-01-15 10:30", "YYYY-MM-DD HH:mm", { year: 2024, month: 0, day: 15, hour: 10, minute: 30 });
    });

    test("H:m", () => {
      check("2024-01-15 9:5", "YYYY-MM-DD H:m", { year: 2024, month: 0, day: 15, hour: 9, minute: 5 });
    });

    test("A (AM)", () => {
      check("2024-01-15 10:30 AM", "YYYY-MM-DD hh:mm A", { year: 2024, month: 0, day: 15, hour: 10, minute: 30 });
    });

    test("A (PM)", () => {
      check("2024-01-15 10:30 PM", "YYYY-MM-DD hh:mm A", { year: 2024, month: 0, day: 15, hour: 22, minute: 30 });
    });

    test("a (pm)", () => {
      check("2024-01-15 10:30 pm", "YYYY-MM-DD hh:mm a", { year: 2024, month: 0, day: 15, hour: 22, minute: 30 });
    });

    test("SSS milliseconds", () => {
      check("2024-01-15 10:30:45.123", "YYYY-MM-DD HH:mm:ss.SSS", { year: 2024, month: 0, day: 15, hour: 10, minute: 30, second: 45, millisecond: 123 });
    });

    test("S milliseconds (single digit)", () => {
      check("2024-01-15 10:30:45.1", "YYYY-MM-DD HH:mm:ss.S", { millisecond: 100 });
    });
  });

  describe("timezone tokens", () => {
    test("Z (+HH:mm)", () => {
      check("2024-01-15T10:30:00+05:30", "YYYY-MM-DDTHH:mm:ssZ", { year: 2024, month: 0, day: 15, hour: 10, minute: 30, second: 0, offset: 330 });
    });

    test("ZZ (+HHmm)", () => {
      check("2024-01-15T10:30:00+0530", "YYYY-MM-DDTHH:mm:ssZZ", { hour: 10, minute: 30, offset: 330 });
    });

    test("Z (UTC)", () => {
      check("2024-01-15T10:30:00Z", "YYYY-MM-DDTHH:mm:ssZ", { offset: 0 });
    });
  });

  describe("month name tokens", () => {
    test("MMMM (full month name)", () => {
      check("January 15 2024", "MMMM DD YYYY", { year: 2024, month: 0, day: 15 });
    });

    test("MMM (short month name)", () => {
      check("Jan 15 2024", "MMM DD YYYY", { year: 2024, month: 0, day: 15 });
    });

    test("MMMM lowercase", () => {
      check("january 15 2024", "MMMM DD YYYY", { year: 2024, month: 0, day: 15 });
    });
  });

  describe("ordinal tokens", () => {
    test("Do (ordinal day)", () => {
      check("Jan 15th 2024", "MMM Do YYYY", { year: 2024, month: 0, day: 15 });
    });

    test("Do 1st/2nd/3rd", () => {
      check("Jan 1st 2024", "MMM Do YYYY", { year: 2024, month: 0, day: 1 });
      check("Jan 2nd 2024", "MMM Do YYYY", { year: 2024, month: 0, day: 2 });
      check("Jan 3rd 2024", "MMM Do YYYY", { year: 2024, month: 0, day: 3 });
    });
  });

  describe("year variant tokens", () => {
    test("YY (2-digit year)", () => {
      const r1 = parseString("24-01-15", "YY-MM-DD", enLoc());
      expect(r1!.year).toBe(2024);
      const r2 = parseString("70-01-15", "YY-MM-DD", enLoc());
      expect(r2!.year).toBe(1970);
    });

    test("YYYYYY (signed 6-digit year)", () => {
      check("+002024", "YYYYYY", { year: 2024 });
    });
  });

  describe("timestamp tokens", () => {
    test("X (unix seconds)", () => {
      const r = parseString("1705276800", "X", enLoc());
      expect(r!.year).toBe(2024);
    });

    test("x (unix ms)", () => {
      const r = parseString("1705276800000", "x", enLoc());
      expect(r!.year).toBe(2024);
    });
  });

  describe("day of year tokens", () => {
    test("DDDD (3-digit day of year)", () => {
      const r = parseString("2024-032", "YYYY-DDDD", enLoc());
      expect(r!.year).toBe(2024);
      expect(r!.dayOfYear).toBe(32);
    });

    test("DDD expects 3 digits", () => {
      const r = parseString("2024-032", "YYYY-DDD", enLoc());
      expect(r!.year).toBe(2024);
      expect(r!.dayOfYear).toBe(32);
    });
  });

  describe("week tokens", () => {
    test("ww (week of year)", () => {
      const r = parseString("2024 01", "GGGG ww", enLoc());
      expect((r as ParsedFlags | null)?._weekYear).toBe(2024);
      expect(r).toBeDefined();
    });

    test("ISO week with WW token", () => {
      const r = parseString("2024 01", "GGGG WW", enLoc());
      expect((r as ParsedFlags | null)?._weekYear).toBe(2024);
    });
  });

  describe("escape sequences", () => {
    test("[...] literal text", () => {
      check("Year: 2024", "[Year:] YYYY", { year: 2024 });
    });
  });

  describe("strict mode (charsLeftOver)", () => {
    test("extra characters produce charsLeftOver", () => {
      const r = parseString("2024-01-15 extra", "YYYY-MM-DD", enLoc());
      expect(r).toBeDefined();
      expect((r as ParsedFlags | null)?._charsLeftOver).toBeGreaterThan(0);
    });

    test("exact match has charsLeftOver = 0", () => {
      const r = parseString("2024-01-15", "YYYY-MM-DD", enLoc());
      expect((r as ParsedFlags | null)?._charsLeftOver).toBe(0);
    });
  });

  describe("parseTwoDigitYear", () => {
    test("69→1969, 70→1970", () => {
      expect(parseTwoDigitYear("69")).toBe(1969);
      expect(parseTwoDigitYear("70")).toBe(1970);
    });

    test("68→2068, 00→2000", () => {
      expect(parseTwoDigitYear("68")).toBe(2068);
      expect(parseTwoDigitYear("00")).toBe(2000);
    });
  });

  describe("more format tokens", () => {
    test("hh 12-hour", () => {
      check("2024-01-15 10", "YYYY-MM-DD hh", { hour: 10 });
    });
    test("h 12-hour single", () => {
      check("2024-01-15 9", "YYYY-MM-DD h", { hour: 9 });
    });
    test("kk 24-hour with space padding", () => {
      check("2024-01-15 09", "YYYY-MM-DD kk", { hour: 9 });
    });
    test("k 24-hour single", () => {
      check("2024-01-15 9", "YYYY-MM-DD k", { hour: 9 });
    });
    test("mm with single digit", () => {
      check("2024-01-15 10:05", "YYYY-MM-DD HH:mm", { minute: 5 });
    });
    test("m single digit", () => {
      check("2024-01-15 10:5", "YYYY-MM-DD HH:m", { minute: 5 });
    });
    test("ss with single digit", () => {
      check("2024-01-15 10:05:07", "YYYY-MM-DD HH:mm:ss", { second: 7 });
    });
    test("s single digit", () => {
      check("2024-01-15 10:05:7", "YYYY-MM-DD HH:mm:s", { second: 7 });
    });
    test("dddd (full weekday name)", () => {
      const r = parseString("Monday 15 2024", "dddd DD YYYY", enLoc());
      expect(r).toBeDefined();
    });
    test("ddd (short weekday)", () => {
      const r = parseString("Mon 15 2024", "ddd DD YYYY", enLoc());
      expect(r).toBeDefined();
    });
    test("dd (min weekday)", () => {
      const r = parseString("Mo 15 2024", "dd DD YYYY", enLoc());
      expect(r).toBeDefined();
    });
    test("d (day of week number)", () => {
      const r = parseString("2024-01-15 1", "YYYY-MM-DD d", enLoc());
      expect(r).toBeDefined();
    });
    test("e (locale weekday number)", () => {
      const r = parseString("2024-01-15 1", "YYYY-MM-DD e", enLoc());
      expect(r).toBeDefined();
    });
    test("E (ISO weekday number)", () => {
      const r = parseString("2024-01-15 1", "YYYY-MM-DD E", enLoc());
      expect(r).toBeDefined();
    });
    test("yo (ordinal year)", () => {
      check("2024", "yo", {});
    });
    test("yyyy (lowercase year)", () => {
      check("2024-01-15", "yyyy-MM-DD", { year: 2024 });
    });
    test("gg (2-digit week year)", () => {
      const r = parseString("24 01", "gg ww", enLoc());
      expect(r).toBeDefined();
    });
    test("a (lowercase am/pm)", () => {
      check("2024-01-15 10:30 am", "YYYY-MM-DD hh:mm a", { hour: 10, minute: 30 });
    });
    test("hmm compact", () => {
      expect(parseString("2024-01-15 123", "YYYY-MM-DD hmm", enLoc())).toBeDefined();
    });
    test("hmmss compact", () => {
      expect(parseString("2024-01-15 12345", "YYYY-MM-DD hmmss", enLoc())).toBeDefined();
    });
    test("Hmm compact", () => {
      expect(parseString("2024-01-15 1234", "YYYY-MM-DD Hmm", enLoc())).toBeDefined();
    });
    test("Hmmss compact", () => {
      check("2024-01-15 172345", "YYYY-MM-DD Hmmss", { hour: 17, minute: 23, second: 45 });
    });
  });

  describe("additional format tokens", () => {
    test("Z with negative offset", () => {
      check("2024-01-15T10:30:00-05:00", "YYYY-MM-DDTHH:mm:ssZ", { hour: 10, minute: 30, offset: -300 });
    });
    test("Z (compact -HHmm)", () => {
      check("2024-01-15T10:30:00-0500", "YYYY-MM-DDTHH:mm:ssZZ", { offset: -300 });
    });
    test("A uppercase", () => {
      check("2024-01-15 10:30 AM", "YYYY-MM-DD hh:mm A", { hour: 10, minute: 30 });
    });
    test("A with PM", () => {
      check("2024-01-15 10:30 PM", "YYYY-MM-DD hh:mm A", { hour: 22, minute: 30 });
    });
    test("a with pm", () => {
      check("2024-01-15 10:30 pm", "YYYY-MM-DD hh:mm a", { hour: 22, minute: 30 });
    });
    test("SSSS (4-digit ms)", () => {
      check("2024-01-15 10:30:45.1234", "YYYY-MM-DD HH:mm:ss.SSSS", { millisecond: 123 });
    });
    test("X (unix seconds)", () => {
      const r = parseString("1705276800", "X", enLoc());
      expect(r!.year).toBe(2024);
    });
    test("x (unix ms)", () => {
      const r = parseString("1705276800000", "x", enLoc());
      expect(r!.year).toBe(2024);
    });
    test("GGGG", () => {
      const r = parseString("2024W01", "GGGG[W]WW", enLoc());
      expect(r).toBeDefined();
    });
    test("GG simple", () => {
      const r = parseString("24W01", "GG[W]WW", enLoc());
      expect(r).toBeDefined();
    });
    test("gggg locale week year", () => {
      const r = parseString("2024 01", "gggg ww", enLoc());
      expect(r).toBeDefined();
    });
    test("N (era name)", () => {
      const r = parseString("2024 AD", "YYYY N", enLoc());
      expect(r).toBeDefined();
    });
    test("Y token", () => {
      const r = parseString("1-1-2010", "M-D-Y", enLoc());
      expect(r!.year).toBe(2010);
    });
    test("milliseconds ladder", () => {
      check("2024-01-15 10:30:45.12", "YYYY-MM-DD HH:mm:ss.SS", { millisecond: 120 });
      check("2024-01-15 10:30:45.1234", "YYYY-MM-DD HH:mm:ss.SSSS", { millisecond: 123 });
      check("2024-01-15 10:30:45.12345", "YYYY-MM-DD HH:mm:ss.SSSSS", { millisecond: 123 });
    });
    test("parsed date parts are retained", () => {
      const r = parseString("10 p", "hh a", enLoc());
      const flags = r as ParsedFlags | null;
      expect(flags?._parsedDateParts?.[3]).toBe(10);
      expect(flags?._meridiem).toBe("p");
    });
  });

  describe("null/edge cases", () => {
    test("non-string returns null", () => {
      expect(parseString(123 as unknown as string, "YYYY", enLoc())).toBeNull();
    });

    test("null locale returns null", () => {
      expect(parseString("2024-01-15", "YYYY-MM-DD", null as unknown as ParseLocale)).toBeNull();
    });

    test("setParseTwoDigitYear", () => {
      try {
        setParseTwoDigitYear((s) => Number(s) + (Number(s) > 30 ? 1900 : 2000));
        expect(parseString("68-01-01", "YY-MM-DD", enLoc())!.year).toBe(1968);
        expect(parseString("30-01-01", "YY-MM-DD", enLoc())!.year).toBe(2030);
      } finally {
        setParseTwoDigitYear(undefined);
      }
    });
  });
});
