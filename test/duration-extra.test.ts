import { describe, test, expect } from "bun:test";
import fc from "fast-check";
import moment from "../src/index.ts";

describe("Duration constructor edge cases", () => {
  test("from ISO string P1Y2M3DT4H5M6S", () => {
    const d = moment.duration("P1Y2M3DT4H5M6S");
    expect(d.years()).toBe(1);
    expect(d.months()).toBe(2);
    expect(d.days()).toBe(3);
    expect(d.hours()).toBe(4);
    expect(d.minutes()).toBe(5);
    expect(d.seconds()).toBe(6);
  });

  test("from ISO string with weeks", () => {
    const d = moment.duration("P2W");
    expect(d.days()).toBe(14);
  });

  test("from ISO string with milliseconds", () => {
    const d = moment.duration("PT1.5S");
    expect(d.seconds()).toBe(1);
    expect(d.milliseconds()).toBe(500);
  });

  test("from C# TimeSpan format", () => {
    const d = moment.duration("1.02:03:04.005");
    expect(d.days()).toBe(1);
    expect(d.hours()).toBe(2);
    expect(d.minutes()).toBe(3);
    expect(d.seconds()).toBe(4);
    expect(d.milliseconds()).toBe(5);
  });

  test("invalid ISO string returns invalid", () => {
    const d = moment.duration("not-a-duration");
    expect(d.isValid()).toBe(false);
  });

  test("from empty object", () => {
    const d = moment.duration({});
    expect(d.isValid()).toBe(true);
    expect(d.asMilliseconds()).toBe(0);
  });

  test("from object with units", () => {
    const d = moment.duration({ hours: 2, minutes: 30 });
    expect(d.asMinutes()).toBe(150);
  });

  test("from number (ms)", () => {
    const d = moment.duration(3600000);
    expect(d.hours()).toBe(1);
  });

  test("from undefined returns zero duration", () => {
    const d = moment.duration();
    expect(d.isValid()).toBe(true);
    expect(d.asMilliseconds()).toBe(0);
  });
});

describe("Duration abs", () => {
  test("negative duration becomes positive", () => {
    const d = moment.duration(-3600000);
    expect(d.asHours()).toBe(-1);
    d.abs();
    expect(d.asHours()).toBe(1);
  });

  test("positive duration stays positive", () => {
    const d = moment.duration(3600000);
    d.abs();
    expect(d.asHours()).toBe(1);
  });
});

describe("Duration round", () => {
  test("default rounds to nearest millisecond", () => {
    const d = moment.duration(1500);
    d.round();
    expect(d.asMilliseconds()).toBe(1500);
  });

  test("round seconds", () => {
    const d = moment.duration(6500);
    d.round({ smallestUnit: "seconds" });
    expect(d.seconds()).toBe(7);
  });

  test("round to nearest minute", () => {
    const d = moment.duration(125000);
    d.round({ smallestUnit: "minute", roundingMode: "halfExpand" });
    expect(d.minutes()).toBe(2);
  });

  test("round ceil mode", () => {
    const d = moment.duration(100);
    d.round({ smallestUnit: "second", roundingMode: "ceil" });
    expect(d.seconds()).toBe(1);
  });

  test("round floor mode", () => {
    const d = moment.duration(1800);
    d.round({ smallestUnit: "second", roundingMode: "floor" });
    expect(d.seconds()).toBe(1);
  });

  test("round trunc mode", () => {
    const d = moment.duration(-500);
    d.round({ smallestUnit: "second", roundingMode: "trunc" });
    expect(d.asMilliseconds()).toBe(0);
  });

  test("round with custom increment", () => {
    const d = moment.duration(7500);
    d.round({ smallestUnit: "second", roundingIncrement: 5 });
    expect(d.seconds()).toBe(10);
  });

  test("round hours", () => {
    const d = moment.duration(5400000);
    d.round({ smallestUnit: "hour" });
    expect(d.hours()).toBe(2);
  });

  test("round days", () => {
    const d = moment.duration(90000000);
    d.round({ smallestUnit: "day" });
    expect(d.days()).toBe(1);
  });

  test("round weeks", () => {
    const d = moment.duration(432000000);
    d.round({ smallestUnit: "week" });
    expect(d.days()).toBe(7);
  });

  test("round months", () => {
    const d = moment.duration(45, "days");
    d.round({ smallestUnit: "month" });
    expect(d.months()).toBe(1);
  });

  test("round years", () => {
    const d = moment.duration(400, "days");
    d.round({ smallestUnit: "year" });
    expect(d.years()).toBe(1);
  });

  test("round quarter", () => {
    const d = moment.duration(100, "days");
    d.round({ smallestUnit: "quarter", roundingMode: "halfExpand" });
    expect(d.months()).toBe(3);
  });

  test("round invalid duration returns self", () => {
    const d = moment.duration(NaN);
    expect(d.isValid()).toBe(false);
    d.round({ smallestUnit: "second" });
    expect(d.isValid()).toBe(false);
  });

  test("round with ms shorthand", () => {
    const d = moment.duration(5000);
    d.round({ smallestUnit: "ms", roundingIncrement: 1000 });
    expect(d.asMilliseconds()).toBe(5000);
  });

  test("round with s shorthand", () => {
    const d = moment.duration(3500);
    d.round({ smallestUnit: "s", roundingMode: "halfExpand" });
    expect(d.seconds()).toBe(4);
  });

  test("round with m shorthand", () => {
    const d = moment.duration(185000);
    d.round({ smallestUnit: "m" });
    expect(d.minutes()).toBe(3);
  });

  test("round with h shorthand", () => {
    const d = moment.duration(10800000);
    d.round({ smallestUnit: "h" });
    expect(d.hours()).toBe(3);
  });

  test("round with d shorthand", () => {
    const d = moment.duration(172800000);
    d.round({ smallestUnit: "d" });
    expect(d.days()).toBe(2);
  });

  test("round with w shorthand", () => {
    const d = moment.duration(864000000);
    d.round({ smallestUnit: "w" });
    expect(d.days()).toBe(7);
  });

  test("round with M shorthand", () => {
    const d = moment.duration(60, "days");
    d.round({ smallestUnit: "M" });
    expect(d.months()).toBe(2);
  });

  test("round with y shorthand", () => {
    const d = moment.duration(730, "days");
    d.round({ smallestUnit: "y" });
    expect(d.years()).toBe(2);
  });

  test("round with Q shorthand", () => {
    const d = moment.duration(100, "days");
    d.round({ smallestUnit: "Q" });
    expect(d.months()).toBe(3);
  });

  test("round day with 0 increment", () => {
    const d = moment.duration(86400000);
    d.round({ smallestUnit: "day", roundingIncrement: 1 });
    expect(d.days()).toBe(1);
  });
});

