// DST guard verification for setHourFast epoch delta arithmetic
import mmntjs from "mmntjs";
import { describe, test, expect } from "bun:test";

describe("setHourFast DST guard", () => {
  test("non-DST hour change uses arithmetic path", () => {
    const m = mmntjs("2024-06-15T10:30:00");
    const got = m.clone().hour(15);
    expect(got.hour()).toBe(15);
    expect(got.format("HH:mm:ss")).toBe("15:30:00");
  });

  test("UTC mode uses pure arithmetic", () => {
    const m = mmntjs.utc("2024-06-15T10:30:00");
    const got = m.clone().hour(15);
    expect(got.hour()).toBe(15);
    expect(got.format("HH:mm:ss")).toBe("15:30:00");
  });

  test("chained setters produce correct result", () => {
    const m = mmntjs("2024-06-15T10:30:45.123");
    const got = m.hour(0).minute(0).second(0).millisecond(0);
    expect(got.format("HH:mm:ss.SSS")).toBe("00:00:00.000");
  });

  test("setMinute/setSecond/setMs preserve other fields", () => {
    const m = mmntjs("2024-06-15T10:30:45.123");
    m.minute(0);
    expect(m.hour()).toBe(10);
    expect(m.second()).toBe(45);
    expect(m.millisecond()).toBe(123);
    m.second(0);
    expect(m.hour()).toBe(10);
    expect(m.minute()).toBe(0);
    expect(m.millisecond()).toBe(123);
    m.millisecond(0);
    expect(m.hour()).toBe(10);
    expect(m.minute()).toBe(0);
    expect(m.second()).toBe(0);
    expect(m.millisecond()).toBe(0);
  });

  test("setHour preserves other time fields", () => {
    const m = mmntjs("2024-06-15T10:30:45.123");
    m.hour(15);
    expect(m.minute()).toBe(30);
    expect(m.second()).toBe(45);
    expect(m.millisecond()).toBe(123);
  });

  test("setHour out-of-range (≥24) normalizes via _syncT fallback", () => {
    const m = mmntjs("2024-06-15T10:30:00");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (m as any).hour(24);
    expect(m.hour()).toBe(0);
    expect(m.date()).toBe(16); // next day
  });

  test("setHour out-of-range (<0) normalizes via _syncT fallback", () => {
    const m = mmntjs("2024-06-15T10:30:00");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (m as any).hour(-1);
    expect(m.hour()).toBe(23);
    expect(m.date()).toBe(14); // previous day
  });
});
