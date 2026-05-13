import { describe, test, expect } from "bun:test";
import { parseString, parseArray, parseObject, parseTwoDigitYear, setParseTwoDigitYear } from "../src/parse";
import { getLocale } from "../src/locale";
import type { ParseLocale } from "../src/parse-locale";

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

function check(input: string, fmt: string, exp: ParsedExpectation, strict?: boolean) {
  const result = parseString(input, fmt, enLoc(), strict);
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

describe("parseMain parseString", () => {
  describe("basic date tokens", () => {
    test("YYYY-MM-DD", () => {
      check("2024-01-15", "YYYY-MM-DD", { year: 2024, month: 0, day: 15 });
    });
    test("DD/MM/YYYY", () => {
      check("15/01/2024", "DD/MM/YYYY", { year: 2024, month: 0, day: 15 });
    });
    test("MM-DD-YYYY", () => {
      check("01-15-2024", "MM-DD-YYYY", { year: 2024, month: 0, day: 15 });
    });
    test("M/D/YYYY (single digit)", () => {
      check("1/5/2024", "M/D/YYYY", { year: 2024, month: 0, day: 5 });
    });
    test("YYYY-M-D (single digit)", () => {
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
    test("SSS ms", () => {
      check("2024-01-15 10:30:45.123", "YYYY-MM-DD HH:mm:ss.SSS", { millisecond: 123 });
    });
    test("S ms (1 digit)", () => {
      check("2024-01-15 10:30:45.1", "YYYY-MM-DD HH:mm:ss.S", { millisecond: 100 });
    });
    test("k (24-hour with leading space)", () => {
      check("2024-01-15  9", "YYYY-MM-DD  k", { hour: 9 });
    });
    test("kk (24-hour 2-digit)", () => {
      check("2024-01-15 09", "YYYY-MM-DD kk", { hour: 9 });
    });
  });

  describe("timezone tokens", () => {
    test("Z (+HH:mm)", () => {
      check("2024-01-15T10:30:00+05:30", "YYYY-MM-DDTHH:mm:ssZ", { offset: 330 });
    });
    test("ZZ (+HHmm)", () => {
      check("2024-01-15T10:30:00+0530", "YYYY-MM-DDTHH:mm:ssZZ", { offset: 330 });
    });
    test("Z (UTC)", () => {
      check("2024-01-15T10:30:00Z", "YYYY-MM-DDTHH:mm:ssZ", { offset: 0 });
    });
    test("Z with negative offset", () => {
      check("2024-01-15T10:30:00-05:00", "YYYY-MM-DDTHH:mm:ssZ", { offset: -300 });
    });
    test("ZZ without colon", () => {
      check("2024-01-15 10:30:00-0500", "YYYY-MM-DD HH:mm:ssZZ", { offset: -300 });
    });
  });

  describe("month name tokens", () => {
    test("MMMM", () => {
      check("January 15 2024", "MMMM DD YYYY", { year: 2024, month: 0, day: 15 });
    });
    test("MMM", () => {
      check("Jan 15 2024", "MMM DD YYYY", { year: 2024, month: 0, day: 15 });
    });
    test("MMMM lowercase", () => {
      check("january 15 2024", "MMMM DD YYYY", { year: 2024, month: 0, day: 15 });
    });
    test("MMM lowercase", () => {
      check("jan 15 2024", "MMM DD YYYY", { year: 2024, month: 0, day: 15 });
    });
  });

  describe("ordinal tokens", () => {
    test("Do", () => {
      check("Jan 15th 2024", "MMM Do YYYY", { year: 2024, month: 0, day: 15 });
    });
    test("Do 1st/2nd/3rd", () => {
      check("Jan 1st 2024", "MMM Do YYYY", { year: 2024, month: 0, day: 1 });
    });
  });

  describe("year variant tokens", () => {
    test("YY", () => {
      const r1 = parseString("24-01-15", "YY-MM-DD", enLoc());
      expect(r1!.year).toBe(2024);
      const r2 = parseString("70-01-15", "YY-MM-DD", enLoc());
      expect(r2!.year).toBe(1970);
    });
    test("YYYYYY signed", () => {
      check("+002024", "YYYYYY", { year: 2024 });
    });
    test("YYYYYY negative", () => {
      const r = parseString("-000001", "YYYYYY", enLoc());
      expect(r!.year).toBe(-1);
    });
    test("YYYYY (5-digit)", () => {
      const r = parseString("2024", "YYYYY", enLoc());
      expect(r).toBeDefined();
    });
    test("Y (variable year)", () => {
      check("2024", "Y", { year: 2024 });
    });
    test("gggg (locale week year)", () => {
      const r = parseString("2024 01", "gggg ww", enLoc());
      expect(r).toBeDefined();
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
    test("X (fractional seconds)", () => {
      const r = parseString("1705276800.5", "X", enLoc());
      expect(r!.year).toBe(2024);
    });
  });

  describe("day of year", () => {
    test("DDDD (3-digit)", () => {
      const r = parseString("2024-032", "YYYY-DDDD", enLoc());
      expect(r!.dayOfYear).toBe(32);
    });
    test("DDD (3-digit)", () => {
      const r = parseString("2024-032", "YYYY-DDD", enLoc());
      expect(r!.dayOfYear).toBe(32);
    });
    test("DDDD padded", () => {
      const r = parseString("2024-366", "YYYY-DDDD", enLoc());
      expect(r!.dayOfYear).toBe(366);
    });
  });

  describe("ISO week tokens", () => {
    test("GGGG WW with literal W", () => {
      const r = parseString("2024-W01", "GGGG-[W]WW", enLoc());
      expect(r).toBeDefined();
    });
    test("GGGG[W]WWE (compact)", () => {
      const r = parseString("2024W011", "GGGG[W]WWE", enLoc());
      expect(r).toBeDefined();
    });
    test("GG (2-digit ISO week year)", () => {
      const r = parseString("24W01", "GG[W]WW", enLoc());
      expect(r).toBeDefined();
    });
  });

  describe("era name tokens (N)", () => {
    test("N (abbreviated era)", () => {
      const r = parseString("AD 2024", "N YYYY");
      expect(r).toBeDefined();
    });
    test("NNNNN (narrow era)", () => {
      const r = parseString("A 2024", "NNNNN YYYY");
      expect(r).toBeDefined();
    });
  });

  describe("compact time tokens", () => {
    test("hmm", () => {
      const r = parseString("2024-01-15 1030", "YYYY-MM-DD hmm");
      expect(r).toBeDefined();
    });
    test("hmmss", () => {
      const r = parseString("2024-01-15 103045", "YYYY-MM-DD hmmss");
      expect(r).toBeDefined();
    });
    test("Hmm", () => {
      const r = parseString("2024-01-15 2230", "YYYY-MM-DD Hmm");
      expect(r).toBeDefined();
    });
  });

  describe("weekday number tokens", () => {
    test("e (locale day of week)", () => {
      const r = parseString("2024-01-15 1", "YYYY-MM-DD e");
      expect(r).toBeDefined();
    });
    test("E (ISO day of week)", () => {
      const r = parseString("2024-W01-1", "GGGG-[W]WW-E");
      expect(r).toBeDefined();
    });
  });

  describe("escape sequences", () => {
    test("[...] literal", () => {
      check("Year: 2024", "[Year:] YYYY", { year: 2024 });
    });
    test("multiple escape groups", () => {
      check("Q1 2024", "[Q]Q YYYY", { year: 2024 });
    });
  });

  describe("strict mode (flags returned, enforcement by caller)", () => {
    test("extra chars produce unusedInput", () => {
      const r = parseString("2024-01-15 extra", "YYYY-MM-DD", enLoc(), true);
      expect(r).toBeDefined();
      expect(r!._charsLeftOver).toBe(6);
    });
    test("valid strict has no leftovers", () => {
      const r = parseString("2024-01-15", "YYYY-MM-DD", enLoc(), true);
      expect(r!._charsLeftOver).toBe(0);
    });
    test("non-strict allows extra", () => {
      const r = parseString("2024-01-15 extra", "YYYY-MM-DD", enLoc(), false);
      expect(r).toBeDefined();
    });
  });

  describe("multiple formats", () => {
    test("picks first matching", () => {
      const r = parseString("2024-01-15", ["MM-DD-YYYY", "YYYY-MM-DD"], enLoc(), true);
      expect(r!.year).toBe(2024);
    });
    test("no exact match returns best effort in non-strict", () => {
      const r = parseString("2024-01-15", ["MM/DD/YYYY", "DD/MM/YYYY"], enLoc(), false);
      expect(r).toBeDefined();
    });
  });

  describe("additional token handlers", () => {
    test("hmm compact", () => {
      check("2024-01-15 1030", "YYYY-MM-DD hmm", { hour: 10, minute: 30 });
    });
    test("hmmss compact", () => {
      check("2024-01-15 103045", "YYYY-MM-DD hmmss", { hour: 10, minute: 30, second: 45 });
    });
    test("Hmm compact 24h", () => {
      const r = parseString("2024-01-15 2230", "YYYY-MM-DD Hmm", enLoc());
      expect(r).toBeDefined();
    });
    test("Hmmss compact 24h", () => {
      const r = parseString("2024-01-15 223045", "YYYY-MM-DD Hmmss", enLoc());
      expect(r).toBeDefined();
    });
    test("yo (ordinal year)", () => {
      const r = parseString("2024th", "yo", enLoc());
      expect(r).toBeDefined();
    });
    test("era year y", () => {
      const r = parseString("2024", "y", enLoc());
      expect(r).toBeDefined();
    });
    test("era year yy", () => {
      const r = parseString("24", "yy", enLoc());
      expect(r).toBeDefined();
    });
    test("Q quarter", () => {
      const r = parseString("2024 1", "YYYY Q", enLoc());
      expect(r).toBeDefined();
    });
    test("wo (ordinal week)", () => {
      const r = parseString("2024 1st", "GGGG wo", enLoc());
      expect(r).toBeDefined();
    });
  });

  describe("edge cases", () => {
    test("non-string returns null", () => {
      expect(parseString(123 as unknown as string, "YYYY", enLoc())).toBeNull();
    });
    test("null locale returns null", () => {
      expect(parseString("2024-01-15", "YYYY-MM-DD", null as unknown as ParseLocale)).toBeNull();
    });
    test("empty string with format returns result with _empty", () => {
      const r = parseString("", "YYYY", enLoc());
      expect(r).toBeDefined();
      expect(r!._empty).toBe(true);
    });
  });
});

describe("parseString ISO auto-detection (no format)", () => {
  test("YYYY-MM-DD auto", () => {
    const r = parseString("2024-01-15", undefined, enLoc());
    expect(r).toBeDefined();
  });
  test("ISO with time auto", () => {
    const r = parseString("2024-01-15T10:30:00", undefined, enLoc());
    expect(r).toBeDefined();
  });
  test("ISO with offset auto", () => {
    const r = parseString("2024-01-15T10:30:00+05:30", undefined, enLoc());
    expect(r!.offset).toBe(330);
  });
  test("ISO week date auto", () => {
    const r = parseString("2024-W01", undefined, enLoc());
    expect(r).toBeDefined();
  });
  test("ISO basic format auto", () => {
    const r = parseString("20240115T103000", undefined, enLoc());
    expect(r).toBeDefined();
  });
  test("RFC 2822 auto", () => {
    const r = parseString("15 Jan 2024 10:30:00 +0000", undefined, enLoc());
    expect(r).toBeDefined();
  });
  test("RFC 2822 with comments auto", () => {
    const r = parseString("(Init Comment) Tue,\n 1 Nov              2016 (Split\n Comment)  07:23:45 +0000 (GMT)", undefined, enLoc());
    expect(r).toBeDefined();
    expect(r!.year).toBe(2016);
    expect(r!.month).toBe(10);
    expect(r!.day).toBe(1);
  });
  test("RFC 2822 with named timezone auto", () => {
    const r = parseString("15 Jan 2024 10:30:00 EST", undefined, enLoc());
    expect(r).toBeDefined();
    expect(r!.offset).toBe(-300);
  });
  test("JSON date auto", () => {
    const ts = Date.UTC(2024, 0, 15, 0, 30, 0);
    const r = parseString(`/Date(${ts})/`, undefined, enLoc());
    expect(r).toBeDefined();
    expect(r!.year).toBe(2024);
    expect(r!.hour).toBe(0);
    expect(r!.minute).toBe(30);
  });
  test("JSON date auto with offset suffix", () => {
    const ts = Date.UTC(2024, 0, 15);
    const r = parseString(`/Date(${ts}+0530)/`, undefined, enLoc());
    expect(r).toBeDefined();
    expect(r!.year).toBe(2024);
  });
  test("signed ISO auto", () => {
    const r = parseString("+002024-01-15", undefined, enLoc());
    expect(r).toBeDefined();
    expect(r!.year).toBe(2024);
  });
  test("basic ISO auto with offset", () => {
    const r = parseString("20240115T103000+0530", undefined, enLoc());
    expect(r).toBeDefined();
    expect(r!.offset).toBe(330);
  });
  test("invalid string auto returns null", () => {
    expect(parseString("not-a-date", undefined, enLoc())).toBeNull();
  });
  test("empty string auto returns null", () => {
    expect(parseString("", undefined, enLoc())).toBeNull();
  });
});

describe("parseArray", () => {
  test("parses [year, month, day]", () => {
    const r = parseArray([2024, 0, 15]);
    expect(r!.year).toBe(2024);
    expect(r!.month).toBe(0);
    expect(r!.day).toBe(15);
  });
  test("defaults", () => {
    const r = parseArray([2024]);
    expect(r!.month).toBe(0);
    expect(r!.day).toBe(1);
    expect(r!.hour).toBe(0);
  });
  test("all fields", () => {
    const r = parseArray([2024, 0, 15, 10, 30, 45, 500]);
    expect(r!.hour).toBe(10);
    expect(r!.minute).toBe(30);
    expect(r!.second).toBe(45);
    expect(r!.millisecond).toBe(500);
  });
  test("string arrays are parsed", () => {
    const r = parseArray(["2014", "7", "31"]);
    expect(r).toEqual(expect.objectContaining({ year: 2014, month: 7, day: 31 }));
  });
  test("out-of-range year uses constructor", () => {
    const r = parseArray([10000, 0, 1]);
    expect(r).toEqual(expect.objectContaining({ year: 10000, month: 0, day: 1, _useConstructor: true }));
  });
  test("empty array returns null", () => {
    expect(parseArray([])).toBeNull();
  });
  test("null/undefined/NaN returns null", () => {
    expect(parseArray([null])).toBeNull();
    expect(parseArray([NaN])).toBeNull();
  });
});

describe("parseObject", () => {
  test("basic fields", () => {
    expect(parseObject({ year: 2024, month: 0, day: 15 })).toEqual({ year: 2024, month: 0, day: 15 });
  });
  test("aliases", () => {
    expect(parseObject({ y: 2024, M: 0, d: 15 })).toEqual({ year: 2024, month: 0, day: 15 });
  });
  test("date alias", () => {
    expect(parseObject({ year: 2024, month: 0, date: 15 })).toEqual({ year: 2024, month: 0, day: 15 });
  });
  test("string values are coerced", () => {
    expect(parseObject({ years: "2014", months: "7", date: "31" })).toEqual({ year: 2014, month: 7, day: 31 });
  });
  test("null value ignored", () => {
    expect(parseObject({ year: null })).toEqual({});
  });
  test("all time fields", () => {
    expect(parseObject({ hour: 10, minute: 30, second: 45, millisecond: 500 })).toEqual({ hour: 10, minute: 30, second: 45, millisecond: 500 });
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
  test("customized parseTwoDigitYear can be installed", () => {
    try {
      setParseTwoDigitYear((input) => Number(input) + (Number(input) > 30 ? 1900 : 2000));
      expect(parseString("68-01-01", "YY-MM-DD", enLoc())!.year).toBe(1968);
      expect(parseString("30-01-01", "YY-MM-DD", enLoc())!.year).toBe(2030);
    } finally {
      setParseTwoDigitYear(undefined);
    }
  });
});
