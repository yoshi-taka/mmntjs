import { describe, test, expect } from "bun:test";
import {
  parseString,
  parseTwoDigitYear,
  setParseTwoDigitYear,
  enableCustomFormatParsing,
  isCustomFormatParsingEnabled,
  registerCustomFormatParser,
} from "../src/parse-lite-strict.ts";
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

  test("parses ISO with Z offset", () => {
    const result = parseString("2024-01-15T10:30:00Z", undefined, enLocale());
    expect(result).toEqual(expect.objectContaining({ offset: 0 }));
  });

  test("parses fractional seconds", () => {
    const result = parseString("2024-01-15T10:30:45.123", undefined, enLocale());
    expect(result).toEqual(expect.objectContaining({ hour: 10, minute: 30, second: 45, millisecond: 123 }));
  });

  test("parses comma fractional seconds", () => {
    const result = parseString("2024-01-15T10:30:45,123", undefined, enLocale());
    expect(result).toEqual(expect.objectContaining({ millisecond: 123 }));
  });

  test("parses signed year", () => {
    const result = parseString("+002024-01-15", undefined, enLocale());
    expect(result).toEqual(parsedYearMonthDay(2024, 1, 15));
  });

  test("parses negative year", () => {
    const result = parseString("-000001-01-01", undefined, enLocale());
    expect(result).toEqual(parsedYearMonthDay(-1, 1, 1));
  });

  test("ISO week date returns _claimed: true (not fully parsed in lite)", () => {
    const result = parseString("2024-W01-1", undefined, enLocale());
    expect(result).toEqual(expect.objectContaining({ _claimed: true }));
  });

  test("parses YYYY-MM only (no time)", () => {
    const result = parseString("2024-01", undefined, enLocale());
    expect(result).toEqual(expect.objectContaining({ year: 2024, month: 0 }));
  });

  test("parses YYYY only", () => {
    const result = parseString("2024", undefined, enLocale());
    expect(result).toEqual(expect.objectContaining({ year: 2024 }));
  });

  test("parses basic ISO with 6-digit year", () => {
    const result = parseString("+0020240115", undefined, enLocale());
    expect(result).toEqual(parsedYearMonthDay(2024, 1, 15));
  });

  test("mixed extended date + compact time returns null", () => {
    expect(parseString("2024-01-15 103045", undefined, enLocale())).toBeNull();
  });

  test("compact date + compact time works", () => {
    const result = parseString("20240115T103000", undefined, enLocale());
    expect(result).toEqual(expect.objectContaining({ year: 2024, month: 0, day: 15, hour: 10, minute: 30, second: 0 }));
  });

  test("parses offset in +HHMM format", () => {
    const result = parseString("2024-01-15T10:30:00+0530", undefined, enLocale());
    expect(result).toEqual(expect.objectContaining({ offset: 330 }));
  });

  test("parses offset in +HH:MM format", () => {
    const result = parseString("2024-01-15T10:30:00+05:30", undefined, enLocale());
    expect(result).toEqual(expect.objectContaining({ offset: 330 }));
  });

  test("returns null for unparseable string", () => {
    expect(parseString("not-a-date", undefined, enLocale())).toBeNull();
    expect(parseString("hello", undefined, enLocale())).toBeNull();
    expect(parseString("invalid", undefined, enLocale())).toBeNull();
  });

  test("returns null for badly formatted ISO", () => {
    expect(parseString("2024/01/15", undefined, enLocale())).toBeNull();
    expect(parseString("01-15-2024", undefined, enLocale())).toBeNull();
  });
  test("timezone without time returns null", () => {
    const result = parseString("0006W01Z", undefined, enLocale());
    expect(result).toBeNull();
  });

  test("skip time when format does not allow time", () => {
    const result = parseString("2024-W01", undefined, enLocale());
    expect(result).toEqual(expect.objectContaining({ _claimed: true }));
  });

  test("returns null when format specified but custom parsing disabled", () => {
    expect(parseString("2024-01-01", "YYYY-MM-DD", enLocale())).toBeNull();
  });

  test("custom format parsing", () => {
    enableCustomFormatParsing();
    registerCustomFormatParser(
      (str, fmt) => {
        if (fmt === "YYYY-MM-DD" && /^\d{4}-\d{2}-\d{2}$/.test(str)) {
          return { year: 2024, month: 0, day: 15, _unusedTokens: [], _unusedInput: [], _charsLeftOver: 0, _empty: false, _invalidMonth: null, _parsedDateParts: [] };
        }
        return null;
      },
      () => null,
    );
    const result = parseString("2024-01-15", "YYYY-MM-DD", enLocale());
    expect(result).toEqual(expect.objectContaining({ year: 2024, month: 0, day: 15 }));
    expect(isCustomFormatParsingEnabled()).toBe(true);
  });

  test("multiple formats with registered parser", () => {
    const result = parseString("2024-01-15", ["YYYY-MM-DD", "MM/DD/YYYY"], enLocale());
    expect(result).toBeNull();
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
  test("custom fn overrides", () => {
    setParseTwoDigitYear((s) => 2000 + parseInt(s, 10));
    setParseTwoDigitYear(undefined);
  });
});
