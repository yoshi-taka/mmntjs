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

describe("MomentLite extended-year weeks", () => {
  test("matches moment.js in local and UTC modes", () => {
    for (const year of [-400, -1, 0, 1, 4, 99, 100, 400]) {
      for (const utc of [false, true]) {
        const m = utc ? moment.utc([year, 0, 1]) : moment([year, 0, 1]);
        const o = utc ? originalMoment.utc([year, 0, 1]) : originalMoment([year, 0, 1]);
        expect(m.week()).toBe(o.week());
        expect(m.isoWeek()).toBe(o.isoWeek());
      }
    }
  });

  test("derives weekdays across the signed JS Date range", () => {
    for (const epochDays of [
      -100_000_000, -99_000_000, -89_434_797, -1, 0, 89_522_176, 99_000_000, 100_000_000,
    ]) {
      const expected = new Date(epochDays * 86400000).getUTCDay();
      expect(moment.utc(epochDays * 86400000).day()).toBe(expected);
    }
  });
});

describe("MomentLite edge cases: null/Infinity/NaN", () => {
  test("momentLite(Infinity) is invalid", () => {
    const m = moment(Infinity);
    expect(m.isValid()).toBe(false);
  });

  test("momentLite(-Infinity) is invalid", () => {
    const m = moment(-Infinity);
    expect(m.isValid()).toBe(false);
  });

  test("momentLite(NaN) is invalid", () => {
    const m = moment(NaN);
    expect(m.isValid()).toBe(false);
  });

  test("momentLite(null) is invalid", () => {
    const m = moment(null);
    expect(m.isValid()).toBe(false);
  });

  test("diff returns NaN for invalid input", () => {
    const v = moment.utc("2024-06-15");
    expect(v.diff(null)).toBe(NaN);
    expect(v.diff(Infinity)).toBe(NaN);
    expect(v.diff(-Infinity)).toBe(NaN);
  });

  test("diff returns NaN when this is invalid", () => {
    const inv = moment(null);
    expect(inv.diff(moment.utc("2024-06-15"))).toBe(NaN);
    expect(inv.diff("2024-06-15")).toBe(NaN);
  });

  test("isBefore/isAfter/isSame with Infinity returns false", () => {
    const v = moment.utc("2024-06-15");
    expect(v.isAfter(Infinity)).toBe(false);
    expect(v.isBefore(Infinity)).toBe(false);
    expect(v.isSame(Infinity)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Property-based: oracle comparison with moment.js
// ---------------------------------------------------------------------------
import fc from "fast-check";

import { assertProp } from "./properties/helpers";

const safeMin = new Date("1900-01-01");
const safeMax = new Date("2100-01-01");
const safeDates = fc.date({ min: safeMin, max: safeMax, noInvalidDate: true });
const anyInt = fc.integer({ min: -1000, max: 1000 });
const allUnits = fc.constantFrom(
  "year",
  "quarter",
  "month",
  "week",
  "day",
  "hour",
  "minute",
  "second",
  "millisecond",
);

describe("MomentLite property-based vs moment.js", () => {
  const mm = (d: Date) => moment(d);
  const om = (d: Date) => originalMoment(d);

  test("add matches moment.js", () => {
    assertProp(
      fc.property(safeDates, anyInt, allUnits, (date, amount, unit) => {
        const mmUnit = unit === "day" ? "days" : `${unit}s`;
        const a = mm(date).add(amount, mmUnit).valueOf();
        const b = om(date).add(amount, mmUnit).valueOf();
        expect(a).toBe(b);
      }),
      { numRuns: 200 },
    );
  });

  test("subtract matches moment.js", () => {
    const smallInt = fc.integer({ min: -50, max: 50 });
    assertProp(
      fc.property(safeDates, smallInt, allUnits, (date, amount, unit) => {
        const mmUnit = unit === "day" ? "days" : `${unit}s`;
        expect(mm(date).subtract(amount, mmUnit).valueOf()).toBe(
          om(date).subtract(amount, mmUnit).valueOf(),
        );
      }),
      { numRuns: 200 },
    );
  });

  const diffUnits = fc.constantFrom("week", "day", "hour", "minute", "second", "millisecond");
  test("diff matches moment.js", () => {
    assertProp(
      fc.property(safeDates, safeDates, diffUnits, (a, b, unit) => {
        const mmUnit = unit === "day" ? "days" : `${unit}s`;
        expect(mm(a).diff(mm(b), mmUnit)).toBe(om(a).diff(om(b), mmUnit));
      }),
      { numRuns: 200 },
    );
  });

  test("format matches moment.js with basic tokens", () => {
    const formats = fc.constantFrom(
      "YYYY-MM-DD",
      "HH:mm:ss",
      "YYYY-MM-DD HH:mm:ss.SSS",
      "MM/DD/YYYY",
    );
    assertProp(
      fc.property(safeDates, formats, (date, fmt) => {
        const d = mm(date);
        expect(d.format(fmt)).toBe(om(date).format(fmt));
      }),
      { numRuns: 200 },
    );
  });

  test("startOf matches moment.js", () => {
    const startUnits = fc.constantFrom("year", "month", "day", "hour", "minute", "second");
    assertProp(
      fc.property(safeDates, startUnits, (date, unit) => {
        expect(mm(date).startOf(unit).valueOf()).toBe(om(date).startOf(unit).valueOf());
      }),
      { numRuns: 200 },
    );
  });

  test("endOf matches moment.js", () => {
    const endUnits = fc.constantFrom("year", "month", "day", "hour", "minute", "second");
    assertProp(
      fc.property(safeDates, endUnits, (date, unit) => {
        expect(mm(date).endOf(unit).valueOf()).toBe(om(date).endOf(unit).valueOf());
      }),
      { numRuns: 200 },
    );
  });
});

// ---------------------------------------------------------------------------
// Metamorphic: round-trip, idempotence
// ---------------------------------------------------------------------------
describe("MomentLite metamorphic", () => {
  const d = moment("2024-06-15T10:30:45.123");

  test("add/subtract round-trip", () => {
    const units = [
      "year",
      "month",
      "quarter",
      "week",
      "day",
      "hour",
      "minute",
      "second",
      "millisecond",
    ];
    for (const unit of units) {
      const m = d.clone().add(3, unit).subtract(3, unit);
      expect(m.valueOf()).toBe(d.valueOf());
    }
  });

  test("startOf idempotence", () => {
    const units = ["year", "month", "day", "hour", "minute", "second"];
    for (const unit of units) {
      const once = d.clone().startOf(unit);
      const twice = once.clone().startOf(unit);
      expect(twice.valueOf()).toBe(once.valueOf());
    }
  });

  test("endOf idempotence", () => {
    const units = ["year", "month", "day", "hour", "minute", "second"];
    for (const unit of units) {
      const once = d.clone().endOf(unit);
      const twice = once.clone().endOf(unit);
      expect(twice.valueOf()).toBe(once.valueOf());
    }
  });

  test("startOf <= original <= endOf", () => {
    const units = ["year", "month", "day"];
    for (const unit of units) {
      const m = moment("2024-06-15T10:30:45");
      const s = m.clone().startOf(unit).valueOf();
      const e = m.clone().endOf(unit).valueOf();
      expect(s).toBeLessThanOrEqual(m.valueOf());
      expect(m.valueOf()).toBeLessThanOrEqual(e);
    }
  });
});

// ---------------------------------------------------------------------------
// Boundary values
// ---------------------------------------------------------------------------
describe("MomentLite boundaries", () => {
  test("leap year Feb 29 add month", () => {
    const m = moment("2020-02-29");
    m.add(1, "month");
    expect(m.format("MM-DD")).toBe("03-29");
  });

  test("leap year Feb 29 add year to non-leap clamps", () => {
    const m = moment("2020-02-29");
    m.add(1, "year");
    expect(m.format("MM-DD")).toBe("02-28");
  });

  test("year 2038 boundary", () => {
    const m = moment("2038-01-19T03:14:07");
    m.add(1, "second");
    expect(m.format("YYYY-MM-DD HH:mm:ss")).toBe("2038-01-19 03:14:08");
  });

  test("diff across month boundary", () => {
    expect(moment("2024-01-31").diff(moment("2024-02-01"), "days")).toBe(-1);
    expect(moment("2024-02-01").diff(moment("2024-01-31"), "days")).toBe(1);
  });

  test("Dec 31 add 1 day crosses year", () => {
    const m = moment("2024-12-31");
    m.add(1, "day");
    expect(m.format("YYYY-MM-DD")).toBe("2025-01-01");
  });

  test("Jan 1 subtract 1 day crosses year", () => {
    const m = moment("2024-01-01");
    m.subtract(1, "day");
    expect(m.format("YYYY-MM-DD")).toBe("2023-12-31");
  });
});

// ---------------------------------------------------------------------------
// Equivalence partitioning
// ---------------------------------------------------------------------------
describe("MomentLite equivalence", () => {
  test("month valid indices", () => {
    for (const m of [0, 6, 11]) {
      const d = moment("2024-01-15").month(m);
      expect(d.month()).toBe(m);
    }
  });

  test("day safe (1-28) vs boundary (29-31)", () => {
    expect(moment("2024-01-28").add(1, "day").date()).toBe(29);
    expect(moment("2024-01-29").add(1, "day").date()).toBe(30);
    expect(moment("2024-01-30").add(1, "day").date()).toBe(31);
    expect(moment("2024-01-31").add(1, "day").date()).toBe(1);
  });

  test("hour/min/sec/ms boundaries", () => {
    expect(moment("2024-01-01 23:00").add(1, "hour").hour()).toBe(0);
    expect(moment("2024-01-01 00:59").add(1, "minute").minute()).toBe(0);
    expect(moment("2024-01-01 00:00:59").add(1, "second").second()).toBe(0);
    expect(moment("2024-01-01 00:00:00.999").add(1, "millisecond").millisecond()).toBe(0);
  });

  test("quarter getter partitions", () => {
    const cases: [number, number, number][] = [
      [1, 1, 1],
      [4, 1, 2],
      [7, 1, 3],
      [10, 1, 4],
    ];
    for (const [month, day, expectedQ] of cases) {
      expect(
        moment(`2024-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`).quarter(),
      ).toBe(expectedQ);
    }
  });
});

// ---------------------------------------------------------------------------
// Additional coverage: plural aliases, toIsoString, weekday, utc/local/utcOffset, object syntax
// ---------------------------------------------------------------------------
describe("MomentLite plural aliases", () => {
  test("years alias", () => {
    const m = moment("2024-06-15");
    expect(m.years()).toBe(2024);
    m.years(2025);
    expect(m.year()).toBe(2025);
  });

  test("months alias", () => {
    const m = moment("2024-06-15");
    expect(m.months()).toBe(5);
    m.months(0);
    expect(m.month()).toBe(0);
  });

  test("dates alias", () => {
    const m = moment("2024-06-15");
    expect(m.dates()).toBe(15);
    m.dates(20);
    expect(m.date()).toBe(20);
  });

  test("days alias", () => {
    const m = moment("2024-06-15");
    expect(typeof m.days()).toBe("number");
  });

  test("hours alias", () => {
    const m = moment("2024-06-15T10:00:00");
    expect(m.hours()).toBe(10);
    m.hours(12);
    expect(m.hour()).toBe(12);
  });

  test("minutes alias", () => {
    const m = moment("2024-06-15T10:30:00");
    expect(m.minutes()).toBe(30);
    m.minutes(45);
    expect(m.minute()).toBe(45);
  });

  test("seconds alias", () => {
    const m = moment("2024-06-15T10:30:45");
    expect(m.seconds()).toBe(45);
    m.seconds(50);
    expect(m.second()).toBe(50);
  });

  test("milliseconds alias", () => {
    const m = moment("2024-06-15T10:30:45.123");
    expect(m.milliseconds()).toBe(123);
    m.milliseconds(456);
    expect(m.millisecond()).toBe(456);
  });

  test("quarters alias", () => {
    const m = moment("2024-06-15");
    expect(m.quarters()).toBe(2);
    m.quarters(4);
    expect(m.quarter()).toBe(4);
  });
});

describe("MomentLite toIsoString", () => {
  test("toIsoString returns same as toISOString", () => {
    const m = moment("2024-06-15T10:30:00");
    expect(m.toIsoString()).toBe(m.toISOString());
  });
});

describe("MomentLite weekday / utc / local / utcOffset", () => {
  test("weekday getter returns 0-6", () => {
    const m = moment("2024-06-15"); // Saturday
    expect(m.weekday()).toBe(6);
  });

  test("weekday setter changes day of week", () => {
    const m = moment("2024-06-15");
    m.weekday(0); // Sunday
    expect(m.weekday()).toBe(0);
  });

  test("utc() converts to UTC mode", () => {
    const m = moment("2024-06-15T10:30:00");
    m.utc();
    expect(m.utcOffset()).toBe(0);
  });

  test("utc() with keepLocalTime", () => {
    const m = moment("2024-06-15T10:30:00");
    m.utc(true);
    expect(m.utcOffset()).toBe(0);
  });

  test("local() converts back to local mode", () => {
    const m = moment.utc("2024-06-15T10:30:00");
    expect(m.utcOffset()).toBe(0);
    m.local();
    expect(m.utcOffset()).not.toBe(0);
  });

  test("local() with keepLocalTime", () => {
    const m = moment.utc("2024-06-15T10:30:00");
    m.local(true);
    expect(typeof m.utcOffset()).toBe("number");
  });

  test("utcOffset getter", () => {
    const m = moment("2024-06-15");
    expect(typeof m.utcOffset()).toBe("number");
  });

  test("utcOffset setter with number", () => {
    const m = moment("2024-06-15T10:00:00");
    m.utcOffset(120);
    expect(m.utcOffset()).toBe(120);
  });

  test("utcOffset setter with string", () => {
    const m = moment("2024-06-15T10:00:00");
    m.utcOffset("+05:30");
    expect(m.utcOffset()).toBe(330);
  });

  test("utcOffset setter with invalid string returns unchanged", () => {
    const m = moment("2024-06-15T10:00:00");
    const prev = m.utcOffset();
    m.utcOffset("invalid" as never);
    expect(m.utcOffset()).toBe(prev);
  });
});

describe("MomentLite add/subtract with object syntax", () => {
  test("add object with days", () => {
    const m = moment("2024-06-15");
    m.add({ days: 5 });
    expect(m.date()).toBe(20);
  });

  test("add object with months", () => {
    const m = moment("2024-06-15");
    m.add({ months: 2 });
    expect(m.month()).toBe(7);
  });

  test("add object with multiple units", () => {
    const m = moment("2024-06-15");
    m.add({ days: 10, hours: 5 });
    expect(m.date()).toBe(25);
    expect(m.hour()).toBe(5);
  });

  test("subtract object with days", () => {
    const m = moment("2024-06-15");
    m.subtract({ days: 5 });
    expect(m.date()).toBe(10);
  });

  test("duration-like object (has _milliseconds) add", () => {
    const m = moment("2024-06-15");
    m.add({ _milliseconds: 86400000 });
    expect(m.date()).toBe(16);
  });
});

describe("MomentLite set with additional properties", () => {
  test("set quarter via object", () => {
    const m = moment("2024-01-15");
    m.set({ quarter: 3 });
    expect(m.month()).toBe(6);
  });

  test("set weekday via object", () => {
    const m = moment("2024-06-15");
    m.set({ weekday: 0 });
    expect(m.weekday()).toBe(0);
  });

  test("set isoWeek via object", () => {
    const m = moment("2024-01-15");
    m.set({ isoWeek: 10 });
    expect(m.isoWeek()).toBe(10);
  });

  test("set dayOfYear via object", () => {
    const m = moment("2024-01-15");
    m.set({ dayOfYear: 100 });
    expect(m.dayOfYear()).toBe(100);
  });

  test("set isoWeekYear via object", () => {
    const m = moment("2024-01-15");
    m.set({ isoWeekYear: 2025 });
    expect(m.isoWeekYear()).toBe(2025);
  });
});

describe("MomentLite get additional units", () => {
  test("get isoWeekday", () => {
    const m = moment("2024-06-15");
    expect(m.get("isoWeekday")).toBe(6);
  });

  test("get isoWeekYear", () => {
    const m = moment("2024-01-01");
    expect(m.get("isoWeekYear")).toBeGreaterThan(0);
  });
});

describe("MomentLite month with locale string", () => {
  test("month setter with english month name", () => {
    const m = moment("2024-06-15");
    m.month("January");
    expect(m.month()).toBe(0);
  });

  test("month setter with english month short name", () => {
    const m = moment("2024-06-15");
    m.month("Feb");
    expect(m.month()).toBe(1);
  });

  test("month setter with unknown month name returns unchanged", () => {
    const m = moment("2024-06-15");
    m.month("notamonth");
    expect(m.month()).toBe(5);
  });
});

describe("MomentLite day setter with locale string", () => {
  test("day setter with english day name", () => {
    const m = moment("2024-06-15"); // Saturday
    m.day("Sunday");
    expect(m.day()).toBe(0);
  });
});
