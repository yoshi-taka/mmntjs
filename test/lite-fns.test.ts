import { test, expect, describe } from "bun:test";
import {
  format,
  startOf,
  endOf,
  add,
  subtract,
  diff,
  isBefore,
  isAfter,
  isSame,
  isSameOrBefore,
  isSameOrAfter,
  isBetween,
} from "../src/lite-fns";

// ---------------------------------------------------------------------------
// format
// ---------------------------------------------------------------------------
describe("format", () => {
  const d = new Date(2024, 0, 15, 10, 5, 3, 456);
  const d2 = new Date(2024, 11, 31, 23, 59, 59, 999);

  test("YYYY-MM-DD", () => {
    expect(format(new Date(2024, 0, 15), "YYYY-MM-DD")).toBe("2024-01-15");
  });

  test("HH:mm:ss.SSS", () => {
    expect(format(d, "HH:mm:ss.SSS")).toBe("10:05:03.456");
  });

  test("full datetime", () => {
    expect(format(d2, "YYYY-MM-DD HH:mm:ss.SSS")).toBe("2024-12-31 23:59:59.999");
  });

  test("MM and DD zero-padding", () => {
    expect(format(new Date(2024, 1, 2), "MM/DD")).toBe("02/02");
    expect(format(new Date(2024, 9, 9), "MM/DD")).toBe("10/09");
  });

  test("HH zero-padding", () => {
    expect(format(new Date(2024, 0, 1, 1), "HH")).toBe("01");
    expect(format(new Date(2024, 0, 1, 23), "HH")).toBe("23");
  });

  test("mm, ss zero-padding", () => {
    expect(format(new Date(2024, 0, 1, 0, 5), "mm")).toBe("05");
    expect(format(new Date(2024, 0, 1, 0, 0, 7), "ss")).toBe("07");
  });

  test("SSS zero-padding", () => {
    expect(format(new Date(2024, 0, 1, 0, 0, 0, 5), "SSS")).toBe("005");
    expect(format(new Date(2024, 0, 1, 0, 0, 0, 50), "SSS")).toBe("050");
  });

  test("year < 10 zero-padding", () => {
    const dt = new Date(2024, 0, 1);
    dt.setFullYear(9);
    expect(format(dt, "YYYY")).toBe("0009");
  });

  test("year < 100 zero-padding", () => {
    const dt = new Date(2024, 0, 1);
    dt.setFullYear(99);
    expect(format(dt, "YYYY")).toBe("0099");
  });

  test("year < 1000 zero-padding", () => {
    const dt = new Date(2024, 0, 1);
    dt.setFullYear(999);
    expect(format(dt, "YYYY")).toBe("0999");
  });

  test("year >= 1000 no extra padding", () => {
    expect(format(new Date(2024, 0, 1), "YYYY")).toBe("2024");
  });

  // JS Date stores year 0-99 as 1900-1999, so negative/big years
  // test the string padding only
  test("padYear function behavior: negative year", () => {
    // new Date with negative year gives actual negative via getFullYear
    const neg = new Date(-1, 0, 1);
    expect(neg.getFullYear()).toBe(-1);
    expect(format(neg, "YYYY")).toBe("-0001");
  });

  test("non-token characters pass through literally", () => {
    expect(format(d, "YYYY [year] MM [month]")).toBe("2024 [year] 01 [month]");
  });

  test("mixed tokens and literals", () => {
    expect(format(d, "YYYY-MM-DD HH:mm:ss.SSS")).toBe("2024-01-15 10:05:03.456");
  });

  test("empty format string", () => {
    expect(format(d, "")).toBe("");
  });

  test("unmatched characters pass through", () => {
    expect(format(d, "YYYYabcd")).toBe("2024abcd");
  });

  test("Invalid Date returns 'Invalid date'", () => {
    expect(format(new Date(NaN), "YYYY-MM-DD")).toBe("Invalid date");
  });
});

