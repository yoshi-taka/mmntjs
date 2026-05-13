import { describe, test, expect } from "bun:test";
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

  test("from HH:mm:ss format", () => {
    const d = moment.duration("10:30:45");
    expect(d.hours()).toBe(10);
    expect(d.minutes()).toBe(30);
    expect(d.seconds()).toBe(45);
  });

  test("from HH:mm format", () => {
    const d = moment.duration("10:30");
    expect(d.hours()).toBe(10);
    expect(d.minutes()).toBe(30);
  });

  test("from number with unit string", () => {
    const d = moment.duration(5, "days");
    expect(d.days()).toBe(5);
  });

  test("from number with quarter unit", () => {
    const d = moment.duration(2, "quarter");
    expect(d.months()).toBe(6);
  });

  test("from number with weeks unit", () => {
    const d = moment.duration(3, "weeks");
    expect(d.days()).toBe(21);
  });

  test("from object with aliases", () => {
    const d = moment.duration({ d: 5, h: 3 });
    expect(d.days()).toBe(5);
    expect(d.hours()).toBe(3);
  });

  test("from object with quarter", () => {
    const d = moment.duration({ quarter: 1 });
    expect(d.months()).toBe(3);
  });

  test("from string with number and unit", () => {
    const d = moment.duration("5", "days");
    expect(d.days()).toBe(5);
  });

  test("NaN input returns invalid", () => {
    const d = moment.duration(NaN);
    expect(d.isValid()).toBe(false);
  });

  test("invalid ISO string returns invalid", () => {
    const d = moment.duration("not-a-duration");
    expect(d.isValid()).toBe(false);
  });
});

describe("Duration clone", () => {
  test("clone is independent", () => {
    const a = moment.duration(5, "days");
    const b = a.clone();
    b.add(1, "days");
    expect(a.days()).toBe(5);
    expect(b.days()).toBe(6);
  });
});

describe("Duration humanize", () => {
  test("humanize small durations", () => {
    expect(moment.duration(1000).humanize()).toBe("a few seconds");
    expect(moment.duration(60000).humanize()).toBe("a minute");
    expect(moment.duration(3600000).humanize()).toBe("an hour");
  });

  test("humanize with suffix", () => {
    const h = moment.duration(-60000).humanize(true);
    expect(typeof h).toBe("string");
  });
});

describe("Duration get", () => {
  test("get various units", () => {
    const d = moment.duration({ years: 2, months: 3, days: 5, hours: 10, minutes: 30, seconds: 45, milliseconds: 500 });
    expect(d.get("years")).toBe(2);
    expect(d.get("months")).toBe(3);
    expect(d.get("days")).toBe(5);
    expect(d.get("hours")).toBe(10);
    expect(d.get("minutes")).toBe(30);
    expect(d.get("seconds")).toBe(45);
    expect(d.get("milliseconds")).toBe(500);
  });
});

describe("Duration as", () => {
  test("as various units", () => {
    const d = moment.duration(86400000);
    expect(d.as("days")).toBe(1);
    expect(d.as("hours")).toBe(24);
    expect(d.as("minutes")).toBe(1440);
  });
});

describe("Duration toISOString", () => {
  test("positive duration", () => {
    const d = moment.duration({ years: 1, months: 2, days: 3, hours: 4, minutes: 5, seconds: 6 });
    expect(d.toISOString()).toBe("P1Y2M3DT4H5M6S");
  });

  test("negative duration", () => {
    const d = moment.duration(-86400000);
    expect(d.toISOString()).toMatch(/^-P/);
  });
});

describe("Duration locale", () => {
  test("locale getter/setter", () => {
    const d = moment.duration(60000);
    expect(d.locale()).toBe("en");
    d.locale("en");
    expect(d.locale()).toBe("en");
  });
});
