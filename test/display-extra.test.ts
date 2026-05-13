import { describe, test, expect } from "bun:test";
import moment from "../src/index.ts";

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
    expect(typeof cal).toBe("string");
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
    const cal = m.calendar(null);
    expect(typeof cal).toBe("string");
  });

  test("calendar with custom calendarFormat", () => {
    const m = moment("2024-01-15");
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
    expect(typeof m.from(ref)).toBe("string");
  });

  test("toNow", () => {
    const m = moment().add(1, "hour");
    expect(typeof m.toNow()).toBe("string");
  });

  test("to with reference", () => {
    const m = moment("2024-01-10");
    const ref = moment("2024-01-15");
    expect(typeof m.to(ref)).toBe("string");
  });

  test("invalid moment fromNow", () => {
    const m = moment("invalid");
    expect(m.fromNow()).toBe("Invalid date");
  });
});