// ---------------------------------------------------------------------------
// startOf
// ---------------------------------------------------------------------------
describe("startOf", () => {
  const d = new Date(2024, 5, 15, 10, 30, 45, 123);

  test("year", () => {
    const r = startOf(d, "year");
    expect(r.getFullYear()).toBe(2024);
    expect(r.getMonth()).toBe(0);
    expect(r.getDate()).toBe(1);
    expect(r.getHours()).toBe(0);
    expect(r.getMinutes()).toBe(0);
    expect(r.getSeconds()).toBe(0);
    expect(r.getMilliseconds()).toBe(0);
  });

  test("month", () => {
    const r = startOf(d, "month");
    expect(r.getFullYear()).toBe(2024);
    expect(r.getMonth()).toBe(5);
    expect(r.getDate()).toBe(1);
    expect(r.getHours()).toBe(0);
    expect(r.getMinutes()).toBe(0);
    expect(r.getSeconds()).toBe(0);
    expect(r.getMilliseconds()).toBe(0);
  });

  test("day", () => {
    const r = startOf(d, "day");
    expect(r.getFullYear()).toBe(2024);
    expect(r.getMonth()).toBe(5);
    expect(r.getDate()).toBe(15);
    expect(r.getHours()).toBe(0);
    expect(r.getMinutes()).toBe(0);
    expect(r.getSeconds()).toBe(0);
    expect(r.getMilliseconds()).toBe(0);
  });

  test("date alias for day", () => {
    const r = startOf(d, "date");
    expect(r.getHours()).toBe(0);
  });

  test("hour", () => {
    const r = startOf(d, "hour");
    expect(r.getHours()).toBe(10);
    expect(r.getMinutes()).toBe(0);
    expect(r.getSeconds()).toBe(0);
    expect(r.getMilliseconds()).toBe(0);
  });

  test("minute", () => {
    const r = startOf(d, "minute");
    expect(r.getMinutes()).toBe(30);
    expect(r.getSeconds()).toBe(0);
    expect(r.getMilliseconds()).toBe(0);
  });

  test("second", () => {
    const r = startOf(d, "second");
    expect(r.getSeconds()).toBe(45);
    expect(r.getMilliseconds()).toBe(0);
  });

  test("leap year startOf year preserves Feb 29", () => {
    const r = startOf(new Date(2020, 1, 29), "year");
    expect(r.getFullYear()).toBe(2020);
    expect(r.getMonth()).toBe(0);
    expect(r.getDate()).toBe(1);
  });

  test("does not mutate input", () => {
    const copy = new Date(d);
    startOf(d, "month");
    expect(d).toEqual(copy);
  });
});

// ---------------------------------------------------------------------------
// endOf
// ---------------------------------------------------------------------------
describe("endOf", () => {
  const d = new Date(2024, 5, 15, 10, 30, 45, 123);

  test("year", () => {
    const r = endOf(d, "year");
    expect(r.getMonth()).toBe(11);
    expect(r.getDate()).toBe(31);
    expect(r.getHours()).toBe(23);
    expect(r.getMinutes()).toBe(59);
    expect(r.getSeconds()).toBe(59);
    expect(r.getMilliseconds()).toBe(999);
  });

  test("month", () => {
    const r = endOf(d, "month");
    expect(r.getMonth()).toBe(5);
    expect(r.getDate()).toBe(30); // June
    expect(r.getHours()).toBe(23);
  });

  test("day", () => {
    const r = endOf(d, "day");
    expect(r.getDate()).toBe(15);
    expect(r.getHours()).toBe(23);
    expect(r.getMinutes()).toBe(59);
    expect(r.getSeconds()).toBe(59);
    expect(r.getMilliseconds()).toBe(999);
  });

  test("date alias for day", () => {
    const r = endOf(d, "date");
    expect(r.getHours()).toBe(23);
  });

  test("hour", () => {
    const r = endOf(d, "hour");
    expect(r.getHours()).toBe(10);
    expect(r.getMinutes()).toBe(59);
    expect(r.getSeconds()).toBe(59);
    expect(r.getMilliseconds()).toBe(999);
  });

  test("minute", () => {
    const r = endOf(d, "minute");
    expect(r.getMinutes()).toBe(30);
    expect(r.getSeconds()).toBe(59);
    expect(r.getMilliseconds()).toBe(999);
  });

  test("second", () => {
    const r = endOf(d, "second");
    expect(r.getSeconds()).toBe(45);
    expect(r.getMilliseconds()).toBe(999);
  });

  test("february leap year", () => {
    const r = endOf(new Date(2020, 1, 15), "month");
    expect(r.getDate()).toBe(29);
  });

  test("february non-leap", () => {
    const r = endOf(new Date(2023, 1, 15), "month");
    expect(r.getDate()).toBe(28);
  });

  test("January endOf month has 31 days", () => {
    const r = endOf(new Date(2024, 0, 15), "month");
    expect(r.getDate()).toBe(31);
  });

  test("does not mutate input", () => {
    const copy = new Date(d);
    endOf(d, "month");
    expect(d).toEqual(copy);
  });
});

