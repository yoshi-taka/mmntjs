import { describe, test, expect } from "bun:test";
import { formatMomentBasic } from "../src/display/format-basic.ts";

function makeMoment(y: number, M: number, D: number, H = 0, m = 0, s = 0, ms = 0) {
  return {
    $y: y, $M: M, $D: D, $H: H, $m: m, $s: s, $ms: ms,
    _isValid: true, _dirty: false, _l: "en",
    utcOffset: () => 0,
    localeData: () => ({ _config: {} }),
  } as any;
}

function makeInvalid() {
  return { _isValid: false, _dirty: false } as any;
}

function makeDirty(cb: () => void) {
  return {
    $y: 2024, $M: 0, $D: 15, $H: 10, $m: 30, $s: 0, $ms: 0,
    _isValid: true, _dirty: true,
    _ensureFields: cb,
    _l: "en",
    utcOffset: () => 0,
    localeData: () => ({ _config: {} }),
  } as any;
}

describe("formatMomentBasic", () => {
  test("returns Invalid date for invalid moment", () => {
    expect(formatMomentBasic(makeInvalid(), "YYYY-MM-DD")).toBe("Invalid date");
  });

  test("calls _ensureFields when _dirty is true", () => {
    let called = false;
    const m = makeDirty(() => { called = true; });
    formatMomentBasic(m, "YYYY-MM-DD");
    expect(called).toBe(true);
  });

  test("formats YYYY-MM-DD", () => {
    const m = makeMoment(2024, 0, 15);
    expect(formatMomentBasic(m, "YYYY-MM-DD")).toBe("2024-01-15");
  });

  test("formats HH:mm:ss", () => {
    const m = makeMoment(2024, 0, 1, 9, 5, 3);
    expect(formatMomentBasic(m, "HH:mm:ss")).toBe("09:05:03");
  });

  test("formats SSS", () => {
    const m = makeMoment(2024, 0, 1, 0, 0, 0, 42);
    expect(formatMomentBasic(m, "HH:mm:ss.SSS")).toBe("00:00:00.042");
  });

  test("pads year < 10", () => {
    const m = makeMoment(5, 0, 1);
    expect(formatMomentBasic(m, "YYYY")).toBe("0005");
  });

  test("pads year < 100", () => {
    const m = makeMoment(99, 0, 1);
    expect(formatMomentBasic(m, "YYYY")).toBe("0099");
  });

  test("pads year < 1000", () => {
    const m = makeMoment(999, 0, 1);
    expect(formatMomentBasic(m, "YYYY")).toBe("0999");
  });

  test("does not pad year >= 1000", () => {
    const m = makeMoment(2024, 0, 1);
    expect(formatMomentBasic(m, "YYYY")).toBe("2024");
  });

  test("formats literal text", () => {
    const m = makeMoment(2024, 0, 15);
    expect(formatMomentBasic(m, "YYYY[year]")).toBe("2024[year]");
  });

  test("handles mixed tokens and literals", () => {
    const m = makeMoment(2024, 11, 25, 14, 30, 45, 500);
    expect(formatMomentBasic(m, "YYYY-MM-DD HH:mm:ss.SSS")).toBe("2024-12-25 14:30:45.500");
  });
});
