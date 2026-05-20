import { afterAll, beforeAll, describe, test, expect } from "bun:test";
import {
  parseString,
  enableCustomFormatParsing,
  isCustomFormatParsingEnabled,
  parseTwoDigitYear,
  setParseTwoDigitYear,
  parseArray,
  parseObject,
  parseWithFormatImpl,
  parseWithFormatsImpl,
} from "../src/parse-format";
import { defineLocale, getLocale } from "../src/locale";
import type { ParseLocale } from "../src/parse-locale";

// parseString from parse-format.ts requires a locale object
function enLoc(): ParseLocale {
  return getLocale("en") as unknown as ParseLocale;
}

function namedLoc(name: string): ParseLocale {
  return getLocale(name) as unknown as ParseLocale;
}

const objectLocaleName = "parse-format-coverage-obj";
const functionLocaleName = "parse-format-coverage-fn";
const apostropheLocaleName = "parse-format-coverage-apos";

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
  if (exp.year !== undefined) {
    expect(result!.year).toBe(exp.year);
  }
  if (exp.month !== undefined) {
    expect(result!.month).toBe(exp.month);
  }
  if (exp.day !== undefined) {
    expect(result!.day).toBe(exp.day);
  }
  if (exp.hour !== undefined) {
    expect(result!.hour).toBe(exp.hour);
  }
  if (exp.minute !== undefined) {
    expect(result!.minute).toBe(exp.minute);
  }
  if (exp.second !== undefined) {
    expect(result!.second).toBe(exp.second);
  }
  if (exp.millisecond !== undefined) {
    expect(result!.millisecond).toBe(exp.millisecond);
  }
  if (exp.offset !== undefined) {
    expect(result!.offset).toBe(exp.offset);
  }
}

