import { describe, test, expect } from "bun:test";
import {
  parseString,
  parseArray,
  parseObject,
  parseTwoDigitYear,
  setParseTwoDigitYear,
  enableCustomFormatParsing,
  isCustomFormatParsingEnabled,
  registerCustomFormatParser,
} from "../src/parse-lite.ts";
import type { ParseLocale } from "../src/parse-locale";

function enLocale(): ParseLocale {
  return { _config: {} } as unknown as ParseLocale;
}

function parsedYearMonthDay(y: number, m: number, d: number) {
  return expect.objectContaining({ year: y, month: m - 1, day: d });
}

describe("parseString", () => {
  test("returns null for non-string input", () => {
    expect(parseString(123 as unknown as string)).toBeNull();
    expect(parseString(null as unknown as string)).toBeNull();
    expect(parseString(undefined as unknown as string)).toBeNull();
  });

  test("returns null without locale", () => {
    expect(parseString("2024-01-01")).toBeNull();
  });

  test("parses YYYY-MM-DD", () => {
    const result = parseString("2024-01-15", undefined, enLocale());
    expect(result).toEqual(parsedYearMonthDay(2024, 1, 15));
  });

  test("parses YYYYMMDD", () => {
    const result = parseString("20240115", undefined, enLocale());
    expect(result).toEqual(parsedYearMonthDay(2024, 1, 15));
  });

  test("parses YYYY-DDD (ordinal date)", () => {
    const result = parseString("2024-032", undefined, enLocale());
    expect(result).toEqual(expect.objectContaining({ year: 2024, dayOfYear: 32 }));
  });

  test("parses YYYYDDD (ordinal date compact)", () => {
    const result = parseString("2024032", undefined, enLocale());
    expect(result).toEqual(expect.objectContaining({ year: 2024, dayOfYear: 32 }));
  });

  test("returns null for empty string after trim", () => {
    expect(parseString("   ", undefined, enLocale())).toBeNull();
  });

  test("parses ISO extended with time", () => {
    const result = parseString("2024-01-15T10:30:00", undefined, enLocale());
    expect(result).toEqual(expect.objectContaining({ year: 2024, month: 0, day: 15, hour: 10, minute: 30, second: 0 }));
  });

  test("parses ISO extended with time and timezone", () => {
    const result = parseString("2024-01-15T10:30:00+05:30", undefined, enLocale());
    expect(result).toEqual(expect.objectContaining({ year: 2024, month: 0, day: 15, hour: 10, minute: 30, second: 0, offset: 330 }));
  });

  test("parses ISO basic YYYYMMDDTHHmmss", () => {
    const result = parseString("20240115T103000", undefined, enLocale());
    expect(result).toEqual(expect.objectContaining({ year: 2024, month: 0, day: 15, hour: 10, minute: 30, second: 0 }));
  });

  test("parses ISO basic with offset", () => {
    const result = parseString("20240115T103000+0530", undefined, enLocale());
    expect(result).toEqual(expect.objectContaining({ offset: 330 }));
  });

  test("ISO week date returns claimed: true in lite parser", () => {
    const result = parseString("2024-W01-1", undefined, enLocale());
    expect(result).toEqual(expect.objectContaining({ _claimed: true }));
  });

  test("ISO week date compact returns claimed: true in lite parser", () => {
    const result = parseString("2024W011", undefined, enLocale());
    expect(result).toEqual(expect.objectContaining({ _claimed: true }));
  });

  test("parses ISO with Z offset", () => {
    const result = parseString("2024-01-15T10:30:00Z", undefined, enLocale());
    expect(result).toEqual(expect.objectContaining({ offset: 0 }));
  });

  test("JSON date format /Date(...)/", () => {
    const ts = Date.UTC(2024, 0, 15, 0, 30, 0);
    const result = parseString(`/Date(${ts})/`, undefined, enLocale());
    expect(result).toEqual(expect.objectContaining({
      year: 2024, month: 0, day: 15,
      hour: 0, minute: 30, second: 0,
      offset: 0,
    }));
  });

  test("JSON date format with offset", () => {
    const ts = Date.UTC(2024, 0, 15);
    const result = parseString(`/Date(${ts}+0530)/`, undefined, enLocale());
    expect(result).toEqual(expect.objectContaining({ year: 2024 }));
  });

  // RFC 2822
  test("parses RFC 2822 date", () => {
    const result = parseString("Mon, 15 Jan 2024 10:30:00 +0000", undefined, enLocale());
    expect(result).toEqual(expect.objectContaining({
      year: 2024, month: 0, day: 15,
      hour: 10, minute: 30, second: 0,
      offset: 0,
    }));
  });

  test("parses RFC 2822 without day name", () => {
    const result = parseString("15 Jan 2024 10:30:00 +0000", undefined, enLocale());
    expect(result).toEqual(expect.objectContaining({ year: 2024, month: 0, day: 15 }));
  });

  test("parses RFC 2822 with named timezone", () => {
    const result = parseString("15 Jan 2024 10:30:00 EST", undefined, enLocale());
    expect(result).toEqual(expect.objectContaining({ offset: -300 }));
  });

  test("parses RFC 2822 with 2-digit year (< 69 → 2000s)", () => {
    const result = parseString("15 Jan 24 10:30:00 +0000", undefined, enLocale());
    expect(result).toEqual(expect.objectContaining({ year: 2024 }));
  });

  test("parses RFC 2822 with 2-digit year (>= 69 → 1900s)", () => {
    const result = parseString("15 Jan 70 10:30:00 +0000", undefined, enLocale());
    expect(result).toEqual(expect.objectContaining({ year: 1970 }));
  });

  test("parses basic ISO with signed year", () => {
    const result = parseString("+002024-01-15", undefined, enLocale());
    expect(result).toEqual(parsedYearMonthDay(2024, 1, 15));
  });

  test("parses basic ISO with negative year", () => {
    const result = parseString("-000001-01-01", undefined, enLocale());
    expect(result).toEqual(parsedYearMonthDay(-1, 1, 1));
  });

  test("parses fractional seconds in time", () => {
    const result = parseString("2024-01-15T10:30:45.123", undefined, enLocale());
    expect(result).toEqual(expect.objectContaining({ hour: 10, minute: 30, second: 45, millisecond: 123 }));
  });

  test("returns null for unparseable string", () => {
    expect(parseString("not-a-date", undefined, enLocale())).toBeNull();
    expect(parseString("hello world", undefined, enLocale())).toBeNull();
  });

  test("returns null when format is specified but custom parsing is disabled", () => {
    expect(parseString("2024-01-01", "YYYY-MM-DD", enLocale())).toBeNull();
  });

  test("custom format parsing with registered parser", () => {
    enableCustomFormatParsing();
    registerCustomFormatParser(
      (str, fmt, _loc, _strict) => {
        if (fmt === "YYYY-MM-DD" && /^\d{4}-\d{2}-\d{2}$/.test(str)) {
          return { year: 2024, month: 0, day: 15, _unusedTokens: [], _unusedInput: [], _charsLeftOver: 0, _empty: false, _invalidMonth: null, _parsedDateParts: [] };
        }
        return null;
      },
      (_str, _fmts, _loc, _strict) => null,
    );
    const result = parseString("2024-01-15", "YYYY-MM-DD", enLocale());
    expect(result).toEqual(expect.objectContaining({ year: 2024, month: 0, day: 15 }));
    expect(isCustomFormatParsingEnabled()).toBe(true);
  });
});