describe("Duration as(unit)", () => {
  test("asYears", () => {
    const d = moment.duration(365, "days");
    expect(d.asYears()).toBeCloseTo(1, 2);
  });

  test("asQuarters", () => {
    const d = moment.duration(6, "months");
    expect(d.asQuarters()).toBe(2);
  });

  test("asWeeks", () => {
    const d = moment.duration(14, "days");
    expect(d.asWeeks()).toBe(2);
  });
});

describe("property-based duration patterns", () => {
  const safeMsec = fc.integer({ min: -86400000 * 365 * 5, max: 86400000 * 365 * 5 });
  const durUnits = fc.constantFrom(
    "milliseconds",
    "seconds",
    "minutes",
    "hours",
    "days",
    "weeks",
    "months",
    "years",
  );
  const durAmounts = fc.integer({ min: -10000, max: 10000 });
  const roundUnits = fc.constantFrom("s", "m", "h", "d", "w", "M", "y", "ms");
  const roundModes = fc.constantFrom("halfExpand", "floor", "ceil", "trunc");
  // Fixed-value units: month/year/quarter are calendar-based, not fixed ms
  const fixedDurUnits = fc.constantFrom(
    "milliseconds",
    "seconds",
    "minutes",
    "hours",
    "days",
    "weeks",
  );

  test("duration from object getters", () => {
    fc.assert(
      fc.property(durUnits, durAmounts, (unit, amount) => {
        const d = moment.duration(amount, unit as moment.unitOfTime.DurationConstructor);
        expect(d.isValid()).toBe(true);
        const getter = unit.replace(/s$/, "") as keyof typeof d;
        if (typeof d[getter] === "function") {
          expect(typeof (d[getter] as () => number)()).toBe("number");
        }
      }),
      { numRuns: 200 },
    );
  });

  test("duration as(unit) returns finite number", () => {
    fc.assert(
      fc.property(safeMsec, durUnits, (ms, unit) => {
        const d = moment.duration(ms);
        const as = d.as(unit as moment.unitOfTime.DurationConstructor);
        expect(typeof as).toBe("number");
        expect(isFinite(as)).toBe(true);
      }),
      { numRuns: 200 },
    );
  });

  test("duration round-trip: adding fixed-unit duration preserves ms", () => {
    fc.assert(
      fc.property(durAmounts, fixedDurUnits, (amount, unit) => {
        const d = moment.duration(amount, unit as moment.unitOfTime.DurationConstructor);
        const ms = d.asMilliseconds();
        const m = moment(0).add(d);
        expect(m.valueOf()).toBe(ms);
      }),
      { numRuns: 100 },
    );
  });

  test("duration humanize is a string", () => {
    fc.assert(
      fc.property(safeMsec, (ms) => {
        const d = moment.duration(ms);
        const h = d.humanize();
        expect(typeof h).toBe("string");
      }),
      { numRuns: 100 },
    );
  });

  test("duration round with various units", () => {
    fc.assert(
      fc.property(safeMsec, roundUnits, roundModes, (ms, unit, mode) => {
        const d = moment.duration(ms);
        d.round({ smallestUnit: unit as "s", roundingMode: mode as "halfExpand" });
        expect(d.isValid()).toBe(true);
        expect(d.asMilliseconds()).toBeGreaterThanOrEqual(-Math.abs(ms) - 86400000 * 365);
      }),
      { numRuns: 100 },
    );
  });
});