// ---------------------------------------------------------------------------
// add
// ---------------------------------------------------------------------------
describe("add", () => {
  test("year", () => {
    expect(add(new Date(2024, 0, 1), 1, "year")).toEqual(new Date(2025, 0, 1));
  });

  test("year negative", () => {
    expect(add(new Date(2024, 0, 1), -2, "year")).toEqual(new Date(2022, 0, 1));
  });

  test("year with Feb 29 clamping in non-leap target", () => {
    const r = add(new Date(2020, 1, 29), 1, "year");
    expect(r.getFullYear()).toBe(2021);
    expect(r.getMonth()).toBe(1);
    expect(r.getDate()).toBe(28);
  });

  test("year with Feb 29 preserved in leap target", () => {
    const r = add(new Date(2020, 1, 29), 4, "year");
    expect(r.getFullYear()).toBe(2024);
    expect(r.getMonth()).toBe(1);
    expect(r.getDate()).toBe(29);
  });

  test("month with day overflow clamping", () => {
    // Jan 31 + 1 month = Feb 29 (2024 is leap year)
    const r = add(new Date(2024, 0, 31), 1, "month");
    expect(r.getMonth()).toBe(1);
    expect(r.getDate()).toBe(29);
  });

  test("month with day overflow clamping non-leap", () => {
    const r = add(new Date(2023, 0, 31), 1, "month");
    expect(r.getMonth()).toBe(1);
    expect(r.getDate()).toBe(28);
  });

  test("month from Mar 31 clamps to Apr 30", () => {
    const r = add(new Date(2024, 2, 31), 1, "month");
    expect(r.getMonth()).toBe(3);
    expect(r.getDate()).toBe(30);
  });

  test("month negative", () => {
    expect(add(new Date(2024, 0, 15), -3, "month")).toEqual(new Date(2023, 9, 15));
  });

  test("month negative wrapping across year", () => {
    expect(add(new Date(2024, 0, 15), -1, "month")).toEqual(new Date(2023, 11, 15));
  });

  test("month large positive crosses years", () => {
    expect(add(new Date(2024, 5, 15), 18, "month")).toEqual(new Date(2025, 11, 15));
  });

  test("quarter", () => {
    expect(add(new Date(2024, 0, 15), 1, "quarter")).toEqual(new Date(2024, 3, 15));
  });

  test("quarter multiple", () => {
    expect(add(new Date(2024, 0, 15), 4, "quarter")).toEqual(new Date(2025, 0, 15));
  });

  test("quarter negative", () => {
    expect(add(new Date(2024, 0, 15), -1, "quarter")).toEqual(new Date(2023, 9, 15));
  });

  test("quarter clamping at month end", () => {
    const r = add(new Date(2024, 0, 31), 1, "quarter");
    expect(r.getMonth()).toBe(3);
    expect(r.getDate()).toBe(30);
  });

  test("week", () => {
    expect(add(new Date(2024, 0, 1), 2, "week")).toEqual(new Date(2024, 0, 15));
  });

  test("week negative", () => {
    expect(add(new Date(2024, 0, 15), -2, "week")).toEqual(new Date(2024, 0, 1));
  });

  test("day", () => {
    expect(add(new Date(2024, 0, 31), 1, "day")).toEqual(new Date(2024, 1, 1));
  });

  test("day negative", () => {
    expect(add(new Date(2024, 0, 1), -1, "day")).toEqual(new Date(2023, 11, 31));
  });

  test("date alias for day", () => {
    expect(add(new Date(2024, 0, 15), 5, "date")).toEqual(new Date(2024, 0, 20));
  });

  test("hour crossing day boundary", () => {
    expect(add(new Date(2024, 0, 1, 23), 2, "hour")).toEqual(new Date(2024, 0, 2, 1));
  });

  test("hour negative crossing day boundary", () => {
    expect(add(new Date(2024, 0, 1, 1), -2, "hour")).toEqual(new Date(2023, 11, 31, 23));
  });

  test("minute crossing hour boundary", () => {
    expect(add(new Date(2024, 0, 1, 10, 30), 45, "minute")).toEqual(new Date(2024, 0, 1, 11, 15));
  });

  test("second crossing minute boundary", () => {
    expect(add(new Date(2024, 0, 1, 10, 30, 15), 50, "second")).toEqual(
      new Date(2024, 0, 1, 10, 31, 5),
    );
  });

  test("millisecond", () => {
    expect(add(new Date(2024, 0, 1, 0, 0, 0, 500), 1500, "millisecond")).toEqual(
      new Date(2024, 0, 1, 0, 0, 2, 0),
    );
  });

  test("millisecond negative", () => {
    expect(add(new Date(2024, 0, 1, 0, 0, 0, 500), -1000, "millisecond")).toEqual(
      new Date(2024, 0, 1, 0, 0, 0, -500),
    );
  });

  test("does not mutate input", () => {
    const d = new Date(2024, 5, 15, 10, 30, 45, 123);
    const copy = new Date(d);
    add(d, 1, "day");
    expect(d).toEqual(copy);
  });

  test("zero amount returns same date", () => {
    const d = new Date(2024, 5, 15);
    expect(add(d, 0, "year")).toEqual(d);
    expect(add(d, 0, "month")).toEqual(d);
    expect(add(d, 0, "day")).toEqual(d);
  });
});

