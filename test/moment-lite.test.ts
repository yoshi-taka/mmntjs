import { describe, test, expect } from "bun:test";
import liteMoment from "../src/entry/lite.ts";
import originalMoment from "../moment/moment.js";

type LiteMomentFn = typeof liteMoment & {
  utc(input?: unknown, format?: unknown, strict?: unknown): ReturnType<typeof liteMoment>;
};

const moment = liteMoment as unknown as LiteMomentFn;

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

describe("MomentLite quarter", () => {
  test("quarter getter", () => {
    expect(moment("2024-01-15").quarter()).toBe(1);
    expect(moment("2024-04-15").quarter()).toBe(2);
    expect(moment("2024-07-15").quarter()).toBe(3);
    expect(moment("2024-10-15").quarter()).toBe(4);
  });

  test("quarter setter", () => {
    const m = moment("2024-01-15");
    m.quarter(3);
    expect(m.quarter()).toBe(3);
    expect(m.month()).toBe(6);
  });
});

describe("MomentLite dayOfYear", () => {
  test("dayOfYear getter", () => {
    expect(moment("2024-01-01").dayOfYear()).toBe(1);
    expect(moment("2024-12-31").dayOfYear()).toBe(366);
    expect(moment("2023-12-31").dayOfYear()).toBe(365);
  });

  test("dayOfYear setter", () => {
    const m = moment("2024-01-15");
    m.dayOfYear(32);
    expect(m.dayOfYear()).toBe(32);
  });
});

describe("MomentLite week", () => {
  test("week getter", () => {
    expect(moment("2024-01-01").week()).toBe(originalMoment("2024-01-01").week());
  });

  test("week setter", () => {
    const m = moment("2024-06-15");
    const o = originalMoment("2024-06-15");
    m.week(10);
    o.week(10);
    expect(m.week()).toBe(o.week());
    expect(m.format("YYYY-MM-DD")).toBe(o.format("YYYY-MM-DD"));
  });
});

describe("MomentLite isoWeek", () => {
  test("isoWeek getter", () => {
    expect(moment("2024-01-01").isoWeek()).toBe(originalMoment("2024-01-01").isoWeek());
  });

  test("isoWeek setter", () => {
    const m = moment("2024-06-15");
    const o = originalMoment("2024-06-15");
    m.isoWeek(10);
    o.isoWeek(10);
    expect(m.isoWeek()).toBe(o.isoWeek());
    expect(m.format("YYYY-MM-DD")).toBe(o.format("YYYY-MM-DD"));
  });
});



describe("MomentLite add various units", () => {
  test("add quarters", () => {
    const m = moment("2024-01-15");
    m.add(1, "quarter");
    expect(m.month()).toBe(3);
  });

  test("add weeks", () => {
    const m = moment("2024-01-15");
    m.add(2, "weeks");
    expect(m.date()).toBe(29);
  });

  test("add hours", () => {
    const m = moment("2024-01-15T10:00:00");
    m.add(3, "hours");
    expect(m.hour()).toBe(13);
  });

  test("add minutes", () => {
    const m = moment("2024-01-15T10:30:00");
    m.add(15, "minutes");
    expect(m.minute()).toBe(45);
  });

  test("add seconds", () => {
    const m = moment("2024-01-15T10:30:00");
    m.add(30, "seconds");
    expect(m.second()).toBe(30);
  });

  test("add milliseconds", () => {
    const m = moment("2024-01-15T10:30:00.500");
    m.add(500, "milliseconds");
    expect(m.millisecond()).toBe(0);
  });
});

describe("MomentLite toString", () => {
  test("toString format", () => {
    const m = moment("2024-01-15T10:30:00");
    const str = m.toString();
    expect(str).toContain("2024");
    expect(str).toContain("Jan");
    expect(str).toContain("15");
  });
});



describe("MomentLite isoWeekYear", () => {
  test("isoWeekYear getter", () => {
    expect(moment("2024-01-01").isoWeekYear()).toBe(originalMoment("2024-01-01").isoWeekYear());
  });

  test("isoWeekYear setter", () => {
    const m = moment("2024-06-15");
    const o = originalMoment("2024-06-15");
    m.isoWeekYear(2023);
    o.isoWeekYear(2023);
    expect(m.isoWeekYear()).toBe(o.isoWeekYear());
    expect(m.format("YYYY-MM-DD")).toBe(o.format("YYYY-MM-DD"));
  });
});
