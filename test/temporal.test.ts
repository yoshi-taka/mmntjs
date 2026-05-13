import { describe, test, expect } from "bun:test";
import moment from "../src/index.ts";
import { toTemporal, fromTemporal, getTemporalNamespace } from "../src/temporal.ts";

const Temporal = getTemporalNamespace() as {
  PlainDate: {
    from(o: { year: number; month: number; day: number }): {
      year: number;
      month: number;
      day: number;
    };
  };
  PlainDateTime: {
    from(o: {
      year: number;
      month: number;
      day: number;
      hour?: number;
      minute?: number;
      second?: number;
    }): { year: number; month: number; day: number; hour: number; minute: number; second: number };
  };
  ZonedDateTime: {
    from(o: {
      timeZone: string;
      year: number;
      month: number;
      day: number;
      hour?: number;
      minute?: number;
      second?: number;
    }): {
      year: number;
      month: number;
      day: number;
      hour: number;
      minute: number;
      second: number;
      epochMilliseconds: number;
      offsetNanoseconds?: bigint;
    };
  };
  PlainTime: {
    from(o: { hour: number; minute: number; second: number }): {
      hour: number;
      minute: number;
      second: number;
    };
  };
};

describe("temporal bridge", () => {
  describe("toTemporal", () => {
    test("local date-only moment returns PlainDate", () => {
      const m = moment("2024-06-15");
      const t = toTemporal(m) as Record<string, unknown>;
      expect(t).toBeInstanceOf(Temporal.PlainDate);
      expect(t.year).toBe(2024);
      expect(t.month).toBe(6);
      expect(t.day).toBe(15);
    });

    test("UTC moment returns ZonedDateTime with UTC timezone", () => {
      const m = moment.utc("2024-06-15T10:30:00");
      const t = toTemporal(m) as Record<string, unknown>;
      expect(t).toBeInstanceOf(Temporal.ZonedDateTime);
      expect(t.year).toBe(2024);
      expect(t.month).toBe(6);
      expect(t.day).toBe(15);
      expect(t.hour).toBe(10);
      expect(t.minute).toBe(30);
      expect(t.timeZoneId).toBe("UTC");
    });

    test("moment with time but local (no offset) returns ZonedDateTime with local offset", () => {
      const m = moment("2024-06-15T10:30:00");
      const t = toTemporal(m) as Record<string, unknown>;
      expect(t).toBeInstanceOf(Temporal.ZonedDateTime);
      expect(t.year).toBe(2024);
      expect(t.month).toBe(6);
      expect(t.day).toBe(15);
      expect(t.hour).toBe(10);
    });

    test("moment with explicit offset returns ZonedDateTime with offset timezone", () => {
      const m = moment("2024-06-15T10:30:00+05:00");
      const t = toTemporal(m) as Record<string, unknown>;
      expect(t).toBeInstanceOf(Temporal.ZonedDateTime);
      expect(t.year).toBe(2024);
      expect(t.month).toBe(6);
      expect(t.day).toBe(15);
      expect(t.hour).toBe(10);
      expect(t.minute).toBe(30);
    });

    test("UTC moment returns ZonedDateTime with UTC timezone", () => {
      const m = moment.utc("2024-06-15T10:30:00");
      const t = toTemporal(m) as Record<string, unknown>;
      expect(t).toBeInstanceOf(Temporal.ZonedDateTime);
      expect(t.year).toBe(2024);
      expect(t.month).toBe(6);
      expect(t.day).toBe(15);
      expect(t.hour).toBe(10);
      expect(t.minute).toBe(30);
      expect(t.timeZoneId).toBe("UTC");
    });

    test("moment with time but local (no offset) returns ZonedDateTime with local offset", () => {
      const m = moment("2024-06-15T10:30:00");
      const t = toTemporal(m) as Record<string, unknown>;
      expect(t).toBeInstanceOf(Temporal.ZonedDateTime);
      expect(t.year).toBe(2024);
      expect(t.month).toBe(6);
      expect(t.day).toBe(15);
      expect(t.hour).toBe(10);
    });

    test("moment with explicit offset returns ZonedDateTime with offset timezone", () => {
      const m = moment("2024-06-15T10:30:00+05:00");
      const t = toTemporal(m) as Record<string, unknown>;
      expect(t).toBeInstanceOf(Temporal.ZonedDateTime);
      expect(t.year).toBe(2024);
      expect(t.month).toBe(6);
      expect(t.day).toBe(15);
      expect(t.hour).toBe(10);
      expect(t.minute).toBe(30);
    });

    test("throws for invalid moment", () => {
      const m = moment(null as unknown);
      expect(() => toTemporal(m)).toThrow("Cannot convert invalid moment");
    });
  });

  describe("fromTemporal", () => {
    test("PlainDate returns date-only moment", () => {
      const pd = Temporal.PlainDate.from({ year: 2024, month: 6, day: 15 });
      const m = fromTemporal(pd);
      expect(m.isValid()).toBe(true);
      expect(m.year()).toBe(2024);
      expect(m.month()).toBe(5); // 0-indexed
      expect(m.date()).toBe(15);
      expect(m.hour()).toBe(0);
      expect(m.minute()).toBe(0);
      expect(m.second()).toBe(0);
    });

    test("ZonedDateTime returns moment with correct epoch", () => {
      const zdt = Temporal.ZonedDateTime.from({
        timeZone: "UTC",
        year: 2024,
        month: 6,
        day: 15,
        hour: 10,
        minute: 30,
        second: 0,
      });
      const m = fromTemporal(zdt);
      const expected = moment.utc("2024-06-15T10:30:00");
      expect(m.valueOf()).toBe(expected.valueOf());
    });

    test("ZonedDateTime with non-zero offset preserves offset", () => {
      const zdt = Temporal.ZonedDateTime.from({
        timeZone: "+05:00",
        year: 2024,
        month: 6,
        day: 15,
        hour: 10,
        minute: 30,
      });
      const m = fromTemporal(zdt);
      const expected = moment.utc("2024-06-15T05:30:00");
      expect(m.valueOf()).toBe(expected.valueOf());
    });

    test("PlainDateTime returns moment with date and time", () => {
      const pdt = Temporal.PlainDateTime.from({
        year: 2024,
        month: 6,
        day: 15,
        hour: 10,
        minute: 30,
        second: 45,
      });
      const m = fromTemporal(pdt);
      expect(m.year()).toBe(2024);
      expect(m.month()).toBe(5);
      expect(m.date()).toBe(15);
      expect(m.hour()).toBe(10);
      expect(m.minute()).toBe(30);
      expect(m.second()).toBe(45);
    });

    test("PlainTime returns moment with today date and given time", () => {
      const pt = Temporal.PlainTime.from({ hour: 14, minute: 30, second: 15 });
      const m = fromTemporal(pt);
      const now = new Date();
      expect(m.year()).toBe(now.getFullYear());
      expect(m.month()).toBe(now.getMonth());
      expect(m.date()).toBe(now.getDate());
      expect(m.hour()).toBe(14);
      expect(m.minute()).toBe(30);
      expect(m.second()).toBe(15);
    });

    test("throws for unsupported Temporal type", () => {
      expect(() => fromTemporal({} as unknown)).toThrow("Unsupported Temporal type");
    });

    test("roundtrip: moment -> toTemporal -> fromTemporal", () => {
      const original = moment("2024-06-15T10:30:00");
      const t = toTemporal(original);
      const back = fromTemporal(t);
      expect(back.valueOf()).toBe(original.valueOf());
    });

    test("roundtrip: UTC moment -> toTemporal -> fromTemporal", () => {
      const original = moment.utc("2024-06-15T10:30:00");
      const t = toTemporal(original);
      const back = fromTemporal(t);
      expect(back.valueOf()).toBe(original.valueOf());
    });

    test("roundtrip: moment with offset -> toTemporal -> fromTemporal", () => {
      const original = moment("2024-06-15T10:30:00+05:00");
      const t = toTemporal(original);
      const back = fromTemporal(t);
      expect(back.valueOf()).toBe(original.valueOf());
    });
  });
});