// ---------------------------------------------------------------------------
// subtract
// ---------------------------------------------------------------------------
describe("subtract", () => {
  test("year", () => {
    expect(subtract(new Date(2024, 0, 1), 1, "year")).toEqual(new Date(2023, 0, 1));
  });

  test("month", () => {
    expect(subtract(new Date(2024, 0, 15), 1, "month")).toEqual(new Date(2023, 11, 15));
  });

  test("month clamping", () => {
    const r = subtract(new Date(2024, 4, 31), 1, "month"); // May 31 - 1 month = Apr 30
    expect(r.getMonth()).toBe(3);
    expect(r.getDate()).toBe(30);
  });

  test("quarter", () => {
    expect(subtract(new Date(2024, 5, 15), 1, "quarter")).toEqual(new Date(2024, 2, 15));
  });

  test("week", () => {
    expect(subtract(new Date(2024, 0, 15), 2, "week")).toEqual(new Date(2024, 0, 1));
  });

  test("day", () => {
    expect(subtract(new Date(2024, 0, 15), 5, "day")).toEqual(new Date(2024, 0, 10));
  });

  test("hour", () => {
    expect(subtract(new Date(2024, 0, 1, 10), 3, "hour")).toEqual(new Date(2024, 0, 1, 7));
  });

  test("minute", () => {
    expect(subtract(new Date(2024, 0, 1, 10, 30), 45, "minute")).toEqual(
      new Date(2024, 0, 1, 9, 45),
    );
  });

  test("second", () => {
    expect(subtract(new Date(2024, 0, 1, 10, 30, 15), 20, "second")).toEqual(
      new Date(2024, 0, 1, 10, 29, 55),
    );
  });

  test("millisecond", () => {
    expect(subtract(new Date(2024, 0, 1, 0, 0, 0, 500), 1000, "millisecond")).toEqual(
      new Date(2024, 0, 1, 0, 0, 0, -500),
    );
  });

  test("does not mutate input", () => {
    const d = new Date(2024, 5, 15);
    const copy = new Date(d);
    subtract(d, 3, "day");
    expect(d).toEqual(copy);
  });
});

