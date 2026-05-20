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

describe("format", () => {
  test("YYYY-MM-DD", () => {
    expect(format(new Date(2024, 0, 15), "YYYY-MM-DD")).toBe("2024-01-15");
  });

  test("HH:mm:ss.SSS", () => {
    expect(format(new Date(2024, 0, 15, 10, 5, 3, 456), "HH:mm:ss.SSS")).toBe("10:05:03.456");
  });

  test("full datetime", () => {
    expect(format(new Date(2024, 11, 31, 23, 59, 59, 999), "YYYY-MM-DD HH:mm:ss.SSS")).toBe(
      "2024-12-31 23:59:59.999",
    );
  });

  test("Invalid date", () => {
    expect(format(new Date(NaN), "YYYY-MM-DD")).toBe("Invalid date");
  });
});

describe("startOf", () => {
  test("year", () => {
    const d = new Date(2024, 5, 15, 10, 30, 45, 123);
    expect(startOf(d, "year")).toEqual(new Date(2024, 0, 1));
  });

  test("month", () => {
    const d = new Date(2024, 5, 15, 10, 30, 45, 123);
    expect(startOf(d, "month")).toEqual(new Date(2024, 5, 1));
  });

  test("week (no-op — MomentLite does not handle week in startOf)", () => {
    const d = new Date(2024, 0, 17, 10, 30, 45, 123);
    const r = startOf(d, "week");
    expect(r.valueOf()).toBe(d.valueOf());
  });

  test("day", () => {
    const d = new Date(2024, 5, 15, 10, 30, 45, 123);
    expect(startOf(d, "day")).toEqual(new Date(2024, 5, 15));
  });

  test("hour", () => {
    const d = new Date(2024, 5, 15, 10, 30, 45, 123);
    const r = startOf(d, "hour");
    expect(r.getHours()).toBe(10);
    expect(r.getMinutes()).toBe(0);
    expect(r.getSeconds()).toBe(0);
  });

  test("minute", () => {
    const d = new Date(2024, 5, 15, 10, 30, 45, 123);
    const r = startOf(d, "minute");
    expect(r.getMinutes()).toBe(30);
    expect(r.getSeconds()).toBe(0);
  });

  test("second", () => {
    const d = new Date(2024, 5, 15, 10, 30, 45, 123);
    const r = startOf(d, "second");
    expect(r.getSeconds()).toBe(45);
    expect(r.getMilliseconds()).toBe(0);
  });

  test("does not mutate input", () => {
    const d = new Date(2024, 5, 15, 10, 30, 45, 123);
    const copy = new Date(d);
    startOf(d, "month");
    expect(d).toEqual(copy);
  });
});

describe("endOf", () => {
  test("month", () => {
    const d = new Date(2024, 0, 15, 10, 30, 45, 123);
    const r = endOf(d, "month");
    expect(r.getMonth()).toBe(0);
    expect(r.getDate()).toBe(31);
    expect(r.getHours()).toBe(23);
    expect(r.getMinutes()).toBe(59);
    expect(r.getSeconds()).toBe(59);
    expect(r.getMilliseconds()).toBe(999);
  });

  test("year", () => {
    const d = new Date(2024, 5, 15, 10, 30, 45, 123);
    const r = endOf(d, "year");
    expect(r.getMonth()).toBe(11);
    expect(r.getDate()).toBe(31);
    expect(r.getHours()).toBe(23);
  });

  test("february leap year", () => {
    const d = new Date(2020, 1, 15);
    const r = endOf(d, "month");
    expect(r.getDate()).toBe(29);
  });

  test("february non-leap", () => {
    const d = new Date(2023, 1, 15);
    const r = endOf(d, "month");
    expect(r.getDate()).toBe(28);
  });
});

describe("add", () => {
  test("year", () => {
    expect(add(new Date(2024, 0, 1), 1, "year")).toEqual(new Date(2025, 0, 1));
  });

  test("month with day overflow clamping", () => {
    // Jan 31 + 1 month = Feb 28 (not Feb 31)
    const r = add(new Date(2024, 0, 31), 1, "month");
    expect(r.getMonth()).toBe(1);
    expect(r.getDate()).toBe(29); // 2024 is leap year
  });

  test("negative month", () => {
    expect(add(new Date(2024, 0, 15), -3, "month")).toEqual(new Date(2023, 9, 15));
  });

  test("week", () => {
    expect(add(new Date(2024, 0, 1), 2, "week")).toEqual(new Date(2024, 0, 15));
  });

  test("day", () => {
    expect(add(new Date(2024, 0, 31), 1, "day")).toEqual(new Date(2024, 1, 1));
  });

  test("hour", () => {
    expect(add(new Date(2024, 0, 1, 23), 2, "hour")).toEqual(new Date(2024, 0, 2, 1));
  });

  test("does not mutate input", () => {
    const d = new Date(2024, 5, 15, 10, 30, 45, 123);
    const copy = new Date(d);
    add(d, 1, "day");
    expect(d).toEqual(copy);
  });
});

describe("subtract", () => {
  test("delegates to add with negation", () => {
    expect(subtract(new Date(2024, 5, 15), 3, "day")).toEqual(
      add(new Date(2024, 5, 15), -3, "day"),
    );
  });
});

describe("diff", () => {
  test("days", () => {
    expect(diff(new Date(2024, 5, 15), new Date(2024, 5, 10), "day")).toBe(5);
  });

  test("negative diff", () => {
    expect(diff(new Date(2024, 5, 10), new Date(2024, 5, 15), "day")).toBe(-5);
  });

  test("hours", () => {
    expect(diff(new Date(2024, 5, 15, 12), new Date(2024, 5, 15, 8), "hour")).toBe(4);
  });

  test("weeks", () => {
    expect(diff(new Date(2024, 5, 15), new Date(2024, 5, 1), "week")).toBe(2);
  });

  test("months simple", () => {
    expect(diff(new Date(2024, 5, 15), new Date(2024, 2, 15), "month")).toBe(3);
  });

  test("years", () => {
    expect(diff(new Date(2026, 0, 1), new Date(2024, 0, 1), "year")).toBe(2);
  });
});

describe("comparison", () => {
  const d1 = new Date(2024, 5, 15, 10, 0, 0, 0);
  const d2 = new Date(2024, 5, 16, 10, 0, 0, 0);

  test("isBefore", () => {
    expect(isBefore(d1, d2)).toBe(true);
    expect(isBefore(d2, d1)).toBe(false);
    expect(isBefore(d1, d2, "day")).toBe(true);
  });

  test("isAfter", () => {
    expect(isAfter(d2, d1)).toBe(true);
    expect(isAfter(d1, d2)).toBe(false);
  });

  test("isSame", () => {
    expect(isSame(d1, d1)).toBe(true);
    expect(isSame(d1, d2, "day")).toBe(false);
    expect(
      isSame(new Date(2024, 5, 15, 8, 0, 0, 0), new Date(2024, 5, 15, 22, 0, 0, 0), "day"),
    ).toBe(true);
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

  test("isBetween", () => {
    const a = new Date(2024, 5, 10);
    const b = new Date(2024, 5, 15);
    const c = new Date(2024, 5, 20);
    expect(isBetween(b, a, c)).toBe(true);
    expect(isBetween(a, a, c)).toBe(false);
    expect(isBetween(a, a, c, "[)")).toBe(true);
    expect(isBetween(c, a, c, "(]")).toBe(true);
  });
});
