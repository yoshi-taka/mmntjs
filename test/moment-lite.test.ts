import { describe, test, expect } from "bun:test";
import liteMoment from "../src/entry/lite.ts";

const moment = liteMoment as unknown as ((input?: unknown, format?: unknown, strict?: unknown) => ReturnType<typeof liteMoment>);

describe("MomentLite basic", () => {
  test("creates current moment", () => {
    const m = moment();
    expect(m.isValid()).toBe(true);
  });

  test("creates from string", () => {
    const m = moment("2024-01-15");
    expect(m.isValid()).toBe(true);
  });

  test("creates from number (timestamp)", () => {
    const m = moment(1705276800000);
    expect(m.isValid()).toBe(true);
  });

  test("creates from Date", () => {
    const m = moment(new Date(2024, 0, 15));
    expect(m.isValid()).toBe(true);
  });
});

describe("MomentLite valueOf / unix / toDate", () => {
  test("valueOf", () => {
    const m = moment("2024-01-15");
    expect(typeof m.valueOf()).toBe("number");
  });

  test("unix", () => {
    const m = moment("2024-01-15");
    expect(m.unix()).toBe(Math.floor(m.valueOf() / 1000));
  });

  test("toDate", () => {
    const m = moment("2024-01-15");
    expect(m.toDate()).toBeInstanceOf(Date);
  });

  test("invalid moment valueOf NaN", () => {
    const m = moment("invalid");
    expect(m.valueOf()).toBeNaN();
  });
});

describe("MomentLite format", () => {
  test("format YYYY-MM-DD", () => {
    const m = moment("2024-01-15");
    expect(m.format("YYYY-MM-DD")).toBe("2024-01-15");
  });

  test("format with time", () => {
    const m = moment("2024-01-15 10:30:45");
    expect(m.format("HH:mm:ss")).toBe("10:30:45");
  });

  test("format invalid returns Invalid date", () => {
    const m = moment("invalid");
    expect(m.format()).toBe("Invalid date");
  });
});

describe("MomentLite getters/setters", () => {
  test("year", () => {
    const m = moment("2024-01-15");
    expect(m.year()).toBe(2024);
  });

  test("month", () => {
    const m = moment("2024-01-15");
    expect(m.month()).toBe(0);
  });

  test("date", () => {
    const m = moment("2024-01-15");
    expect(m.date()).toBe(15);
  });

  test("hour/minute/second/millisecond", () => {
    const m = moment("2024-01-15 10:30:45.123");
    expect(m.hour()).toBe(10);
    expect(m.minute()).toBe(30);
    expect(m.second()).toBe(45);
    expect(m.millisecond()).toBe(123);
  });

  test("day of week", () => {
    const m = moment("2024-01-15");
    expect(typeof m.day()).toBe("number");
  });

  test("setters return Moment", () => {
    const m = moment("2024-01-15");
    const r = m.year(2025);
    expect(r).toBe(m);
    expect(m.year()).toBe(2025);
  });
});

describe("MomentLite manipulation", () => {
  test("add days", () => {
    const m = moment("2024-01-15");
    m.add(5, "days");
    expect(m.date()).toBe(20);
  });

  test("add months", () => {
    const m = moment("2024-01-15");
    m.add(1, "months");
    expect(m.month()).toBe(1);
  });

  test("subtract days", () => {
    const m = moment("2024-01-15");
    m.subtract(5, "days");
    expect(m.date()).toBe(10);
  });

  test("startOf month", () => {
    const m = moment("2024-01-15");
    m.startOf("month");
    expect(m.date()).toBe(1);
  });

  test("endOf month", () => {
    const m = moment("2024-01-15");
    m.endOf("month");
    expect(m.date()).toBe(31);
  });
});