// ---------------------------------------------------------------------------
// diff
// ---------------------------------------------------------------------------
describe("diff", () => {
  test("days", () => {
    expect(diff(new Date(2024, 5, 15), new Date(2024, 5, 10), "day")).toBe(5);
  });

  test("days negative", () => {
    expect(diff(new Date(2024, 5, 10), new Date(2024, 5, 15), "day")).toBe(-5);
  });

  test("hours", () => {
    expect(diff(new Date(2024, 5, 15, 12), new Date(2024, 5, 15, 8), "hour")).toBe(4);
  });

  test("minutes", () => {
    expect(diff(new Date(2024, 5, 15, 10, 30), new Date(2024, 5, 15, 10, 15), "minute")).toBe(15);
  });

  test("seconds", () => {
    expect(
      diff(new Date(2024, 5, 15, 10, 30, 30), new Date(2024, 5, 15, 10, 30, 15), "second"),
    ).toBe(15);
  });

  test("milliseconds", () => {
    expect(
      diff(
        new Date(2024, 5, 15, 10, 30, 30, 500),
        new Date(2024, 5, 15, 10, 30, 30, 0),
        "millisecond",
      ),
    ).toBe(500);
  });

  test("weeks", () => {
    expect(diff(new Date(2024, 5, 15), new Date(2024, 5, 1), "week")).toBe(2);
  });

  test("months simple", () => {
    expect(diff(new Date(2024, 5, 15), new Date(2024, 2, 15), "month")).toBe(3);
  });

  test("months negative", () => {
    expect(diff(new Date(2024, 2, 15), new Date(2024, 5, 15), "month")).toBe(-3);
  });

  test("months with day-of-month adjustment", () => {
    // Jan 31 to Feb 28 = 1 month (Feb 31 doesn't exist, clamped to Feb 28)
    // a.getDate()=28 < b.getDate()=31 → m - 1 = 0 → with clamp adjustment = 0 months
    // Actually: Jan 31 (a) to Feb 28 (b), a is after b → positive
    // m = 0*12 + 1 = 1, but a.getDate() (28) < b.getDate() (31) → 1 - 1 = 0
    expect(diff(new Date(2024, 1, 28), new Date(2024, 0, 31), "month")).toBe(0);
  });

  test("months year boundary", () => {
    expect(diff(new Date(2025, 0, 15), new Date(2024, 0, 15), "month")).toBe(12);
  });

  test("months multiple years", () => {
    expect(diff(new Date(2026, 5, 15), new Date(2024, 2, 15), "month")).toBe(27);
  });

  test("quarter", () => {
    expect(diff(new Date(2024, 8, 15), new Date(2024, 2, 15), "quarter")).toBe(2);
  });

  test("years", () => {
    expect(diff(new Date(2026, 0, 1), new Date(2024, 0, 1), "year")).toBe(2);
  });

  test("years negative", () => {
    expect(diff(new Date(2024, 0, 1), new Date(2026, 0, 1), "year")).toBe(-2);
  });

  test("years partial", () => {
    // 2024-06-15 to 2026-01-15: 18 months → 1 year (truncated)
    expect(diff(new Date(2026, 0, 15), new Date(2024, 5, 15), "year")).toBe(1);
  });

  test("same date returns 0", () => {
    const d = new Date(2024, 5, 15);
    expect(diff(d, d, "day")).toBe(0);
    expect(diff(d, d, "month")).toBe(0);
    expect(diff(d, d, "year")).toBe(0);
  });

  test("unknown unit returns NaN", () => {
    expect(diff(new Date(2024, 0, 1), new Date(2024, 0, 2), "unknown" as never)).toBe(NaN);
  });
});

