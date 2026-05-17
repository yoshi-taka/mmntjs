import { describe, test, expect } from "bun:test";
import moment from "../src/index.ts";
import originalMoment from "../moment/moment.js";

describe("isoWeekdayMoment (calendar-extra.ts) branch coverage", () => {
  test("isoWeekday with string 'monday' matches moment.js", () => {
    const m = moment("2024-06-15");
    const o = originalMoment("2024-06-15");
    m.isoWeekday("monday" as unknown as number);
    o.isoWeekday("monday" as unknown as number);
    expect(m.isoWeekday()).toBe(o.isoWeekday());
    expect(m.valueOf()).toBe(o.valueOf());
  });

  test("isoWeekday with string 'sun' matches moment.js", () => {
    const m = moment("2024-06-15");
    const o = originalMoment("2024-06-15");
    m.isoWeekday("sun" as unknown as number);
    o.isoWeekday("sun" as unknown as number);
    expect(m.isoWeekday()).toBe(o.isoWeekday());
    expect(m.valueOf()).toBe(o.valueOf());
  });

  test("isoWeekday with unknown string returns self unchanged", () => {
    const m = moment("2024-06-15");
    const d = new Date(m.valueOf());
    m.isoWeekday("foobar" as unknown as number);
    expect(m.valueOf()).toBe(d.getTime());
  });

  test("isoWeekday with UTC moment matches moment.js", () => {
    const m = moment.utc("2024-06-15");
    const o = originalMoment.utc("2024-06-15");
    m.isoWeekday(3);
    o.isoWeekday(3);
    expect(m.isoWeekday()).toBe(o.isoWeekday());
    expect(m.format()).toBe(o.format());
  });
});

describe("dayOfYearMoment (calendar-extra.ts) branch coverage", () => {
  test("dayOfYear setter with UTC moment matches moment.js", () => {
    const m = moment.utc("2024-06-15");
    const o = originalMoment.utc("2024-06-15");
    m.dayOfYear(200);
    o.dayOfYear(200);
    expect(m.dayOfYear()).toBe(o.dayOfYear());
    expect(m.format("MM-DD")).toBe(o.format("MM-DD"));
  });
});

describe("isoWeekMoment (calendar-extra.ts) branch coverage", () => {
  test("isoWeek setter with UTC moment matches moment.js", () => {
    const m = moment.utc("2024-06-15");
    const o = originalMoment.utc("2024-06-15");
    m.isoWeek(20);
    o.isoWeek(20);
    expect(m.isoWeek()).toBe(o.isoWeek());
    expect(m.format("YYYY-MM-DD")).toBe(o.format("YYYY-MM-DD"));
  });
});

describe("isoWeekYearMoment (calendar-extra.ts) branch coverage", () => {
  test("isoWeekYear setter with UTC moment", () => {
    const m = moment.utc("2024-06-15");
    const o = originalMoment.utc("2024-06-15");
    m.isoWeekYear(2025);
    o.isoWeekYear(2025);
    expect(m.isoWeekYear()).toBe(o.isoWeekYear());
    expect(m.valueOf()).toBe(o.valueOf());
  });
});

describe("isoWeeksInISOWeekYearMoment (calendar-extra.ts) branch coverage", () => {
  test("isoWeeksInISOWeekYear matches moment.js", () => {
    const dates = ["2024-06-15", "2023-01-01", "2025-12-31"];
    for (const d of dates) {
      const m = moment(d);
      const o = originalMoment(d);
      expect(m.isoWeeksInYear()).toBe(o.isoWeeksInYear());
    }
  });
});

describe("calendarCompareMoment (calendar-extra.ts) branch coverage", () => {
  test("calendar compare quarter matches moment.js", () => {
    const m1 = moment("2024-06-15");
    const m2 = moment("2024-01-15");
    const mIsBefore = m1.isBefore(m2, "quarter");
    const oIsBefore = originalMoment("2024-06-15").isBefore(
      originalMoment("2024-01-15"),
      "quarter",
    );
    expect(mIsBefore).toBe(oIsBefore);
  });

  test("calendar compare isoWeek matches moment.js", () => {
    const m1 = moment("2024-06-15");
    const m2 = moment("2024-01-15");
    const mIsBefore = m1.isBefore(m2, "isoWeek");
    const oIsBefore = originalMoment("2024-06-15").isBefore(
      originalMoment("2024-01-15"),
      "isoWeek",
    );
    expect(mIsBefore).toBe(oIsBefore);
  });

  test("calendar compare week matches moment.js", () => {
    const m1 = moment("2024-06-15");
    const m2 = moment("2024-01-15");
    const mIsBefore = m1.isBefore(m2, "week");
    const oIsBefore = originalMoment("2024-06-15").isBefore(originalMoment("2024-01-15"), "week");
    expect(mIsBefore).toBe(oIsBefore);
  });
});