describe("MomentLite display", () => {
  test("toISOString", () => {
    const m = moment.utc("2024-01-15");
    const iso = m.toISOString();
    expect(iso).toMatch(/^2024-01-15T00:00:00/);
  });

  test("toJSON", () => {
    const m = moment.utc("2024-01-15");
    expect(typeof m.toJSON()).toBe("string");
  });

  test("toString", () => {
    const m = moment("2024-01-15");
    expect(typeof m.toString()).toBe("string");
  });

  test("invalid toISOString returns null", () => {
    const m = moment("invalid");
    expect(m.toISOString()).toBeNull();
  });
});

describe("MomentLite comparison", () => {
  test("isBefore", () => {
    const a = moment("2024-01-15");
    const b = moment("2024-01-20");
    expect(a.isBefore(b)).toBe(true);
  });

  test("isAfter", () => {
    const a = moment("2024-01-15");
    const b = moment("2024-01-10");
    expect(a.isAfter(b)).toBe(true);
  });

  test("isSame", () => {
    const a = moment("2024-01-15");
    const b = moment("2024-01-15");
    expect(a.isSame(b)).toBe(true);
  });

  test("isSameOrBefore", () => {
    const a = moment("2024-01-15");
    const b = moment("2024-01-15");
    expect(a.isSameOrBefore(b)).toBe(true);
  });

  test("isSameOrAfter", () => {
    const a = moment("2024-01-15");
    const b = moment("2024-01-15");
    expect(a.isSameOrAfter(b)).toBe(true);
  });
});

describe("MomentLite diff", () => {
  test("diff days", () => {
    const a = moment("2024-01-15");
    const b = moment("2024-01-20");
    expect(a.diff(b, "days")).toBe(-5);
  });

  test("diff months", () => {
    const a = moment("2024-01-15");
    const b = moment("2024-03-15");
    expect(a.diff(b, "months")).toBe(-2);
  });
});

describe("MomentLite clone", () => {
  test("clone is independent", () => {
    const a = moment("2024-01-15");
    const b = a.clone();
    b.add(1, "day");
    expect(a.date()).toBe(15);
    expect(b.date()).toBe(16);
  });
});

describe("MomentLite invalid", () => {
  test("invalid moment parsing", () => {
    const m = moment("not-a-date");
    expect(m.isValid()).toBe(false);
  });

  test("invalid moment format", () => {
    const m = moment("hello", "YYYY");
    expect(m.isValid()).toBe(false);
  });
});

describe("MomentLite get/set", () => {
  test("get with unit", () => {
    const m = moment("2024-01-15");
    expect(m.get("year")).toBe(2024);
    expect(m.get("month")).toBe(0);
    expect(m.get("date")).toBe(15);
  });

  test("set with unit and value", () => {
    const m = moment("2024-01-15");
    m.set("year", 2025);
    expect(m.year()).toBe(2025);
  });

  test("set with object", () => {
    const m = moment("2024-01-15");
    m.set({ year: 2025, month: 5 });
    expect(m.year()).toBe(2025);
    expect(m.month()).toBe(5);
  });
});

describe("MomentLite comparison edge cases", () => {
  test("isSameOrBefore", () => {
    const a = moment("2024-01-15");
    const b = moment("2024-01-15");
    expect(a.isSameOrBefore(b)).toBe(true);
    expect(a.isSameOrBefore(moment("2024-01-10"))).toBe(false);
  });

  test("isSameOrAfter", () => {
    const a = moment("2024-01-15");
    const b = moment("2024-01-15");
    expect(a.isSameOrAfter(b)).toBe(true);
    expect(a.isSameOrAfter(moment("2024-01-20"))).toBe(false);
  });

  test("isBetween", () => {
    const m = moment("2024-06-15");
    const a = moment("2024-01-01");
    const b = moment("2024-12-31");
    expect(m.isBetween(a, b)).toBe(true);
  });

  test("daysInMonth feb leap", () => {
    expect(moment("2024-02-01").daysInMonth()).toBe(29);
    expect(moment("2023-02-01").daysInMonth()).toBe(28);
  });
});

describe("MomentLite isLeapYear", () => {
  test("detects leap years", () => {
    expect(moment("2024-01-01").isLeapYear()).toBe(true);
    expect(moment("2023-01-01").isLeapYear()).toBe(false);
  });
});
