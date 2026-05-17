import { describe, test, expect } from "bun:test";
import fc from "fast-check";
import moment from "../src/index.ts";
import originalMoment from "../moment/moment.js";

type CalendarOverrideMoment = ReturnType<typeof moment> & {
  calendarFormat?: () => string;
};

describe("calendar", () => {
  test("default calendar (same day)", () => {
    const m = moment();
    const cal = m.calendar();
    expect(typeof cal).toBe("string");
  });

  test("calendar with reference date", () => {
    const m = moment("2024-01-15");
    const ref = moment("2024-01-10");
    const cal = m.calendar(ref);
    expect(cal).toBe(originalMoment("2024-01-15").calendar(originalMoment("2024-01-10")));
  });

  test("calendar with format options object", () => {
    const m = moment("2024-01-15");
    const cal = m.calendar({
      sameDay: "[Today]",
      nextDay: "[Tomorrow]",
      lastDay: "[Yesterday]",
      nextWeek: "dddd",
      lastWeek: "[Last] dddd",
      sameElse: "YYYY-MM-DD",
    });
    expect(typeof cal).toBe("string");
  });

  test("calendar with ref and opts", () => {
    const m = moment("2024-01-15");
    const ref = moment("2024-01-10");
    const cal = m.calendar(ref, {
      sameDay: "[Today]",
      sameElse: "YYYY-MM-DD",
    });
    expect(typeof cal).toBe("string");
  });

  test("calendar with ref as null", () => {
    const m = moment("2024-01-15");
    const cal = m.calendar(null as unknown as undefined);
    expect(cal).toBe(originalMoment("2024-01-15").calendar(null as unknown as undefined));
  });

  test("calendar with custom calendarFormat", () => {
    const m = moment("2024-01-15") as CalendarOverrideMoment;
    m.calendarFormat = () => "sameElse";
    const cal = m.calendar();
    expect(typeof cal).toBe("string");
  });

  test("calendar with cal as function", () => {
    const m = moment("2024-01-15");
    const cal = m.calendar({
      sameDay: () => "[Custom Today]",
      sameElse: "YYYY-MM-DD",
    });
    expect(typeof cal).toBe("string");
  });
});

describe("from / to", () => {
  test("fromNow", () => {
    const m = moment().subtract(1, "hour");
    const str = m.fromNow();
    expect(typeof str).toBe("string");
  });

  test("from with reference", () => {
    const m = moment("2024-01-15");
    const ref = moment("2024-01-10");
    expect(m.from(ref)).toBe(originalMoment("2024-01-15").from(originalMoment("2024-01-10")));
  });

  test("toNow", () => {
    const m = moment().add(1, "hour");
    expect(typeof m.toNow()).toBe("string");
  });

  test("to with reference", () => {
    const m = moment("2024-01-10");
    const ref = moment("2024-01-15");
    expect(m.to(ref)).toBe(originalMoment("2024-01-10").to(originalMoment("2024-01-15")));
  });

  test("invalid moment fromNow", () => {
    const m = moment("invalid");
    expect(m.fromNow()).toBe("Invalid date");
  });
});

describe("property-based display patterns", () => {
  const safeMin = new Date("1900-01-01");
  const safeMax = new Date("2100-01-01");
  const safeDates = fc.date({ min: safeMin, max: safeMax, noInvalidDate: true });
  const datePairs = fc.tuple(safeDates, safeDates);
  const formatTokens = fc.constantFrom(
    "YYYY-MM-DD",
    "YYYY-MM-DD HH:mm:ss",
    "MMMM Do YYYY",
    "dddd, MMMM Do YYYY",
    "h:mm A",
    "HH:mm:ss.SSS",
    "LT",
    "L",
    "LL",
    "ll",
  );
  const relAmounts = fc.integer({ min: -100000, max: 100000 });
  const relUnits = fc.constantFrom(
    "milliseconds",
    "seconds",
    "minutes",
    "hours",
    "days",
    "weeks",
    "months",
    "years",
  );

  test("calendar with random date pairs matches moment.js", () => {
    fc.assert(
      fc.property(datePairs, ([d1, d2]) => {
        const m = moment(d1);
        const o = originalMoment(d1);
        const ref = moment(d2);
        const oref = originalMoment(d2);
        expect(m.calendar(ref)).toBe(o.calendar(oref));
      }),
      { numRuns: 100 },
    );
  });

  test("format with random token matches moment.js", () => {
    fc.assert(
      fc.property(safeDates, formatTokens, (d, fmt) => {
        const m = moment(d);
        const o = originalMoment(d);
        expect(m.format(fmt)).toBe(o.format(fmt));
      }),
      { numRuns: 200 },
    );
  });

  test("from with random pairs matches moment.js", () => {
    fc.assert(
      fc.property(datePairs, ([d1, d2]) => {
        const m1 = moment(d1);
        const o1 = originalMoment(d1);
        const m2 = moment(d2);
        const o2 = originalMoment(d2);
        expect(m1.from(m2)).toBe(o1.from(o2));
      }),
      { numRuns: 100 },
    );
  });

  test("to with random pairs matches moment.js", () => {
    fc.assert(
      fc.property(datePairs, ([d1, d2]) => {
        const m1 = moment(d1);
        const o1 = originalMoment(d1);
        const m2 = moment(d2);
        const o2 = originalMoment(d2);
        expect(m1.to(m2)).toBe(o1.to(o2));
      }),
      { numRuns: 100 },
    );
  });

  test("fromNow with random offset matches moment.js", () => {
    fc.assert(
      fc.property(safeDates, relAmounts, relUnits, (d, amount, unit) => {
        const m = moment(d).add(amount, unit as moment.unitOfTime.DurationConstructor);
        const o = originalMoment(d).add(amount, unit as moment.unitOfTime.DurationConstructor);
        expect(m.fromNow()).toBe(o.fromNow());
      }),
      { numRuns: 100 },
    );
  });

  test("from(a,b) without suffix equals to(b,a) without suffix", () => {
    fc.assert(
      fc.property(datePairs, ([d1, d2]) => {
        const m1 = moment(d1);
        const m2 = moment(d2);
        const fromVal = m1.from(m2, true);
        const toVal = m2.to(m1, true);
        expect(fromVal).toBe(toVal);
      }),
      { numRuns: 50 },
    );
  });
});
