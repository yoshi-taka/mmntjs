import { describe, test, expect } from "bun:test";
import moment from "../src/index.ts";
import originalMoment from "../moment/moment.js";

describe("formatFrom/formatTo (display/extra.ts) branch coverage", () => {
  test("fromNow on invalid moment returns Invalid date", () => {
    const m = moment("invalid");
    expect(m.fromNow()).toBe("Invalid date");
  });

  test("from with null/undefined reference returns a string", () => {
    const m = moment("2024-06-15");
    const fromNull = m.from(null as unknown as string);
    expect(typeof fromNull).toBe("string");
    expect(fromNull.length).toBeGreaterThan(0);

    const fromUndef = m.from(undefined as unknown as string);
    expect(typeof fromUndef).toBe("string");
  });

  test("to with null/undefined reference returns a string", () => {
    const m = moment("2024-06-15");
    const toNull = m.to(null as unknown as string);
    expect(typeof toNull).toBe("string");
    expect(toNull.length).toBeGreaterThan(0);
  });

  test("fromNow/toNow for far-future dates", () => {
    const m = moment("2099-01-01");
    expect(typeof m.fromNow()).toBe("string");
    expect(typeof m.toNow()).toBe("string");
  });
});

describe("calendar (display/extra.ts) branch coverage", () => {
  test("calendar with null reference returns output", () => {
    const m = moment("2024-06-15");
    const cal = m.calendar(null as unknown as undefined);
    expect(typeof cal).toBe("string");
    expect(cal.length).toBeGreaterThan(0);
  });

  test("calendar with array reference", () => {
    const m = moment("2024-06-15");
    const ref = [2024, 5, 10] as unknown as moment.MomentInput;
    const cal = m.calendar(ref);
    const ocal = originalMoment("2024-06-15").calendar(originalMoment(ref as unknown as number[]));
    expect(cal).toBe(ocal);
  });

  test("calendar with Moment.calendarFormat override", () => {
    const date = new Date("2024-06-15");
    const m = moment(date);
    const ref = moment(date);
    ref.add(-10, "days");
    const cal = m.calendar(ref);
    expect(typeof cal).toBe("string");
    expect(cal.length).toBeGreaterThan(0);
  });

  test("calendar with custom cal as function", () => {
    const m = moment("2024-06-15");
    const cal = m.calendar({
      sameDay: () => "[Today]",
      sameElse: "YYYY-MM-DD",
    });
    expect(typeof cal).toBe("string");
  });

  test("calendar with all calendar keys set to format strings", () => {
    const m = moment("2024-06-15");
    const cal = m.calendar({
      sameDay: "[Today]",
      nextDay: "[Tomorrow]",
      nextWeek: "dddd",
      lastDay: "[Yesterday]",
      lastWeek: "[Last] dddd",
      sameElse: "YYYY-MM-DD",
    });
    expect(typeof cal).toBe("string");
  });

  test("calendar with formatOpts override function", () => {
    const m = moment("2024-06-15");
    const cal = m.calendar(null as unknown as undefined, {
      sameDay: "[Today]",
      sameElse: "YYYY-MM-DD",
    });
    expect(typeof cal).toBe("string");
  });
});