describe("parseArray", () => {
  test("parses [year, month, day, ...]", () => {
    expect(parseArray([2024, 0, 15])).toEqual(expect.objectContaining({ year: 2024, month: 0, day: 15 }));
    expect(parseArray([2024, 0, 15, 10, 30, 45, 500])).toEqual(expect.objectContaining({ year: 2024, month: 0, day: 15, hour: 10, minute: 30, second: 45, millisecond: 500 }));
  });

  test("defaults month=0, day=1, time=0", () => {
    expect(parseArray([2024])).toEqual(expect.objectContaining({ year: 2024, month: 0, day: 1, hour: 0, minute: 0, second: 0, millisecond: 0 }));
  });

  test("returns null for empty array", () => {
    expect(parseArray([])).toBeNull();
  });

  test("returns null for array with null/undefined/NaN", () => {
    expect(parseArray([null])).toBeNull();
    expect(parseArray([undefined])).toBeNull();
    expect(parseArray([NaN])).toBeNull();
  });
});

describe("parseObject", () => {
  test("parses { year, month, day }", () => {
    expect(parseObject({ year: 2024, month: 0, day: 15 })).toEqual({ year: 2024, month: 0, day: 15 });
  });

  test("supports alias keys", () => {
    expect(parseObject({ y: 2024, M: 0, d: 15 })).toEqual({ year: 2024, month: 0, day: 15 });
    expect(parseObject({ years: 2024, months: 0, date: 15 })).toEqual({ year: 2024, month: 0, day: 15 });
    expect(parseObject({ hours: 10, minutes: 30, seconds: 45, ms: 500 })).toEqual({ hour: 10, minute: 30, second: 45, millisecond: 500 });
  });

  test("ignores null/undefined values", () => {
    expect(parseObject({ year: null })).toEqual({});
    expect(parseObject({ year: 2024, month: undefined })).toEqual({ year: 2024 });
  });

  test("prefers longer alias names", () => {
    const result = parseObject({ year: 2024, y: 2023 });
    expect(result.year).toBe(2024);
  });
});

describe("parseTwoDigitYear", () => {
  test("69 → 1969, 70 → 1970", () => {
    expect(parseTwoDigitYear("69")).toBe(1969);
    expect(parseTwoDigitYear("70")).toBe(1970);
  });

  test("68 → 2068, 00 → 2000", () => {
    expect(parseTwoDigitYear("68")).toBe(2068);
    expect(parseTwoDigitYear("00")).toBe(2000);
  });
});

describe("setParseTwoDigitYear", () => {
  test("custom fn overrides default two-digit year parsing", () => {
    setParseTwoDigitYear((s) => 2000 + parseInt(s, 10));
    expect(setParseTwoDigitYear).toBeDefined();
    setParseTwoDigitYear(undefined);
  });
});
