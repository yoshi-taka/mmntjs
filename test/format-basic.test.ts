import { describe, test, expect } from "bun:test";
import { formatMomentBasic } from "../src/display/format-basic.ts";
import type { FormattableMoment } from "../src/display/types";

type BasicFields = {
  y: number;
  M: number;
  D: number;
  H?: number;
  m?: number;
  s?: number;
  ms?: number;
};

function makeMoment({ y, M, D, H = 0, m = 0, s = 0, ms = 0 }: BasicFields) {
  return {
    $y: y, $M: M, $D: D, $H: H, $m: m, $s: s, $ms: ms,
    _isValid: true, _dirty: false, _l: "en",
    utcOffset: () => 0,
    localeData: () => ({ _config: {} }),
  } as FormattableMoment;
}

function makeInvalid() {
  return { _isValid: false, _dirty: false } as unknown as FormattableMoment;
}

function makeDirty(cb: () => void) {
  return {
    $y: 2024, $M: 0, $D: 15, $H: 10, $m: 30, $s: 0, $ms: 0,
    _isValid: true, _dirty: true,
    _ensureFields: cb,
    _l: "en",
    utcOffset: () => 0,
    localeData: () => ({ _config: {} }),
  } as FormattableMoment;
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
    const m = makeMoment({ y: 2024, M: 0, D: 15 });
    expect(formatMomentBasic(m, "YYYY-MM-DD")).toBe("2024-01-15");
  });

  test("formats HH:mm:ss", () => {
    const m = makeMoment({ y: 2024, M: 0, D: 1, H: 9, m: 5, s: 3 });
    expect(formatMomentBasic(m, "HH:mm:ss")).toBe("09:05:03");
  });

  test("formats SSS", () => {
    const m = makeMoment({ y: 2024, M: 0, D: 1, ms: 42 });
    expect(formatMomentBasic(m, "HH:mm:ss.SSS")).toBe("00:00:00.042");
  });

  test("pads year < 10", () => {
    const m = makeMoment({ y: 5, M: 0, D: 1 });
    expect(formatMomentBasic(m, "YYYY")).toBe("0005");
  });

  test("pads year < 100", () => {
    const m = makeMoment({ y: 99, M: 0, D: 1 });
    expect(formatMomentBasic(m, "YYYY")).toBe("0099");
  });

  test("pads year < 1000", () => {
    const m = makeMoment({ y: 999, M: 0, D: 1 });
    expect(formatMomentBasic(m, "YYYY")).toBe("0999");
  });

  test("does not pad year >= 1000", () => {
    const m = makeMoment({ y: 2024, M: 0, D: 1 });
    expect(formatMomentBasic(m, "YYYY")).toBe("2024");
  });

  test("formats literal text", () => {
    const m = makeMoment({ y: 2024, M: 0, D: 15 });
    expect(formatMomentBasic(m, "YYYY[year]")).toBe("2024[year]");
  });

  test("handles mixed tokens and literals", () => {
    const m = makeMoment({ y: 2024, M: 11, D: 25, H: 14, m: 30, s: 45, ms: 500 });
    expect(formatMomentBasic(m, "YYYY-MM-DD HH:mm:ss.SSS")).toBe("2024-12-25 14:30:45.500");
  });
});