// ---------------------------------------------------------------------------
// isBefore / isAfter / isSame / isSameOrBefore / isSameOrAfter
// ---------------------------------------------------------------------------
describe("comparison", () => {
  const d1 = new Date(2024, 5, 15, 10, 0, 0, 0);
  const d2 = new Date(2024, 5, 16, 10, 0, 0, 0);

  test("isBefore", () => {
    expect(isBefore(d1, d2)).toBe(true);
    expect(isBefore(d2, d1)).toBe(false);
    expect(isBefore(d1, d1)).toBe(false);
  });

  test("isBefore with unit", () => {
    expect(isBefore(d1, d2, "day")).toBe(true);
    // Same day, different hour
    expect(isBefore(new Date(2024, 5, 15, 8), new Date(2024, 5, 15, 22), "day")).toBe(false);
  });

  test("isAfter", () => {
    expect(isAfter(d2, d1)).toBe(true);
    expect(isAfter(d1, d2)).toBe(false);
    expect(isAfter(d1, d1)).toBe(false);
  });

  test("isAfter with unit", () => {
    expect(isAfter(new Date(2024, 5, 15, 22), new Date(2024, 5, 15, 8), "day")).toBe(false);
  });

  test("isSame", () => {
    expect(isSame(d1, d1)).toBe(true);
    expect(isSame(d1, d2)).toBe(false);
  });

  test("isSame with unit", () => {
    expect(
      isSame(new Date(2024, 5, 15, 8, 0, 0, 0), new Date(2024, 5, 15, 22, 0, 0, 0), "day"),
    ).toBe(true);
  });

  test("isSame with month unit", () => {
    expect(isSame(new Date(2024, 5, 1), new Date(2024, 5, 30), "month")).toBe(true);
  });

  test("isSame with year unit", () => {
    expect(isSame(new Date(2024, 0, 1), new Date(2024, 11, 31), "year")).toBe(true);
  });

  test("isSameOrBefore", () => {
    expect(isSameOrBefore(d1, d1)).toBe(true);
    expect(isSameOrBefore(d1, d2)).toBe(true);
    expect(isSameOrBefore(d2, d1)).toBe(false);
  });

  test("isSameOrAfter", () => {
    expect(isSameOrAfter(d1, d1)).toBe(true);
    expect(isSameOrAfter(d2, d1)).toBe(true);
    expect(isSameOrAfter(d1, d2)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// isBetween
// ---------------------------------------------------------------------------
describe("isBetween", () => {
  const a = new Date(2024, 5, 10);
  const b = new Date(2024, 5, 15);
  const c = new Date(2024, 5, 20);

  test("default inclusivity () - exclusive", () => {
    expect(isBetween(b, a, c)).toBe(true);
    expect(isBetween(a, a, c)).toBe(false);
    expect(isBetween(c, a, c)).toBe(false);
  });

  test("[] - inclusive both ends", () => {
    expect(isBetween(a, a, c, "[]")).toBe(true);
    expect(isBetween(c, a, c, "[]")).toBe(true);
    expect(isBetween(b, a, c, "[]")).toBe(true);
  });

  test("[) - inclusive start exclusive end", () => {
    expect(isBetween(a, a, c, "[)")).toBe(true);
    expect(isBetween(c, a, c, "[)")).toBe(false);
  });

  test("(] - exclusive start inclusive end", () => {
    expect(isBetween(a, a, c, "(]")).toBe(false);
    expect(isBetween(c, a, c, "(]")).toBe(true);
  });

  test("with unit parameter (year granularity)", () => {
    // All three in different years: 2023 < 2024 < 2025
    const a2 = new Date(2023, 5, 15);
    const b2 = new Date(2024, 5, 15);
    const c2 = new Date(2025, 5, 15);
    expect(isBetween(b2, a2, c2, "()", "year")).toBe(true);
    // Same year → exclusive fails
    expect(isBetween(a2, a2, new Date(2023, 11, 31), "()", "year")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Edge cases: NaN / Invalid Date
// ---------------------------------------------------------------------------
describe("edge cases: NaN / Invalid Date", () => {
  test("startOf with NaN date returns Invalid Date", () => {
    const r = startOf(new Date(NaN), "month");
    expect(r.getTime()).toBe(NaN);
  });

  test("endOf with NaN date returns Invalid Date", () => {
    const r = endOf(new Date(NaN), "month");
    expect(r.getTime()).toBe(NaN);
  });

  test("add with NaN date returns Invalid Date", () => {
    const r = add(new Date(NaN), 1, "day");
    expect(r.getTime()).toBe(NaN);
  });

  test("diff with NaN date returns NaN", () => {
    expect(diff(new Date(NaN), new Date(2024, 0, 1), "day")).toBe(NaN);
    expect(diff(new Date(2024, 0, 1), new Date(NaN), "day")).toBe(NaN);
  });

  test("isBefore with NaN date returns false", () => {
    expect(isBefore(new Date(NaN), new Date(2024, 0, 1))).toBe(false);
    expect(isBefore(new Date(2024, 0, 1), new Date(NaN))).toBe(false);
  });

  test("isAfter with NaN date returns false", () => {
    expect(isAfter(new Date(NaN), new Date(2024, 0, 1))).toBe(false);
  });

  test("isSame with NaN date returns false", () => {
    expect(isSame(new Date(NaN), new Date(2024, 0, 1))).toBe(false);
  });

  test("isSameOrBefore with NaN date returns false", () => {
    expect(isSameOrBefore(new Date(NaN), new Date(2024, 0, 1))).toBe(false);
  });

  test("isSameOrAfter with NaN date returns false", () => {
    expect(isSameOrAfter(new Date(NaN), new Date(2024, 0, 1))).toBe(false);
  });

  test("isBetween with NaN date returns false", () => {
    const valid = new Date(2024, 5, 15);
    expect(isBetween(new Date(NaN), valid, valid)).toBe(false);
  });
});