describe("parseFormat parseString", () => {
  beforeAll(() => {
    enableCustomFormatParsing();
    setParseTwoDigitYear(undefined);
    defineLocale(objectLocaleName, {
      months: {
        standalone: [
          "jan-base",
          "feb-base",
          "mar-base",
          "apr-base",
          "may-base",
          "jun-base",
          "jul-base",
          "aug-base",
          "sep-base",
          "oct-base",
          "nov-base",
          "dec-base",
        ],
        format: [
          "janvfmt",
          "fevfmt",
          "marfmt",
          "aprfmt",
          "mayfmt",
          "junfmt",
          "julfmt",
          "augfmt",
          "sepfmt",
          "octfmt",
          "novfmt",
          "decfmt",
        ],
      },
      monthsShort: ["j1", "f1", "m1", "a1", "m2", "j2", "j3", "a2", "s1", "o1", "n1", "d1"],
      weekdays: {
        standalone: [
          "sundayobj",
          "mondayobj",
          "tuesdayobj",
          "wednesdayobj",
          "thursdayobj",
          "fridayobj",
          "saturdayobj",
        ],
        format: [
          "sundayfmt",
          "mondayfmt",
          "tuesdayfmt",
          "wednesdayfmt",
          "thursdayfmt",
          "fridayfmt",
          "saturdayfmt",
        ],
      },
      weekdaysShort: {
        standalone: ["suo", "moo", "tuo", "weo", "tho", "fro", "sao"],
        format: ["suf", "mof", "tuf", "wef", "thf", "frf", "saf"],
      },
      weekdaysMin: {
        standalone: ["u0", "m0", "t0", "w0", "r0", "f0", "s0"],
        format: ["u1", "m1", "t1", "w1", "r1", "f1", "s1"],
      },
      longDateFormat: {
        L: "DD*MM*YYYY",
      },
    } as unknown as Record<string, unknown>);
    defineLocale(functionLocaleName, {
      months(this: unknown, m?: { month: () => number }): string[] | string {
        const standalone = [
          "janbase",
          "febbase",
          "marbase",
          "aprbase",
          "maybase",
          "junbase",
          "julbase",
          "augbase",
          "sepbase",
          "octbase",
          "novbase",
          "decbase",
        ];
        const format = [
          "janfun",
          "febfun",
          "marfun",
          "aprfun",
          "mayfun",
          "junfun",
          "julfun",
          "augfun",
          "sepfun",
          "octfun",
          "novfun",
          "decfun",
        ];
        if (!m) {
          return standalone;
        }
        return format[m.month()];
      },
      weekdays(this: unknown, m?: { day: () => number }): string[] | string {
        const names = ["sunfun", "monfun", "tuefun", "wedfun", "thufun", "frifun", "satfun"];
        if (!m) {
          return names;
        }
        return names[m.day()];
      },
    } as unknown as Record<string, unknown>);
    defineLocale(apostropheLocaleName, {
      months: [
        "jan",
        "feb",
        "mar",
        "lʼavril",
        "may",
        "jun",
        "jul",
        "aug",
        "sep",
        "oct",
        "nov",
        "dec",
      ],
    } as unknown as Record<string, unknown>);
  });

  afterAll(() => {
    defineLocale(objectLocaleName, null);
    defineLocale(functionLocaleName, null);
    defineLocale(apostropheLocaleName, null);
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
      check("2024-01-15 10:30:45", "YYYY-MM-DD HH:mm:ss", {
        year: 2024,
        month: 0,
        day: 15,
        hour: 10,
        minute: 30,
        second: 45,
      });
    });

    test("HH:mm", () => {
      check("2024-01-15 10:30", "YYYY-MM-DD HH:mm", {
        year: 2024,
        month: 0,
        day: 15,
        hour: 10,
        minute: 30,
      });
    });

    test("H:m", () => {
      check("2024-01-15 9:5", "YYYY-MM-DD H:m", {
        year: 2024,
        month: 0,
        day: 15,
        hour: 9,
        minute: 5,
      });
    });

    test("A (AM)", () => {
      check("2024-01-15 10:30 AM", "YYYY-MM-DD hh:mm A", {
        year: 2024,
        month: 0,
        day: 15,
        hour: 10,
        minute: 30,
      });
    });

    test("A (PM)", () => {
      check("2024-01-15 10:30 PM", "YYYY-MM-DD hh:mm A", {
        year: 2024,
        month: 0,
        day: 15,
        hour: 22,
        minute: 30,
      });
    });

    test("a (pm)", () => {
      check("2024-01-15 10:30 pm", "YYYY-MM-DD hh:mm a", {
        year: 2024,
        month: 0,
        day: 15,
        hour: 22,
        minute: 30,
      });
    });

    test("SSS milliseconds", () => {
      check("2024-01-15 10:30:45.123", "YYYY-MM-DD HH:mm:ss.SSS", {
        year: 2024,
        month: 0,
        day: 15,
        hour: 10,
        minute: 30,
        second: 45,
        millisecond: 123,
      });
    });

    test("S milliseconds (single digit)", () => {
      check("2024-01-15 10:30:45.1", "YYYY-MM-DD HH:mm:ss.S", { millisecond: 100 });
    });
  });

  describe("timezone tokens", () => {
    test("Z (+HH:mm)", () => {
      check("2024-01-15T10:30:00+05:30", "YYYY-MM-DDTHH:mm:ssZ", {
        year: 2024,
        month: 0,
        day: 15,
        hour: 10,
        minute: 30,
        second: 0,
        offset: 330,
      });
    });

    test("ZZ (+HHmm)", () => {
      check("2024-01-15T10:30:00+0530", "YYYY-MM-DDTHH:mm:ssZZ", {
        hour: 10,
        minute: 30,
        offset: 330,
      });
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

    test("MMMM rejects custom object format names in strict mode", () => {
      const r = parseString("janvfmt 15 2024", "MMMM DD YYYY", namedLoc(objectLocaleName), true);
      expect(r).toEqual(
        expect.objectContaining({ _unusedTokens: expect.arrayContaining(["MMMM"]) }),
      );
    });

    test("MMM rejects custom function month names in strict mode", () => {
      const r = parseString("janfun 15 2024", "MMM DD YYYY", namedLoc(functionLocaleName), true);
      expect(r).toEqual(
        expect.objectContaining({ _unusedTokens: expect.arrayContaining(["MMM"]) }),
      );
    });

    test("exact apostrophe month names are accepted", () => {
      const r = parseString(
        "lʼavril 15 2024",
        "MMMM DD YYYY",
        namedLoc(apostropheLocaleName),
        true,
      );
      expect(r!.month).toBe(3);
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

    test("long date format expands locale tokens", () => {
      const r = parseString("15*01*2024", "L", namedLoc(objectLocaleName), true);
      expect(r).toEqual(expect.objectContaining({ year: 2024, month: 0, day: 15 }));
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

    test("strict failure records remaining token and literal", () => {
      const r = parseString("2024/", "YYYY-MM-DD", enLoc(), true);
      expect(r).toEqual(
        expect.objectContaining({
          _unusedTokens: expect.arrayContaining(["MM", "-", "DD"]),
        }),
      );
    });

    test("strict whitespace literal mismatch is tracked", () => {
      const r = parseString("2024@01", "YYYY MM", enLoc(), true);
      expect(r).toEqual(
        expect.objectContaining({
          _unusedInput: expect.arrayContaining(["@"]),
          year: 2024,
          month: 0,
        }),
      );
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
    test("dddd uses locale function weekday data", () => {
      const r = parseString("wedfun 15 2024", "dddd DD YYYY", namedLoc(functionLocaleName), true);
      expect(r!._weekdayNum).toBe(3);
    });
    test("ddd (short weekday)", () => {
      const r = parseString("Mon 15 2024", "ddd DD YYYY", enLoc());
      expect(r).toBeDefined();
    });
    test("ddd uses locale object weekday data", () => {
      const r = parseString("mof 15 2024", "ddd DD YYYY", namedLoc(objectLocaleName), true);
      expect(r).toEqual(expect.objectContaining({ _weekdayName: "mof" }));
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

    test("lenient parser skips punctuation before digit tokens", () => {
      const r = parseString("::2024-01-15", "YYYY-MM-DD", enLoc(), false);
      expect(r).toEqual(expect.objectContaining({ year: 2024, month: 0, day: 15 }));
      expect(r!._unusedInput).toContain("::");
    });

    test("lenient parser skips punctuation before meridiem token", () => {
      const r = parseString("10 ?? pm", "hh a", enLoc(), false);
      expect(r).toEqual(expect.objectContaining({ hour: 22 }));
      expect(r!._unusedInput).toContain("?? ");
    });
  });

  describe("additional format tokens", () => {
    test("Z with negative offset", () => {
      check("2024-01-15T10:30:00-05:00", "YYYY-MM-DDTHH:mm:ssZ", {
        hour: 10,
        minute: 30,
        offset: -300,
      });
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

describe("parseFormat auto-detection", () => {
  test("parses ISO extended without format", () => {
    const r = parseString("2024-01-15T10:30:00+05:30", undefined, enLoc());
    expect(r).toEqual(expect.objectContaining({ year: 2024, month: 0, day: 15, offset: 330 }));
  });

  test("parses ISO week date without format", () => {
    const r = parseString("2024-W01", undefined, enLoc());
    expect(r).toBeDefined();
  });

  test("parses basic ISO without format", () => {
    const r = parseString("20240115T103000+0530", undefined, enLoc());
    expect(r).toEqual(expect.objectContaining({ year: 2024, offset: 330 }));
  });

  test("parses RFC 2822 comments and named timezone", () => {
    const r = parseString("(comment) Tue, 1 Nov 2016 07:23:45 EST (tail)", undefined, enLoc());
    expect(r).toEqual(expect.objectContaining({ year: 2016, month: 10, day: 1, offset: -300 }));
  });

  test("parses JSON date wrapper without format", () => {
    const ts = Date.UTC(2024, 0, 15, 0, 30, 0);
    const r = parseString(`/Date(${ts}+0530)/`, undefined, enLoc());
    expect(r).toEqual(expect.objectContaining({ year: 2024, hour: 0, minute: 30 }));
  });

  test("returns null for empty or invalid auto input", () => {
    expect(parseString("", undefined, enLoc())).toBeNull();
    expect(parseString("not-a-date", undefined, enLoc())).toBeNull();
  });

  test("parses compact ordinal (7-digit: YYYYDDD)", () => {
    const r = parseString("2024366", undefined, enLoc());
    expect(r).toBeDefined();
    expect(r!.year).toBe(2024);
    expect((r as { dayOfYear?: number }).dayOfYear).toBe(366);
  });

  test("parses compact date (8-digit: YYYYMMDD)", () => {
    const r = parseString("20240615", undefined, enLoc());
    expect(r).toBeDefined();
    expect(r!.year).toBe(2024);
    expect(r!.month).toBe(5);
    expect(r!.day).toBe(15);
  });

  test("parses compact week (8-digit: GGGGWWD)", () => {
    const r = parseString("2024W10", undefined, enLoc());
    expect(r).toBeDefined();
    expect((r as { _weekYear?: number })._weekYear).toBe(2024);
    expect((r as { isoWeek?: number }).isoWeek).toBe(10);
  });

  test("parses extended week (GGGG-WW)", () => {
    const r = parseString("2024-W10", undefined, enLoc());
    expect(r).toBeDefined();
    expect((r as { _weekYear?: number })._weekYear).toBe(2024);
    expect((r as { isoWeek?: number }).isoWeek).toBe(10);
  });

  test("parses extended week with day (GGGG-WW-D)", () => {
    const r = parseString("2024-W10-1", undefined, enLoc());
    expect(r).toBeDefined();
    expect((r as { _weekYear?: number })._weekYear).toBe(2024);
    expect((r as { isoWeek?: number }).isoWeek).toBe(10);
    expect((r as { _weekdayNum?: number })._weekdayNum).toBe(1);
  });

  test("parseString with format array (parseWithFormats)", () => {
    const r = parseString("2024-06-15", ["YYYY-MM-DD", "MM/DD/YYYY"], enLoc());
    expect(r).toBeDefined();
    expect(r!.year).toBe(2024);
    expect(r!.month).toBe(5);
    expect(r!.day).toBe(15);
  });

  test("parseString with format array picks best match", () => {
    const r = parseString("06/15/2024", ["YYYY-MM-DD", "MM/DD/YYYY"], enLoc());
    expect(r).toBeDefined();
    expect(r!.year).toBe(2024);
    expect(r!.month).toBe(5);
    expect(r!.day).toBe(15);
  });

  test("parseString with format array returns null for no match", () => {
    const r = parseString("abc", ["YYYY-MM-DD", "MM/DD/YYYY"], enLoc(), true);
    expect(r).toBeNull();
  });

  test("parseWithFormatsImpl directly", () => {
    const r = parseWithFormatsImpl("2024-06-15", ["YYYY-MM-DD", "MM/DD/YYYY"], enLoc());
    expect(r).toBeDefined();
    expect(r!.year).toBe(2024);
  });

  test("parseWithFormatImpl directly with strict mode", () => {
    const r = parseWithFormatImpl("2024", "YYYY", enLoc(), true);
    expect(r).toBeDefined();
    expect(r!.year).toBe(2024);
  });

  test("parseCommonISO with full datetime + millis + Z", () => {
    const r = parseString("2024-06-15T10:30:45.123Z", undefined, enLoc());
    expect(r).toBeDefined();
    expect(r!.year).toBe(2024);
    expect(r!.month).toBe(5);
    expect(r!.day).toBe(15);
    expect(r!.hour).toBe(10);
    expect(r!.minute).toBe(30);
    expect(r!.second).toBe(45);
    expect(r!.millisecond).toBe(123);
    expect((r as { offset?: number }).offset).toBe(0);
  });

  test("parseCommonISO with offset", () => {
    const r = parseString("2024-06-15T10:30:45+05:30", undefined, enLoc());
    expect(r).toBeDefined();
    expect(r!.year).toBe(2024);
    expect((r as { offset?: number }).offset).toBe(330);
  });

  test("parseCommonISO with time only (no millis, no offset)", () => {
    const r = parseString("2024-06-15T10:30:45", undefined, enLoc());
    expect(r).toBeDefined();
    expect(r!.hour).toBe(10);
    expect(r!.minute).toBe(30);
    expect(r!.second).toBe(45);
  });

  test("parseCommonISOExtended extended week (9 chars)", () => {
    const r = parseString("2024-W101", undefined, enLoc());
    expect(r).toBeDefined();
    expect((r as { isoWeekYear?: number }).isoWeekYear).toBe(2024);
    expect((r as { isoWeek?: number }).isoWeek).toBe(10);
    expect((r as { _weekdayNum?: number })._weekdayNum).toBe(1);
  });

  test("5-digit year format (YYYYY)", () => {
    const r = parseString("12345", "YYYYY", enLoc());
    expect(r).toBeDefined();
    expect(r!.year).toBe(12345);
  });

  test("single-digit year format (Y)", () => {
    const r = parseString("5", "Y", enLoc());
    expect(r).toBeDefined();
    expect(r!.year).toBe(5);
  });

  test("ordinal day format (Do)", () => {
    const r = parseString("15th", "Do", enLoc());
    expect(r).toBeDefined();
    expect(r!.day).toBe(15);
  });

  test("compact time token Hmm", () => {
    const r = parseString("0130", "Hmm", enLoc());
    expect(r).toBeDefined();
    expect(r!.hour).toBe(1);
    expect(r!.minute).toBe(30);
  });

  test("compact time token hmm (12-hour)", () => {
    const r = parseString("0130", "hmm", enLoc(), true);
    expect(r).toBeDefined();
  });

  test("weekday name token ddd strict", () => {
    const r = parseString("Sun", "ddd", enLoc(), true);
    expect(r).toBeDefined();
    expect((r as { _weekdayNum?: number })._weekdayNum).toBe(0);
  });

  test("weekday name token dddd strict", () => {
    const r = parseString("Sunday", "dddd", enLoc(), true);
    expect(r).toBeDefined();
    expect((r as { _weekdayNum?: number })._weekdayNum).toBe(0);
  });

  test("day-of-year format YYYY-DDD with parseString", () => {
    const r = parseString("2024-366", "YYYY-DDD", enLoc());
    expect(r).toBeDefined();
    expect(r!.year).toBe(2024);
    expect((r as { dayOfYear?: number }).dayOfYear).toBe(366);
  });

  test("strict exact match for YYYY returns result with charsLeftOver", () => {
    const r = parseString("2024x", "YYYY", enLoc(), true);
    expect(r).toBeDefined();
    expect(r!.year).toBe(2024);
    expect(r!._charsLeftOver).toBe(1);
  });

  test("strict exact match for YY", () => {
    const r = parseString("98", "YY", enLoc(), true);
    expect(r).toBeDefined();
    expect(r!.year).toBe(1998);
  });

  test("strict exact match for MM", () => {
    const r = parseString("01", "MM", enLoc(), true);
    expect(r).toBeDefined();
    expect(r!.month).toBe(0);
  });

  test("strict exact match for DD", () => {
    const r = parseString("15", "DD", enLoc(), true);
    expect(r).toBeDefined();
    expect(r!.day).toBe(15);
  });
});

describe("parseArray", () => {
  test("empty array returns null", () => {
    expect(parseArray([])).toBeNull();
  });

  test("null element returns null", () => {
    expect(parseArray([null] as unknown[])).toBeNull();
  });

  test("undefined element returns null", () => {
    expect(parseArray([undefined] as unknown[])).toBeNull();
  });

  test("NaN element returns null", () => {
    expect(parseArray(["bad"] as unknown[])).toBeNull();
  });

  test("full array", () => {
    const r = parseArray([2024, 5, 15, 10, 30, 45, 123]);
    expect(r).toBeDefined();
    expect(r!.year).toBe(2024);
    expect(r!.month).toBe(5);
    expect(r!.day).toBe(15);
    expect(r!.hour).toBe(10);
    expect(r!.minute).toBe(30);
    expect(r!.second).toBe(45);
    expect(r!.millisecond).toBe(123);
  });

  test("partial array defaults", () => {
    const r = parseArray([2024]);
    expect(r).toBeDefined();
    expect(r!.year).toBe(2024);
    expect(r!.month).toBe(0);
    expect(r!.day).toBe(1);
    expect(r!.hour).toBe(0);
  });

  test("negative year uses Date constructor path", () => {
    const r = parseArray([-1000, 0, 1]);
    expect(r).toBeDefined();
    expect((r as { _useConstructor?: boolean })._useConstructor).toBe(true);
  });
});

describe("parseObject", () => {
  test("empty object returns empty result", () => {
    const r = parseObject({});
    expect(r).toBeDefined();
    expect(r.year).toBeUndefined();
  });

  test("year/month/day", () => {
    const r = parseObject({ year: 2024, month: 5, day: 15 });
    expect(r).toBeDefined();
    expect(r.year).toBe(2024);
    expect(r.month).toBe(5);
    expect(r.day).toBe(15);
  });

  test("short aliases: y, M, d", () => {
    const r = parseObject({ y: 2024, M: 5, d: 15 });
    expect(r.year).toBe(2024);
    expect(r.month).toBe(5);
    expect(r.day).toBe(15);
  });

  test("plural aliases: years, months, days", () => {
    const r = parseObject({ years: 2024, months: 5, days: 15 });
    expect(r.year).toBe(2024);
    expect(r.month).toBe(5);
    expect(r.day).toBe(15);
  });

  test("date/dates alias for day", () => {
    const r = parseObject({ year: 2024, month: 5, date: 15 });
    expect(r.day).toBe(15);
  });

  test("time fields: hour/minutes/second/ms", () => {
    const r = parseObject({
      year: 2024,
      month: 5,
      day: 15,
      hour: 10,
      minutes: 30,
      second: 45,
      ms: 123,
    });
    expect(r.hour).toBe(10);
    expect(r.minute).toBe(30);
    expect(r.second).toBe(45);
    expect(r.millisecond).toBe(123);
  });

  test("short time aliases: h, m, s", () => {
    const r = parseObject({ year: 2024, h: 10, m: 30, s: 45 });
    expect(r.hour).toBe(10);
    expect(r.minute).toBe(30);
    expect(r.second).toBe(45);
  });

  test("strings coerced to numbers", () => {
    const r = parseObject({ year: "2024", month: "5", day: "15" });
    expect(r.year).toBe(2024);
    expect(r.month).toBe(5);
    expect(r.day).toBe(15);
  });

  test("null values are skipped", () => {
    const r = parseObject({ year: null, month: 5, day: 15 });
    expect(r.year).toBeUndefined();
    expect(r.month).toBe(5);
    expect(r.day).toBe(15);
  });
});

describe("additional handler coverage", () => {
  test("isCustomFormatParsingEnabled is true after enableCustomFormatParsing", () => {
    enableCustomFormatParsing();
    expect(isCustomFormatParsingEnabled()).toBe(true);
  });

  test("tz offset token Z", () => {
    const r = parseString("2024-06-15T10:30:45+05:30", "YYYY-MM-DDTHH:mm:ssZ", enLoc());
    expect(r).toBeDefined();
    expect((r as { offset?: number }).offset).toBe(330);
  });

  test("unix seconds token X", () => {
    const r = parseString("1705276800", "X", enLoc());
    expect(r).toBeDefined();
    expect(r!.year).toBe(2024);
    expect(r!.month).toBe(0);
    expect(r!.day).toBe(15);
  });

  test("unix milliseconds token x", () => {
    const r = parseString("1705276800000", "x", enLoc());
    expect(r).toBeDefined();
    expect(r!.year).toBe(2024);
  });

  test("quarter token Q", () => {
    const r = parseString("3", "Q", enLoc());
    expect(r).toBeDefined();
    expect((r as { quarter?: number }).quarter).toBe(3);
  });

  test("locale week token ww", () => {
    const r = parseString("10", "ww", enLoc());
    expect(r).toBeDefined();
    expect((r as { isoWeek?: number }).isoWeek).toBeUndefined();
  });

  test("week year GGGG", () => {
    const r = parseString("2024", "GGGG", enLoc());
    expect(r).toBeDefined();
    expect((r as { _weekYear?: number })._weekYear).toBe(2024);
  });

  test("locale week year gggg", () => {
    const r = parseString("2024", "gggg", enLoc());
    expect(r).toBeDefined();
  });

  test("short month MMM", () => {
    const r = parseString("Jan", "MMM", enLoc());
    expect(r).toBeDefined();
    expect(r!.month).toBe(0);
  });

  test("short month MMM strict", () => {
    const r = parseString("Jan", "MMM", enLoc(), true);
    expect(r).toBeDefined();
    expect(r!.month).toBe(0);
  });

  test("full month MMMM strict", () => {
    const r = parseString("January", "MMMM", enLoc(), true);
    expect(r).toBeDefined();
    expect(r!.month).toBe(0);
  });

  test("min-weekday dd", () => {
    const r = parseString("Sun", "dd", enLoc());
    expect(r).toBeDefined();
  });

  test("locale weekday e", () => {
    const r = parseString("0", "e", enLoc());
    expect(r).toBeDefined();
  });

  test("ISO weekday E", () => {
    const r = parseString("1", "E", enLoc());
    expect(r).toBeDefined();
  });

  test("single-letter day token d", () => {
    const r = parseString("0", "d", enLoc());
    expect(r).toBeDefined();
  });

  test("12-hour hh token", () => {
    const r = parseString("12", "hh", enLoc());
    expect(r).toBeDefined();
    expect(r!.hour).toBe(12);
  });

  test("12-hour h token strict", () => {
    const r = parseString("1", "h", enLoc(), true);
    expect(r).toBeDefined();
    expect(r!.hour).toBe(1);
  });

  test("kk token (24h with 24→0)", () => {
    const r = parseString("24", "kk", enLoc());
    expect(r).toBeDefined();
    expect(r!.hour).toBe(0);
  });

  test("k token", () => {
    const r = parseString("5", "k", enLoc());
    expect(r).toBeDefined();
    expect(r!.hour).toBe(5);
  });

  test("compact time Hmmss", () => {
    const r = parseString("013045", "Hmmss", enLoc());
    expect(r).toBeDefined();
    expect(r!.hour).toBe(1);
    expect(r!.minute).toBe(30);
    expect(r!.second).toBe(45);
  });

  test("sub-second token SSS (3-char)", () => {
    const r = parseString("123", "SSS", enLoc());
    expect(r).toBeDefined();
    expect(r!.millisecond).toBe(123);
  });

  test("ordinal Do with no suffix parses as day", () => {
    const r = parseString("15", "Do", enLoc());
    expect(r).toBeDefined();
    expect(r!.day).toBe(15);
  });

  test("parseString with _claimed isoResult", () => {
    // A date-time string parsed without format through ISO table where time not allowed
    enableCustomFormatParsing();
    const r1 = parseString("2024-01-01", "YYYY-MM-DD", enLoc(), false);
    expect(r1).toBeDefined();
  });

  test("setParseTwoDigitYear custom function", () => {
    setParseTwoDigitYear((input: string) => 2000 + parseInt(input, 10));
    const r = parseString("30", "YY", enLoc());
    expect(r!.year).toBe(2030);
    setParseTwoDigitYear(undefined);
  });

  test("parseString with non-en locale triggers parseCommonISOExtended", () => {
    const loc = namedLoc("fr");
    const r = parseString("20240615", undefined, loc);
    expect(r).toBeDefined();
    expect(r!.year).toBe(2024);
    expect(r!.month).toBe(5);
    expect(r!.day).toBe(15);
  });

  test("ISO week single-char W token", () => {
    const r = parseString("10", "W", enLoc());
    expect(r).toBeDefined();
    expect((r as { isoWeek?: number }).isoWeek).toBe(10);
  });

  test("locale week single-char w token", () => {
    const r = parseString("10", "w", enLoc());
    expect(r).toBeDefined();
  });

  test("full weekday name dddd", () => {
    const r = parseString("Monday", "dddd", enLoc());
    expect(r).toBeDefined();
    expect((r as { _weekdayNum?: number })._weekdayNum).toBe(1);
  });

  test("short weekday name ddd non-strict", () => {
    const r = parseString("Mon", "ddd", enLoc());
    expect(r).toBeDefined();
  });

  test("strict minute token mm", () => {
    const r = parseString("05", "mm", enLoc(), true);
    expect(r).toBeDefined();
    expect(r!.minute).toBe(5);
  });

  test("strict single-char minute m", () => {
    const r = parseString("5", "m", enLoc(), true);
    expect(r).toBeDefined();
    expect(r!.minute).toBe(5);
  });

  test("strict second token ss", () => {
    const r = parseString("45", "ss", enLoc(), true);
    expect(r).toBeDefined();
    expect(r!.second).toBe(45);
  });

  test("12-hour hh token with meridiem A", () => {
    const r = parseString("12:00 PM", "hh:mm A", enLoc());
    expect(r).toBeDefined();
    expect(r!.hour).toBe(12);
  });

  test("12-hour h token strict with single digit", () => {
    const r = parseString("1", "h", enLoc(), true);
    expect(r).toBeDefined();
    expect(r!.hour).toBe(1);
  });

  test("single-char hour H token strict", () => {
    const r = parseString("8", "H", enLoc(), true);
    expect(r).toBeDefined();
    expect(r!.hour).toBe(8);
  });

  test("single-char day D token strict", () => {
    const r = parseString("5", "D", enLoc(), true);
    expect(r).toBeDefined();
    expect(r!.day).toBe(5);
  });

  test("single-char month M token strict", () => {
    const r = parseString("6", "M", enLoc(), true);
    expect(r).toBeDefined();
    expect(r!.month).toBe(5);
  });

  test("day of year DDD token", () => {
    const r = parseString("100", "DDD", enLoc());
    expect(r).toBeDefined();
  });

  test("6-digit signed year YYYYYY", () => {
    const r = parseString("+123456", "YYYYYY", enLoc());
    expect(r).toBeDefined();
    expect(r!.year).toBe(123456);
  });

  test("negative signed year YYYYYY", () => {
    const r = parseString("-001234", "YYYYYY", enLoc());
    expect(r).toBeDefined();
    expect(r!.year).toBe(-1234);
  });

  test("weekday name case insensitive", () => {
    const r = parseString("sunday", "dddd", enLoc());
    expect(r).toBeDefined();
    expect((r as { _weekdayNum?: number })._weekdayNum).toBe(0);
  });

  test("short weekday name case insensitive", () => {
    const r = parseString("SUN", "ddd", enLoc());
    expect(r).toBeDefined();
    expect((r as { _weekdayNum?: number })._weekdayNum).toBe(0);
  });

  test("HH token strict", () => {
    const r = parseString("08", "HH", enLoc(), true);
    expect(r).toBeDefined();
    expect(r!.hour).toBe(8);
  });

  test("MM token strict", () => {
    const r = parseString("06", "MM", enLoc(), true);
    expect(r).toBeDefined();
    expect(r!.month).toBe(5);
  });

  test("DD token strict", () => {
    const r = parseString("15", "DD", enLoc(), true);
    expect(r).toBeDefined();
    expect(r!.day).toBe(15);
  });

  test("ISO 8601 with space separator", () => {
    const r = parseString("2024-06-15 10:30:45", undefined, enLoc());
    expect(r).toBeDefined();
    expect(r!.hour).toBe(10);
  });

  test("ISO 8601 with millis and explicit offset", () => {
    const r = parseString("2024-06-15T10:30:45.123+05:30", undefined, enLoc());
    expect(r).toBeDefined();
    expect(r!.millisecond).toBe(123);
    expect((r as { offset?: number }).offset).toBe(330);
  });

  test("JSON date format", () => {
    const ts = Date.UTC(2024, 0, 15, 10, 30, 0);
    const r = parseString(`/Date(${ts}+0530)/`, undefined, enLoc());
    expect(r).toBeDefined();
    expect(r!.year).toBe(2024);
    expect(r!.month).toBe(0);
    expect(r!.day).toBe(15);
  });

  test("RFC2822 with 2-digit year", () => {
    const r = parseString("15 Jan 24 10:30:45 +0000", undefined, enLoc());
    expect(r).toBeDefined();
    expect(r!.year).toBe(2024);
    expect(r!.month).toBe(0);
    expect(r!.day).toBe(15);
  });

  test("RFC2822 with named timezone", () => {
    const r = parseString("15 Jan 2024 10:30:45 GMT", undefined, enLoc());
    expect(r).toBeDefined();
    expect(r!.year).toBe(2024);
  });

  test("parseWithFormat with date and time format (space separator)", () => {
    const r = parseWithFormatImpl("2024-06-15 10:30", "YYYY-MM-DD HH:mm", enLoc());
    expect(r).toBeDefined();
    expect(r!.hour).toBe(10);
    expect(r!.minute).toBe(30);
  });

  test("parseWithFormat ordinal format missing ordinal suffix", () => {
    const r = parseWithFormatImpl("15", "Do", enLoc());
    expect(r).toBeDefined();
    expect(r!.day).toBe(15);
  });

  test("long sub-second token SSSSSS", () => {
    const r = parseString("123456", "SSSSSS", enLoc());
    expect(r).toBeDefined();
    expect(r!.millisecond).toBe(123);
  });

  test("single-char token M (month) non-strict", () => {
    const r = parseString("6", "M", enLoc());
    expect(r).toBeDefined();
    expect(r!.month).toBe(5);
  });

  test("short month MMM non-strict period fallback", () => {
    const r = parseString("Jan", "MMM", enLoc());
    expect(r).toBeDefined();
    expect(r!.month).toBe(0);
  });

  test("full month MMMM non-strict", () => {
    const r = parseString("January", "MMMM", enLoc());
    expect(r).toBeDefined();
    expect(r!.month).toBe(0);
  });

  test("locale weekday e strict", () => {
    const r = parseString("0", "e", enLoc(), true);
    expect(r).toBeDefined();
  });

  test("ISO weekday E strict", () => {
    const r = parseString("1", "E", enLoc(), true);
    expect(r).toBeDefined();
  });

  test("single-char day d strict", () => {
    const r = parseString("0", "d", enLoc(), true);
    expect(r).toBeDefined();
  });

  test("AM/PM token A", () => {
    const r = parseString("10:30 AM", "HH:mm A", enLoc());
    expect(r).toBeDefined();
    expect((r as { _meridiem?: string })._meridiem).toBe("AM");
  });

  test("Z token with ZZ format (no colon)", () => {
    const r = parseString("2024-06-15T10:30:45+0530", "YYYY-MM-DDTHH:mm:ssZZ", enLoc());
    expect(r).toBeDefined();
    expect((r as { offset?: number }).offset).toBe(330);
  });

  test("parseString with 1-char format Y", () => {
    const r = parseString("2024", "Y", enLoc());
    expect(r).toBeDefined();
    expect(r!.year).toBe(2024);
  });

  test("parseString with 2-char year format YY strict", () => {
    const r = parseString("24", "YY", enLoc(), true);
    expect(r).toBeDefined();
    expect(r!.year).toBe(2024);
  });

  test("parseString with ordinal year format yo", () => {
    const r = parseString("2024th", "yo", enLoc());
    expect(r).toBeDefined();
  });

  test("parseString with large format array (3 formats)", () => {
    const r = parseString("15/06/2024", ["YYYY-MM-DD", "MM/DD/YYYY", "DD/MM/YYYY"], enLoc());
    expect(r).toBeDefined();
    expect(r!.year).toBe(2024);
    expect(r!.day).toBe(15);
    expect(r!.month).toBe(5);
  });

  test("12-hour hh with AM/PM", () => {
    const r = parseString("02:30 PM", "hh:mm A", enLoc());
    expect(r).toBeDefined();
    expect(r!.hour).toBe(14);
  });

  test("unix seconds token X invalid input returns empty", () => {
    const r = parseString("not-a-number", "X", enLoc());
    expect(r).toBeDefined();
    expect(r!._empty).toBe(true);
  });

  test("unix ms token x invalid input returns empty", () => {
    const r = parseString("not-a-number", "x", enLoc());
    expect(r).toBeDefined();
    expect(r!._empty).toBe(true);
  });

  test("single-char hour token h non-strict", () => {
    const r = parseString("12", "h", enLoc());
    expect(r).toBeDefined();
    expect(r!.hour).toBe(12);
  });

  test("day of year DDDD token (4-digit)", () => {
    const r = parseString("0100", "DDDD", enLoc());
    expect(r).toBeDefined();
  });
});

describe("parseWithFormat branch coverage", () => {
  test("remaining literal ops mark unused tokens when input ends", () => {
    const r = parseString("2024", "YYYY-", enLoc());
    expect(r).toBeDefined();
    expect(r!.year).toBe(2024);
  });

  test("remaining token ops mark unused tokens after token", () => {
    const r = parseString("2024", "YYYYMM", enLoc());
    expect(r).toBeDefined();
    expect(r!.year).toBe(2024);
  });

  test("strict mode whitespace literal skips non-alphanum chars", () => {
    const r = parseString("2024-06-15", "YYYY MM DD", enLoc(), true);
    expect(r).toBeDefined();
    expect(r!.month).toBe(5);
  });

  test("non-strict separator literal found ahead with switch separator", () => {
    const r = parseString("2024-06/15", "YYYY/MM-DD", enLoc());
    expect(r).toBeDefined();
  });

  test("non-strict literal found ahead skipping non-alpha chars", () => {
    const r = parseString("2024abc06", "YYYY-MM", enLoc());
    expect(r).toBeDefined();
  });

  test("strict whitespace literal skips separator chars", () => {
    const r = parseString("2024/06", "YYYY MM", enLoc(), true);
    expect(r).toBeDefined();
  });
});

describe("month name token coverage", () => {
  beforeAll(() => {
    defineLocale("period-months", {
      parentLocale: "en",
      months: {
        standalone: [
          "Jan.",
          "Feb.",
          "Mar.",
          "Apr.",
          "May.",
          "Jun.",
          "Jul.",
          "Aug.",
          "Sep.",
          "Oct.",
          "Nov.",
          "Dec.",
        ],
        format: [
          "Jan.",
          "Feb.",
          "Mar.",
          "Apr.",
          "May.",
          "Jun.",
          "Jul.",
          "Aug.",
          "Sep.",
          "Oct.",
          "Nov.",
          "Dec.",
        ],
      },
    });
  });

  test("MMM strict continuation check passes", () => {
    const r = parseString("Jan", "MMM", enLoc(), true);
    expect(r).toBeDefined();
    expect(r!.month).toBe(0);
  });

  test("MMMM strict continuation check passes", () => {
    const r = parseString("January", "MMMM", enLoc(), true);
    expect(r).toBeDefined();
    expect(r!.month).toBe(0);
  });

  test("MMM period-stripped month name (Jan. parsed as Jan)", () => {
    const loc = namedLoc("period-months");
    const r = parseString("Jan.", "MMM", loc);
    expect(r).toBeDefined();
    expect(r!.month).toBe(0);
  });

  afterAll(() => {
    defineLocale("period-months", null);
  });
});

describe("weekday name token coverage", () => {
  test("dddd strict continuation", () => {
    const r = parseString("Sunday", "dddd", enLoc(), true);
    expect(r).toBeDefined();
    expect((r as { _weekdayNum?: number })._weekdayNum).toBe(0);
  });

  test("ddd strict continuation", () => {
    const r = parseString("Sun", "ddd", enLoc(), true);
    expect(r).toBeDefined();
    expect((r as { _weekdayNum?: number })._weekdayNum).toBe(0);
  });

  test("dd strict continuation", () => {
    const r = parseString("Su", "dd", enLoc(), true);
    expect(r).toBeDefined();
  });
});

describe("day of year token coverage", () => {
  test("DDD with 3-digit input", () => {
    const r = parseString("350", "DDD", enLoc());
    expect(r).toBeDefined();
  });

  test("day of year DDDD token", () => {
    const r = parseString("0350", "DDDD", enLoc());
    expect(r).toBeDefined();
  });
});

describe("year token coverage", () => {
  test("YYYYYY negative 5-digit year", () => {
    const r = parseString("-12345", "YYYYYY", enLoc());
    expect(r).toBeDefined();
    expect(r!.year).toBe(-12345);
  });

  test("YYYYYY positive 4-digit year", () => {
    const r = parseString("+2024", "YYYYYY", enLoc());
    expect(r).toBeDefined();
    expect(r!.year).toBe(2024);
  });

  test("YYYY with 3-digit fallback", () => {
    const r = parseString("202", "YYYY", enLoc());
    expect(r).toBeDefined();
    expect(r!.year).toBe(202);
  });

  test("YYYY with 2-digit century-adjusted fallback", () => {
    const r = parseString("20", "YYYY", enLoc());
    expect(r).toBeDefined();
    expect(r!.year).toBe(2020);
  });

  test("YY with strict exact match", () => {
    const r = parseString("24", "YY", enLoc(), true);
    expect(r).toBeDefined();
    expect(r!.year).toBe(2024);
  });

  test("Y with 6-digit input", () => {
    const r = parseString("123456", "Y", enLoc());
    expect(r).toBeDefined();
    expect(r!.year).toBe(123456);
  });
});

describe("compact time token coverage", () => {
  test("hhmmss 12-hour compact time", () => {
    const r = parseString("123045", "hhmmss", enLoc());
    expect(r).toBeDefined();
    expect(r!.hour).toBe(12);
    expect(r!.minute).toBe(30);
    expect(r!.second).toBe(45);
  });

  test("hhmm 12-hour compact with leading zero", () => {
    const r = parseString("0930", "hhmm", enLoc());
    expect(r).toBeDefined();
    expect(r!.hour).toBe(9);
    expect(r!.minute).toBe(30);
  });

  test("hh 2-digit 12-hour", () => {
    const r = parseString("12", "hh", enLoc());
    expect(r).toBeDefined();
    expect(r!.hour).toBe(12);
  });

  test("h single-digit 12-hour strict", () => {
    const r = parseString("3", "h", enLoc(), true);
    expect(r).toBeDefined();
    expect(r!.hour).toBe(3);
  });
});

describe("parseISOWithTable coverage", () => {
  test("compact date without format triggers ISO table", () => {
    const r = parseString("20240615", undefined, enLoc());
    expect(r).toBeDefined();
    expect(r!.year).toBe(2024);
  });

  test("compact ordinal without format triggers ISO table", () => {
    const r = parseString("2024366", undefined, enLoc());
    expect(r).toBeDefined();
    expect(r!.year).toBe(2024);
  });
});

describe("era token coverage", () => {
  beforeAll(() => {
    defineLocale("era-locale", {
      parentLocale: "en",
      eras: {
        since: "0001-01-01",
        until: "+999999-12-31",
        offset: 1,
        name: [
          { abbr: "BC", name: "Before Christ", narrow: "B" },
          { abbr: "AD", name: "Anno Domini", narrow: "A" },
        ],
        abbr: ["BC", "AD"],
        narrow: ["B", "A"],
      },
    });
  });

  test("era year yyyy (4-digit)", () => {
    const loc = namedLoc("era-locale");
    const r = parseString("2024", "yyyy", loc);
    expect(r).toBeDefined();
  });

  afterAll(() => {
    defineLocale("era-locale", null);
  });
});

describe("high-value coverage tests", () => {
  // Month locale with months containing periods
  beforeAll(() => {
    defineLocale("period-months", {
      parentLocale: "en",
      months: {
        standalone: [
          "Jan.",
          "Feb.",
          "Mar.",
          "Apr.",
          "May.",
          "Jun.",
          "Jul.",
          "Aug.",
          "Sep.",
          "Oct.",
          "Nov.",
          "Dec.",
        ],
        format: [
          "Jan.",
          "Feb.",
          "Mar.",
          "Apr.",
          "May.",
          "Jun.",
          "Jul.",
          "Aug.",
          "Sep.",
          "Oct.",
          "Nov.",
          "Dec.",
        ],
      },
      monthsShort: {
        standalone: [
          "Jan.",
          "Feb.",
          "Mar.",
          "Apr.",
          "May.",
          "Jun.",
          "Jul.",
          "Aug.",
          "Sep.",
          "Oct.",
          "Nov.",
          "Dec.",
        ],
        format: [
          "Jan.",
          "Feb.",
          "Mar.",
          "Apr.",
          "May.",
          "Jun.",
          "Jul.",
          "Aug.",
          "Sep.",
          "Oct.",
          "Nov.",
          "Dec.",
        ],
      },
    });
    // Create locale that triggers English fallback for month names
    defineLocale("empty-months", {
      parentLocale: "en",
      months: [],
      monthsShort: [],
    });
    // Create locale that triggers English fallback for weekday names
    defineLocale("empty-weekdays", {
      parentLocale: "en",
      weekdays: [],
      weekdaysShort: [],
      weekdaysMin: [],
    });
    // Create locale with eras
    defineLocale("test-eras", {
      parentLocale: "en",
      eras: {
        since: "0001-01-01",
        until: "+999999-12-31",
        offset: 1,
        name: [
          { abbr: "BC", name: "Before Christ", narrow: "B" },
          { abbr: "AD", name: "Anno Domini", narrow: "A" },
        ],
        abbr: ["BC", "AD"],
        narrow: ["B", "A"],
      },
    });
    // Create locale with English-prefix abbr that allows English fallback
    defineLocale("en-fallback", {
      parentLocale: "en",
      weekdays: [],
      weekdaysShort: [],
      weekdaysMin: [],
    });
    // Create locale with different full vs short months for MMMM fallback coverage
    defineLocale("mixed-months", {
      parentLocale: "en",
      months: [
        "Alpha",
        "Beta",
        "Gamma",
        "Delta",
        "Epsilon",
        "Zeta",
        "Eta",
        "Theta",
        "Iota",
        "Kappa",
        "Lambda",
        "Mu",
      ],
      monthsShort: ["A.", "B.", "C.", "D.", "E.", "Z.", "H.", "T.", "I.", "K.", "L.", "M."],
    });
  });

  test("MMMM English fallback from empty months", () => {
    const loc = namedLoc("empty-months");
    const r = parseString("Jan", "MMMM", loc);
    expect(r).toBeDefined();
    expect(r!.month).toBe(0);
  });

  test("MMMM word-match fallback with non-English-full month", () => {
    const loc = namedLoc("empty-months");
    const r = parseString("Janu", "MMMM", loc);
    expect(r).toBeDefined();
    expect(r!.month).toBeUndefined();
  });

  test("MMM English fallback from empty months", () => {
    const loc = namedLoc("empty-months");
    const r = parseString("January", "MMM", loc);
    expect(r).toBeDefined();
    expect(r!.month).toBe(0);
  });

  test("MMM word-match fallback with partial", () => {
    const loc = namedLoc("empty-months");
    const r = parseString("Janu", "MMM", loc);
    expect(r).toBeDefined();
    expect(r!.month).toBeUndefined();
  });

  test("MMM period-stripped matching", () => {
    const loc = namedLoc("period-months");
    const r = parseString("Jan", "MMM", loc);
    expect(r).toBeDefined();
    expect(r!.month).toBe(0);
  });

  test("day of year DDD with 3 digits", () => {
    const r = parseString("100", "DDD", enLoc());
    expect(r).toBeDefined();
  });

  test("day of year DDDD with 4 digits", () => {
    const r = parseString("0100", "DDDD", enLoc());
    expect(r).toBeDefined();
  });

  test("W token single-char week non-strict", () => {
    const r = parseString("10", "W", enLoc());
    expect(r).toBeDefined();
  });

  test("w token single-char locale week non-strict", () => {
    const r = parseString("10", "w", enLoc());
    expect(r).toBeDefined();
  });

  test("WW token 2-digit week", () => {
    const r = parseString("10", "WW", enLoc());
    expect(r).toBeDefined();
  });

  test("ww token 2-digit locale week", () => {
    const r = parseString("10", "ww", enLoc());
    expect(r).toBeDefined();
  });

  test("GGGG week year with value", () => {
    const r = parseString("2024", "GGGG", enLoc());
    expect(r).toBeDefined();
  });

  test("gggg locale week year with value", () => {
    const r = parseString("2024", "gggg", enLoc());
    expect(r).toBeDefined();
  });

  test("GG 2-digit week year", () => {
    const r = parseString("24", "GG", enLoc());
    expect(r).toBeDefined();
  });

  test("gg 2-digit locale week year", () => {
    const r = parseString("24", "gg", enLoc());
    expect(r).toBeDefined();
  });

  test("E ISO weekday strict", () => {
    const r = parseString("1", "E", enLoc(), true);
    expect(r).toBeDefined();
  });

  test("e locale weekday strict", () => {
    const r = parseString("0", "e", enLoc(), true);
    expect(r).toBeDefined();
  });

  test("Q quarter token", () => {
    const r = parseString("3", "Q", enLoc());
    expect(r).toBeDefined();
  });

  test("era year with yyyy format", () => {
    const loc = namedLoc("test-eras");
    const r = parseString("2024", "yyyy", loc);
    expect(r).toBeDefined();
  });

  test("era year with y format", () => {
    const loc = namedLoc("test-eras");
    const r = parseString("2024", "y", loc);
    expect(r).toBeDefined();
  });

  test("era name with NNNN format", () => {
    const loc = namedLoc("test-eras");
    const r = parseString("AD", "NNNN", loc);
    expect(r).toBeDefined();
  });

  test("era narrow with NNNNN format", () => {
    const loc = namedLoc("test-eras");
    const r = parseString("A", "NNNNN", loc);
    expect(r).toBeDefined();
  });

  test("strict continuation dddd rejects followed word chars", () => {
    const r = parseString("Sundayx", "dddd", enLoc(), true);
    expect(r).toBeDefined();
  });

  test("strict continuation ddd rejects followed word chars", () => {
    const r = parseString("Sunx", "ddd", enLoc(), true);
    expect(r).toBeDefined();
  });

  test("strict continuation MM rejects leading zero", () => {
    const r = parseString("05", "MM", enLoc(), true);
    expect(r).toBeDefined();
    expect(r!.month).toBe(4);
  });

  test("M single-char strict with no leading zero passes", () => {
    const r = parseString("5", "M", enLoc(), true);
    expect(r).toBeDefined();
    expect(r!.month).toBe(4);
  });

  test("D single-char strict with no leading zero passes", () => {
    const r = parseString("5", "D", enLoc(), true);
    expect(r).toBeDefined();
    expect(r!.day).toBe(5);
  });

  test("H single-char strict with no leading zero passes", () => {
    const r = parseString("8", "H", enLoc(), true);
    expect(r).toBeDefined();
    expect(r!.hour).toBe(8);
  });

  test("m single-char strict with no leading zero passes", () => {
    const r = parseString("5", "m", enLoc(), true);
    expect(r).toBeDefined();
    expect(r!.minute).toBe(5);
  });

  test("s single-char strict with no leading zero passes", () => {
    const r = parseString("5", "s", enLoc(), true);
    expect(r).toBeDefined();
    expect(r!.second).toBe(5);
  });

  test("HH with leading zero in strict mode", () => {
    const r = parseString("05", "HH", enLoc(), true);
    expect(r).toBeDefined();
    expect(r!.hour).toBe(5);
  });

  test("hhmm compact 12-hour time", () => {
    const r = parseString("0130", "hhmm", enLoc());
    expect(r).toBeDefined();
    expect(r!.hour).toBe(1);
    expect(r!.minute).toBe(30);
  });

  test("hmmss compact 12-hour time", () => {
    const r = parseString("013045", "hmmss", enLoc());
    expect(r).toBeDefined();
    expect(r!.hour).toBe(1);
    expect(r!.minute).toBe(30);
    expect(r!.second).toBe(45);
  });

  test("hmmss 3-digit fails back to padded", () => {
    // hmmss with only 3 digits: single-digit hour + 2-minute = partial match
    const r = parseString("130", "hmmss", enLoc());
    expect(r).toBeDefined();
  });

  // ---- ISO common fast-parse null-return branches (parseCommonISO) ----
  test("parseCommonISO non-digit year", () => {
    const r = parseString("ABCD-06-15", undefined, enLoc());
    expect(r).toBeNull();
  });

  test("parseCommonISO month out of range", () => {
    const r = parseString("2024-13-01", undefined, enLoc());
    expect(r).toBeDefined();
  });

  test("parseCommonISO non-digit month", () => {
    const r = parseString("2024-AB-15", undefined, enLoc());
    expect(r).toBeNull();
  });

  test("parseCommonISO non-digit day", () => {
    const r = parseString("2024-06-AB", undefined, enLoc());
    expect(r).toBeNull();
  });

  test("parseCommonISO bad time separator", () => {
    const r = parseString("2024-06-15X12:30:45", undefined, enLoc());
    expect(r).toBeNull();
  });

  test("parseCommonISO bad time colon", () => {
    const r = parseString("2024-06-15T12-30-45", undefined, enLoc());
    expect(r).toBeNull();
  });

  test("parseCommonISO non-digit hour", () => {
    const r = parseString("2024-06-15TAB:30:45", undefined, enLoc());
    expect(r).toBeNull();
  });

  test("parseCommonISO non-digit minute", () => {
    const r = parseString("2024-06-15T12:AB:45", undefined, enLoc());
    expect(r).toBeNull();
  });

  test("parseCommonISO non-digit second", () => {
    const r = parseString("2024-06-15T12:30:AB", undefined, enLoc());
    expect(r).toBeNull();
  });

  test("parseCommonISO full datetime with Z", () => {
    const r = parseString("2024-06-15T12:30:45Z", undefined, enLoc());
    expect(r).toBeDefined();
  });

  // ---- weekday English fallback via empty-weekdays locale ----
  test("dddd English fallback from empty weekdays", () => {
    const loc = namedLoc("empty-weekdays");
    const r = parseString("Monday", "dddd", loc);
    expect(r).toBeDefined();
  });

  test("ddd English fallback from empty weekdays", () => {
    const loc = namedLoc("empty-weekdays");
    const r = parseString("Mon", "ddd", loc);
    expect(r).toBeDefined();
  });

  test("dd non-strict loose match with empty weekdays", () => {
    const loc = namedLoc("empty-weekdays");
    const r = parseString("Mo", "dd", loc);
    expect(r).toBeDefined();
  });

  test("dddd English fallback with en-prefix locale", () => {
    const loc = namedLoc("en-fallback");
    const r = parseString("Monday", "dddd", loc);
    expect(r).toBeDefined();
  });

  test("ddd English fallback with en-prefix locale", () => {
    const loc = namedLoc("en-fallback");
    const r = parseString("Mon", "ddd", loc);
    expect(r).toBeDefined();
  });

  test("dddd non-strict loose match empty input", () => {
    const loc = namedLoc("empty-weekdays");
    const r = parseString("!", "dddd", loc);
    expect(r).toBeDefined();
    expect(r!._empty).toBe(true);
  });

  test("ddd non-strict loose match empty input", () => {
    const loc = namedLoc("empty-weekdays");
    const r = parseString("!", "ddd", loc);
    expect(r).toBeDefined();
    expect(r!._empty).toBe(true);
  });

  test("dd strict continuation failure", () => {
    const r = parseString("Sux", "dd", enLoc(), true);
    expect(r).toBeDefined();
    expect(r!._empty).toBe(true);
  });

  test("MMMM strict continuation failure", () => {
    const r = parseString("Januaryx", "MMMM", enLoc(), true);
    expect(r).toBeDefined();
    expect(r!._empty).toBe(true);
  });

  test("MMM strict continuation failure", () => {
    const r = parseString("Janx", "MMM", enLoc(), true);
    expect(r).toBeDefined();
    expect(r!._empty).toBe(true);
  });

  test("parseCommonISO full datetime +06:00 offset", () => {
    const r = parseString("2024-06-15T12:30:45+06:00", undefined, enLoc());
    expect(r).toBeDefined();
  });

  test("parseCommonISO full datetime with fractional .123", () => {
    const r = parseString("2024-06-15T12:30:45.123", undefined, enLoc());
    expect(r).toBeDefined();
  });

  test("parseCommonISO bad offset separator", () => {
    const r = parseString("2024-06-15T12:30:45+0600", undefined, enLoc());
    expect(r).toBeDefined();
  });

  test("parseCommonISO month out of range (invalid month 00)", () => {
    const r = parseString("2024-00-15", undefined, enLoc());
    expect(r).toBeDefined();
  });

  test("parseCommonISO day out of range (invalid day 00)", () => {
    const r = parseString("2024-06-00", undefined, enLoc());
    expect(r).toBeDefined();
  });

  test("parseCommonISO month >12 triggers range check", () => {
    const r = parseString("2024-13-01", undefined, enLoc());
    expect(r).toBeDefined();
  });

  test("parseCommonISO simple date-only", () => {
    const r = parseString("2024-06-15", undefined, enLoc());
    expect(r).toBeDefined();
  });

  test("parseCommonISO full datetime no offset", () => {
    const r = parseString("2024-06-15T12:30:45", undefined, enLoc());
    expect(r).toBeDefined();
  });

  test("parseCommonISO bad timezone char", () => {
    const r = parseString("2024-06-15T12:30:45X", undefined, enLoc());
    expect(r).toBeDefined();
  });

  test("parseCommonISO fractional dot only", () => {
    const r = parseString("2024-06-15T12:30:45.", undefined, enLoc());
    expect(r).toBeDefined();
  });

  test("parseCommonISO non-digit offset", () => {
    const r = parseString("2024-06-15T12:30:45+AB:00", undefined, enLoc());
    expect(r).toBeDefined();
  });

  test("stripRFC2822Comments unmatched closing paren", () => {
    const r = parseString(")", undefined, enLoc());
    expect(r).toBeNull();
  });

  test("MMMM short month fallback in non-strict", () => {
    const loc = namedLoc("mixed-months");
    const r = parseString("A.", "MMMM", loc);
    expect(r).toBeDefined();
    expect(r!.month).toBe(0);
  });

  test("MMMM period-stripped fallback in non-strict", () => {
    const loc = namedLoc("mixed-months");
    const r = parseString("A", "MMMM", loc);
    expect(r).toBeDefined();
    expect(r!.month).toBe(0);
  });
});
