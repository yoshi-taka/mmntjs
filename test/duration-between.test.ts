import { describe, test, expect } from "bun:test";
import { diffMomentsForDuration } from "../src/duration-between.ts";

type MomentParts = {
  y: number;
  m: number;
  d: number;
  h?: number;
  min?: number;
  s?: number;
  ms?: number;
};

function makeMoment({ y, m, d, h = 0, min = 0, s = 0, ms = 0 }: MomentParts) {
  const date = new Date(y, m, d, h, min, s, ms);
  return {
    _y: y,
    _m: m,
    _d: d,
    isValid: () => true,
    valueOf: () => date.getTime(),
    year: () => date.getFullYear(),
    month: () => date.getMonth(),
    clone: () =>
      makeMoment({
        y: date.getFullYear(),
        m: date.getMonth(),
        d: date.getDate(),
        h: date.getHours(),
        min: date.getMinutes(),
        s: date.getSeconds(),
        ms: date.getMilliseconds(),
      }),
    add: function (amount: number, unit: string) {
      if (unit === "months") {
        const newDate = new Date(date);
        newDate.setMonth(newDate.getMonth() + amount);
        return makeMoment({
          y: newDate.getFullYear(),
          m: newDate.getMonth(),
          d: newDate.getDate(),
          h: newDate.getHours(),
          min: newDate.getMinutes(),
          s: newDate.getSeconds(),
          ms: newDate.getMilliseconds(),
        });
      }
      throw new Error(`unsupported unit: ${unit}`);
    },
  };
}

function makeInvalid() {
  return {
    isValid: () => false,
    valueOf: () => NaN,
    year: () => NaN,
    month: () => NaN,
    clone: () => makeInvalid(),
    add: () => makeInvalid(),
  };
}

describe("diffMomentsForDuration", () => {
  test("returns zero for invalid moments", () => {
    const result = diffMomentsForDuration(makeInvalid(), makeInvalid());
    expect(result).toEqual({ months: 0, milliseconds: 0, days: 0 });
  });

  test("returns zero when from equals to", () => {
    const a = makeMoment({ y: 2024, m: 0, d: 15 });
    expect(diffMomentsForDuration(a, a)).toEqual({ months: 0, milliseconds: 0, days: 0 });
  });

  test("from < to: same month", () => {
    const a = makeMoment({ y: 2024, m: 0, d: 1 });
    const b = makeMoment({ y: 2024, m: 0, d: 15 });
    const result = diffMomentsForDuration(a, b);
    expect(result.months).toBe(0);
    expect(result.milliseconds).toBe(14 * 24 * 60 * 60 * 1000);
  });

  test("from < to: spans month boundary", () => {
    const a = makeMoment({ y: 2024, m: 0, d: 15 });
    const b = makeMoment({ y: 2024, m: 1, d: 15 });
    const result = diffMomentsForDuration(a, b);
    expect(result.months).toBe(1);
    expect(result.milliseconds).toBe(0);
  });

  test("from < to: spans year boundary", () => {
    const a = makeMoment({ y: 2024, m: 5, d: 15 });
    const b = makeMoment({ y: 2025, m: 5, d: 15 });
    const result = diffMomentsForDuration(a, b);
    expect(result.months).toBe(12);
    expect(result.milliseconds).toBe(0);
  });

  test("from < to: month adjustment (too many months)", () => {
    const a = makeMoment({ y: 2024, m: 0, d: 31 });
    const b = makeMoment({ y: 2024, m: 1, d: 29 });
    const result = diffMomentsForDuration(a, b);
    expect(result.months).toBe(0);
    expect(result.milliseconds).toBe(29 * 24 * 60 * 60 * 1000);
  });

  test("from > to: negative case", () => {
    const a = makeMoment({ y: 2024, m: 5, d: 15 });
    const b = makeMoment({ y: 2024, m: 0, d: 15 });
    const result = diffMomentsForDuration(a, b);
    expect(result.months).toBe(-5);
    expect(Math.abs(result.milliseconds)).toBeLessThan(1);
  });

  test("from > to: with millisecond remainder", () => {
    const a = makeMoment({ y: 2024, m: 5, d: 20 });
    const b = makeMoment({ y: 2024, m: 5, d: 15 });
    const result = diffMomentsForDuration(a, b);
    expect(result.months).toBe(0);
    expect(result.milliseconds).toBe(-5 * 24 * 60 * 60 * 1000);
  });

  test("from > to: months part is correct", () => {
    const a = makeMoment({ y: 2024, m: 5, d: 20 });
    const b = makeMoment({ y: 2024, m: 5, d: 15 });
    const result = diffMomentsForDuration(a, b);
    expect(result.months).toBe(0);
  });

  test("from > to: month adjustment (Mar 31 -> Feb 29 is -1mo -2d in algorithm)", () => {
    const a = makeMoment({ y: 2024, m: 2, d: 31 });
    const b = makeMoment({ y: 2024, m: 1, d: 29 });
    const result = diffMomentsForDuration(a, b);
    expect(result.months).toBe(-1);
    expect(Math.abs(result.milliseconds)).toBe(2 * 24 * 60 * 60 * 1000);
  });
});
