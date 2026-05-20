import { describe, test, expect } from "bun:test";
import fc from "fast-check";
import moment from "../src/index.ts";
import originalMoment from "../moment/moment";

const DAY = 86400000;

// ---------------------------------------------------------------------------
// 1. Ternary branch: _isUTC ? _t - _offset * 60000 : _t
//    Both sides (this._isUTC true/false, other._isUTC true/false)
// ---------------------------------------------------------------------------
describe("isAfter family: UTC/local ternary branches", () => {
  // Use epoch timestamps so results are timezone-independent
  const baseTs = Date.UTC(2024, 0, 15, 12, 0, 0, 0); // 2024-01-15 12:00 UTC
  const laterTs = baseTs + DAY;

  // 4 combinations: (this._isUTC, other._isUTC)
  // local/local  → false/false
  // local/UTC    → false/true
  // UTC/local    → true/false
  // UTC/UTC      → true/true

  function assertCombos(label: string, testFn: (a: moment.Moment, b: moment.Moment) => boolean) {
    const localBase = moment(baseTs);
    const localLater = moment(laterTs);
    const utcBase = moment.utc(baseTs);
    const utcLater = moment.utc(laterTs);

    // Same values → false
    expect(testFn(localBase, localBase)).toBe(false);
    expect(testFn(utcBase, utcBase)).toBe(false);
    expect(testFn(localBase, utcBase)).toBe(false);
    expect(testFn(utcBase, localBase)).toBe(false);

    // Different: base vs later
    expect(testFn(localBase, localLater)).toBe(false);
    expect(testFn(localBase, utcLater)).toBe(false);
    expect(testFn(utcBase, localLater)).toBe(false);
    expect(testFn(utcBase, utcLater)).toBe(false);

    expect(testFn(localLater, localBase)).toBe(true);
    expect(testFn(localLater, utcBase)).toBe(true);
    expect(testFn(utcLater, localBase)).toBe(true);
    expect(testFn(utcLater, utcBase)).toBe(true);
  }

  test("isAfter without unit — all 4 UTC/local combos", () => {
    assertCombos("isAfter", (a, b) => a.isAfter(b));
  });

  test("isBefore without unit — all 4 UTC/local combos", () => {
    const localBase = moment(baseTs);
    const localLater = moment(laterTs);
    const utcBase = moment.utc(baseTs);
    const utcLater = moment.utc(laterTs);

    expect(localBase.isBefore(localLater)).toBe(true);
    expect(localBase.isBefore(utcLater)).toBe(true);
    expect(utcBase.isBefore(localLater)).toBe(true);
    expect(utcBase.isBefore(utcLater)).toBe(true);

    expect(localLater.isBefore(localBase)).toBe(false);
    expect(localLater.isBefore(utcBase)).toBe(false);
    expect(utcLater.isBefore(localBase)).toBe(false);
    expect(utcLater.isBefore(utcBase)).toBe(false);
  });

  test("isSame without unit — all 4 UTC/local combos", () => {
    const ts = baseTs;
    const local = moment(ts);
    const utc = moment.utc(ts);
    const localSame = moment(ts);
    const utcSame = moment.utc(ts);

    expect(local.isSame(localSame)).toBe(true);
    expect(local.isSame(utcSame)).toBe(true);
    expect(utc.isSame(localSame)).toBe(true);
    expect(utc.isSame(utcSame)).toBe(true);
  });

  test("isSameOrAfter without unit (goes through _compareCalendarValues ms)", () => {
    const localBase = moment(baseTs);
    const localLater = moment(laterTs);
    const utcBase = moment.utc(baseTs);
    const utcLater = moment.utc(laterTs);

    expect(localBase.isSameOrAfter(localBase)).toBe(true);
    expect(localBase.isSameOrAfter(utcBase)).toBe(true);
    expect(utcBase.isSameOrAfter(localBase)).toBe(true);
    expect(utcBase.isSameOrAfter(utcBase)).toBe(true);

    expect(localBase.isSameOrAfter(localLater)).toBe(false);
    expect(localBase.isSameOrAfter(utcLater)).toBe(false);
    expect(utcBase.isSameOrAfter(localLater)).toBe(false);
    expect(utcBase.isSameOrAfter(utcLater)).toBe(false);

    expect(localLater.isSameOrAfter(localBase)).toBe(true);
    expect(localLater.isSameOrAfter(utcBase)).toBe(true);
    expect(utcLater.isSameOrAfter(localBase)).toBe(true);
    expect(utcLater.isSameOrAfter(utcBase)).toBe(true);
  });

  test("isSameOrBefore without unit (goes through _compareCalendarValues ms)", () => {
    const localBase = moment(baseTs);
    const localLater = moment(laterTs);
    const utcBase = moment.utc(baseTs);
    const utcLater = moment.utc(laterTs);

    expect(localBase.isSameOrBefore(localBase)).toBe(true);
    expect(localBase.isSameOrBefore(utcBase)).toBe(true);
    expect(utcBase.isSameOrBefore(localBase)).toBe(true);
    expect(utcBase.isSameOrBefore(utcBase)).toBe(true);

    expect(localBase.isSameOrBefore(localLater)).toBe(true);
    expect(localBase.isSameOrBefore(utcLater)).toBe(true);
    expect(utcBase.isSameOrBefore(localLater)).toBe(true);
    expect(utcBase.isSameOrBefore(utcLater)).toBe(true);

    expect(localLater.isSameOrBefore(localBase)).toBe(false);
    expect(localLater.isSameOrBefore(utcBase)).toBe(false);
    expect(utcLater.isSameOrBefore(localBase)).toBe(false);
    expect(utcLater.isSameOrBefore(utcBase)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 2. String input to isAfter family
// ---------------------------------------------------------------------------
describe("isAfter family: string input", () => {
  const ref = moment.utc("2024-06-15T12:00:00");

  test("isAfter with plain ISO string (no offset)", () => {
    expect(ref.isAfter("2024-06-15T11:00:00")).toBe(true);
    expect(ref.isAfter("2024-06-15T12:00:00")).toBe(false);
    expect(ref.isAfter("2024-06-15T13:00:00")).toBe(false);
  });

  test("isAfter with ISO string + Z offset", () => {
    expect(ref.isAfter("2024-06-15T11:00:00Z")).toBe(true);
    expect(ref.isAfter("2024-06-15T12:00:00Z")).toBe(false);
    expect(ref.isAfter("2024-06-15T13:00:00Z")).toBe(false);
  });

  test("isAfter with ISO string + positive offset", () => {
    // 2024-06-15T12:00:00+05:30 = 2024-06-15T06:30:00Z
    expect(ref.isAfter("2024-06-15T12:00:00+05:30")).toBe(true);
    // 2024-06-15T20:30:00+05:30 = 2024-06-15T15:00:00Z
    expect(ref.isAfter("2024-06-15T20:30:00+05:30")).toBe(false);
  });

  test("isAfter with ISO string + negative offset", () => {
    // 2024-06-15T07:00:00-05:00 = 2024-06-15T12:00:00Z
    expect(ref.isAfter("2024-06-15T07:00:00-05:00")).toBe(false);
    expect(ref.isAfter("2024-06-15T06:59:59-05:00")).toBe(true);
  });

  test("isBefore with plain ISO string (no offset)", () => {
    expect(ref.isBefore("2024-06-15T13:00:00")).toBe(true);
    expect(ref.isBefore("2024-06-15T12:00:00")).toBe(false);
    expect(ref.isBefore("2024-06-15T11:00:00")).toBe(false);
  });

  test("isBefore with ISO string + Z offset", () => {
    expect(ref.isBefore("2024-06-15T13:00:00Z")).toBe(true);
    expect(ref.isBefore("2024-06-15T12:00:00Z")).toBe(false);
  });

  test("isSame with ISO string + offset", () => {
    // Same instant in different representations
    expect(ref.isSame("2024-06-15T12:00:00Z")).toBe(true);
    expect(ref.isSame("2024-06-15T17:30:00+05:30")).toBe(true);
    expect(ref.isSame("2024-06-15T07:00:00-05:00")).toBe(true);
  });

  test("isSameOrAfter with ISO string + Z", () => {
    expect(ref.isSameOrAfter("2024-06-15T11:59:59Z")).toBe(true);
    expect(ref.isSameOrAfter("2024-06-15T12:00:00Z")).toBe(true);
    expect(ref.isSameOrAfter("2024-06-15T12:00:01Z")).toBe(false);
  });

  test("isSameOrBefore with ISO string + Z", () => {
    expect(ref.isSameOrBefore("2024-06-15T12:00:01Z")).toBe(true);
    expect(ref.isSameOrBefore("2024-06-15T12:00:00Z")).toBe(true);
    expect(ref.isSameOrBefore("2024-06-15T11:59:59Z")).toBe(false);
  });

  test("isBetween with string inputs + offsets", () => {
    const from = "2024-06-15T10:00:00Z";
    const to = "2024-06-15T14:00:00Z";
    expect(ref.isBetween(from, to)).toBe(true);
    expect(ref.isBetween("2024-06-15T12:00:00Z", "2024-06-15T14:00:00Z")).toBe(false);
    expect(ref.isBetween(from, to, undefined, "[]")).toBe(true);
    expect(ref.isBetween("2024-06-15T12:00:00Z", "2024-06-15T14:00:00Z", undefined, "[)")).toBe(
      true,
    );
  });
});

// ---------------------------------------------------------------------------
// 3. Invalid moment handling (this or other is invalid)
// ---------------------------------------------------------------------------
describe("isAfter family: invalid moments", () => {
  const valid = moment.utc("2024-06-15");
  const invalid = moment.invalid();
  const anotherInvalid = moment.invalid();

  test("isAfter with invalid moments", () => {
    expect(valid.isAfter(invalid)).toBe(false);
    expect(invalid.isAfter(valid)).toBe(false);
    expect(invalid.isAfter(anotherInvalid)).toBe(false);
    expect(invalid.isAfter(invalid)).toBe(false);
    // With unit
    expect(valid.isAfter(invalid, "year")).toBe(false);
    expect(invalid.isAfter(valid, "year")).toBe(false);
  });

  test("isBefore with invalid moments", () => {
    expect(valid.isBefore(invalid)).toBe(false);
    expect(invalid.isBefore(valid)).toBe(false);
    expect(invalid.isBefore(invalid)).toBe(false);
    expect(valid.isBefore(invalid, "month")).toBe(false);
  });

  test("isSame with invalid moments", () => {
    expect(valid.isSame(invalid)).toBe(false);
    expect(invalid.isSame(valid)).toBe(false);
    expect(invalid.isSame(anotherInvalid)).toBe(false);
    expect(valid.isSame(invalid, "day")).toBe(false);
  });

  test("isSameOrAfter with invalid moments", () => {
    expect(valid.isSameOrAfter(invalid)).toBe(false);
    expect(invalid.isSameOrAfter(valid)).toBe(false);
    expect(invalid.isSameOrAfter(invalid)).toBe(false);
  });

  test("isSameOrBefore with invalid moments", () => {
    expect(valid.isSameOrBefore(invalid)).toBe(false);
    expect(invalid.isSameOrBefore(valid)).toBe(false);
    expect(invalid.isSameOrBefore(invalid)).toBe(false);
  });

  test("isBetween with invalid moments", () => {
    const valid2 = moment.utc("2024-06-20");
    expect(invalid.isBetween(valid, valid2)).toBe(false);
    expect(valid.isBetween(invalid, valid2)).toBe(false);
    expect(valid.isBetween(valid, invalid)).toBe(false);
    expect(invalid.isBetween(invalid, invalid)).toBe(false);
  });

  test("null input creates invalid moment", () => {
    const m = moment(null);
    expect(m.isValid()).toBe(false);
    expect(m.valueOf()).toBe(NaN);
  });

  test("Infinity number input creates invalid moment", () => {
    const m = moment(Infinity);
    expect(m.isValid()).toBe(false);
  });

  test("-Infinity number input creates invalid moment", () => {
    const m = moment(-Infinity);
    expect(m.isValid()).toBe(false);
  });

  test("null input in comparisons returns false", () => {
    const v = moment.utc("2024-06-15");
    expect(v.isAfter(null)).toBe(false);
    expect(v.isBefore(null)).toBe(false);
    expect(v.isSame(null)).toBe(false);
    expect(v.isSameOrAfter(null)).toBe(false);
    expect(v.isSameOrBefore(null)).toBe(false);
    expect(v.isBetween(null, moment.utc("2024-06-20"))).toBe(false);
  });

  test("Infinity input in comparisons returns false", () => {
    const v = moment.utc("2024-06-15");
    expect(v.isAfter(Infinity)).toBe(false);
    expect(v.isBefore(Infinity)).toBe(false);
    expect(v.isSame(Infinity)).toBe(false);
    expect(v.isSameOrAfter(Infinity)).toBe(false);
    expect(v.isSameOrBefore(Infinity)).toBe(false);
  });

  test("diff(null/Infinity) returns NaN (invalid)", () => {
    const v = moment.utc("2024-06-15");
    expect(v.diff(null)).toBe(NaN);
    expect(v.diff(Infinity)).toBe(NaN);
    expect(v.diff(-Infinity)).toBe(NaN);
  });

  test("max(null/Infinity) returns invalid moment (matches moment.js)", () => {
    const v = moment.utc("2024-06-15");
    expect(v.max(null).isValid()).toBe(false);
    expect(v.max(Infinity).isValid()).toBe(false);
    expect(v.max(-Infinity).isValid()).toBe(false);
  });

  test("min(null/Infinity) returns invalid moment (matches moment.js)", () => {
    const v = moment.utc("2024-06-15");
    expect(v.min(null).isValid()).toBe(false);
    expect(v.min(Infinity).isValid()).toBe(false);
    expect(v.min(-Infinity).isValid()).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 4. isBetween inclusivity all 4 patterns (exercising the flag parsing)
// ---------------------------------------------------------------------------
describe("isBetween inclusivity patterns", () => {
  const base = moment.utc("2024-06-15T12:00:00");
  const from = moment.utc("2024-06-15T12:00:00");
  const to = moment.utc("2024-06-15T14:00:00");
  // base is at 12:00, same as from

  test("default inclusivity () — exclusive both ends", () => {
    // base == from → startCheck = isAfter → false → false
    expect(base.isBetween(from, to)).toBe(false);
    expect(base.isBetween(from, to, undefined, "()")).toBe(false);
    // base + 1ms
    const slightlyAfter = moment.utc("2024-06-15T12:00:01");
    expect(slightlyAfter.isBetween(from, to, undefined, "()")).toBe(true);
    // base == to (if we move)
    expect(moment.utc("2024-06-15T14:00:00").isBetween(from, to, undefined, "()")).toBe(false);
  });

  test("[] — inclusive both ends", () => {
    expect(base.isBetween(from, to, undefined, "[]")).toBe(true);
    expect(moment.utc("2024-06-15T14:00:00").isBetween(from, to, undefined, "[]")).toBe(true);
  });

  test("(] — exclusive start, inclusive end", () => {
    // base == from → startCheck = isAfter → false → false
    expect(base.isBetween(from, to, undefined, "(]")).toBe(false);
    // to == end → endCheck = isSameOrBefore → true
    expect(moment.utc("2024-06-15T14:00:00").isBetween(from, to, undefined, "(]")).toBe(true);
    // strictly inside → true
    expect(moment.utc("2024-06-15T13:00:00").isBetween(from, to, undefined, "(]")).toBe(true);
  });

  test("[) — inclusive start, exclusive end", () => {
    // base == from → startCheck = isSameOrAfter → true
    expect(base.isBetween(from, to, undefined, "[)")).toBe(true);
    // to == end → endCheck = isBefore → false → false
    expect(moment.utc("2024-06-15T14:00:00").isBetween(from, to, undefined, "[)")).toBe(false);
    // strictly inside → true
    expect(moment.utc("2024-06-15T13:00:00").isBetween(from, to, undefined, "[)")).toBe(true);
  });

  test("isBetween with unit and inclusivity", () => {
    // Same year, same day → should be between for 'day' inclusive
    const dayFrom = moment.utc("2024-06-14");
    const dayTo = moment.utc("2024-06-16");
    expect(base.isBetween(dayFrom, dayTo, "day")).toBe(true);
    // On boundary, exclusive
    expect(base.isBetween(dayFrom, base.clone(), "day")).toBe(false);
    expect(base.isBetween(dayFrom, base.clone(), "day", "[]")).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 5. Unit branches in _compareCalendarValues (quarter, week, isoWeek)
// ---------------------------------------------------------------------------
describe("_compareCalendarValues unit branches", () => {
  test("quarter unit comparison", () => {
    const q1 = moment.utc("2024-02-15"); // Q1
    const q2 = moment.utc("2024-05-15"); // Q2
    const q4 = moment.utc("2024-11-15"); // Q4

    expect(q1.isSame(q2, "quarter")).toBe(false);
    expect(q1.isBefore(q2, "quarter")).toBe(true);
    expect(q2.isAfter(q1, "quarter")).toBe(true);
    expect(q4.isSame(q4, "quarter")).toBe(true);
  });

  test("week unit comparison", () => {
    const w1 = moment.utc("2024-01-01"); // Week 1
    const w2 = moment.utc("2024-01-08"); // Week 2

    expect(w1.isSame(w2, "week")).toBe(false);
    expect(w1.isBefore(w2, "week")).toBe(true);
    expect(w2.isAfter(w1, "week")).toBe(true);
  });

  test("isoWeek unit comparison", () => {
    const w1 = moment.utc("2024-01-01"); // ISO week 1
    const w2 = moment.utc("2024-01-08"); // ISO week 2

    expect(w1.isSame(w2, "isoWeek")).toBe(false);
    expect(w1.isBefore(w2, "isoWeek")).toBe(true);
    expect(w2.isAfter(w1, "isoWeek")).toBe(true);
  });

  test("year unit comparison", () => {
    const y2024 = moment.utc("2024-06-15");
    const y2025 = moment.utc("2025-06-15");
    const y2024_2 = moment.utc("2024-01-01");

    expect(y2024.isSame(y2024_2, "year")).toBe(true);
    expect(y2024.isBefore(y2025, "year")).toBe(true);
    expect(y2025.isAfter(y2024, "year")).toBe(true);
  });

  test("month unit comparison", () => {
    const jan = moment.utc("2024-01-15");
    const feb = moment.utc("2024-02-15");
    const janNext = moment.utc("2025-01-15");

    expect(jan.isSame(jan, "month")).toBe(true);
    expect(jan.isBefore(feb, "month")).toBe(true);
    expect(feb.isAfter(jan, "month")).toBe(true);
    expect(jan.isBefore(janNext, "month")).toBe(true);
  });

  test("day unit comparison", () => {
    const d15 = moment.utc("2024-01-15");
    const d16 = moment.utc("2024-01-16");
    const d15NextMonth = moment.utc("2024-02-15");

    expect(d15.isSame(d15, "day")).toBe(true);
    expect(d15.isBefore(d16, "day")).toBe(true);
    expect(d15.isBefore(d15NextMonth, "day")).toBe(true);
  });

  test("day unit with UTC both (triggers UTC-day-floor path)", () => {
    // Both UTC → enters the "this._isUTC && other._isUTC" branch in day/date
    const a = moment.utc("2024-01-15T12:00:00");
    const b = moment.utc("2024-01-16T00:00:00");
    // Different UTC days → uses day-floor comparison
    expect(a.isBefore(b, "day")).toBe(true);
    expect(a.isSame(b, "day")).toBe(false);

    // Same UTC day → falls through to field comparison
    const sameDay = moment.utc("2024-01-15T23:59:59");
    expect(a.isSame(sameDay, "day")).toBe(true);
  });

  test("hour unit comparison", () => {
    const h10 = moment.utc("2024-01-15T10:00:00");
    const h11 = moment.utc("2024-01-15T11:00:00");

    expect(h10.isSame(h10, "hour")).toBe(true);
    expect(h10.isBefore(h11, "hour")).toBe(true);
    expect(h11.isAfter(h10, "hour")).toBe(true);
  });

  test("minute unit comparison", () => {
    const m30 = moment.utc("2024-01-15T10:30:00");
    const m31 = moment.utc("2024-01-15T10:31:00");

    expect(m30.isSame(m30, "minute")).toBe(true);
    expect(m30.isBefore(m31, "minute")).toBe(true);
    expect(m31.isAfter(m30, "minute")).toBe(true);
  });

  test("second unit comparison", () => {
    const s45 = moment.utc("2024-01-15T10:30:45");
    const s46 = moment.utc("2024-01-15T10:30:46");

    expect(s45.isSame(s45, "second")).toBe(true);
    expect(s45.isSame(s46, "second")).toBe(false);
    expect(s45.isBefore(s46, "second")).toBe(true);
  });

  test("millisecond unit comparison", () => {
    const ms100 = moment.utc("2024-01-15T10:30:45.100");
    const ms200 = moment.utc("2024-01-15T10:30:45.200");

    expect(ms100.isSame(ms100, "millisecond")).toBe(true);
    expect(ms100.isSame(ms200, "millisecond")).toBe(false);
    expect(ms100.isBefore(ms200, "millisecond")).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 6. normalizeUnits falsy branch (returns NaN)
// ---------------------------------------------------------------------------
describe("normalizeUnits edge case (falsy => NaN)", () => {
  test("comparison with unknown unit returns false (not throw)", () => {
    const a = moment.utc("2024-01-15");
    const b = moment.utc("2024-06-15");
    expect(a.isAfter(b, "unknown" as never)).toBe(false);
    expect(a.isBefore(b, "unknown" as never)).toBe(false);
    expect(a.isSame(b, "unknown" as never)).toBe(false);
    expect(a.isSameOrAfter(b, "unknown" as never)).toBe(false);
    expect(a.isSameOrBefore(b, "unknown" as never)).toBe(false);
    // isBetween passes unknown unit through
    expect(a.isBetween(b, moment.utc("2025-01-01"), "unknown" as never)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 7. Input type equivalence: Moment / Date / string / number should agree
// ---------------------------------------------------------------------------
describe("isAfter family: input type equivalence", () => {
  const ref = moment.utc("2024-06-15T12:00:00");
  const ts = Date.UTC(2024, 5, 15, 12, 0, 0); // same as ref
  const tsEarlier = ts - DAY;
  const tsLater = ts + DAY;

  test("isAfter with Date input", () => {
    expect(ref.isAfter(new Date(tsEarlier))).toBe(true);
    expect(ref.isAfter(new Date(ts))).toBe(false);
    expect(ref.isAfter(new Date(tsLater))).toBe(false);
  });

  test("isAfter with number input (epoch ms)", () => {
    expect(ref.isAfter(tsEarlier)).toBe(true);
    expect(ref.isAfter(ts)).toBe(false);
    expect(ref.isAfter(tsLater)).toBe(false);
  });

  test("isAfter with Moment input (same instant)", () => {
    expect(ref.isAfter(moment.utc(tsEarlier))).toBe(true);
    expect(ref.isAfter(moment.utc(ts))).toBe(false);
    expect(ref.isAfter(moment.utc(tsLater))).toBe(false);
  });

  test("isAfter with array input", () => {
    expect(ref.isAfter([2024, 5, 15, 10, 0, 0])).toBe(true);
    expect(ref.isAfter([2024, 5, 15, 12, 0, 0])).toBe(false);
    expect(ref.isAfter([2024, 5, 15, 14, 0, 0])).toBe(false);
  });

  test("isBefore with null/NaN input (should return false)", () => {
    // null input creates a valid 'now' moment, so this won't test invalid
    // Instead, we test that various types don't throw
    expect(() => ref.isAfter(undefined as never)).not.toThrow();
    expect(() => ref.isBefore(undefined as never)).not.toThrow();
    expect(() => ref.isSame(undefined as never)).not.toThrow();
    expect(() => ref.isSameOrAfter(undefined as never)).not.toThrow();
    expect(() => ref.isSameOrBefore(undefined as never)).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// 8. Metamorphic invariants (exclusivity, symmetry, clone independence)
// ---------------------------------------------------------------------------
describe("isAfter family: metamorphic invariants", () => {
  test("exclusivity: a.isAfter(b) = !(a.isBefore(b) || a.isSame(b))", () => {
    const pairs = [
      [moment.utc("2024-01-15"), moment.utc("2024-06-15")],
      [moment.utc("2024-06-15"), moment.utc("2024-01-15")],
      [moment.utc("2024-01-15"), moment.utc("2024-01-15")],
    ];
    for (const [a, b] of pairs) {
      expect(a.isAfter(b)).toBe(!(a.isBefore(b) || a.isSame(b)));
    }
  });

  test("symmetry: a.isAfter(b) = b.isBefore(a)", () => {
    const pairs = [
      [moment.utc("2024-01-15"), moment.utc("2024-06-15")],
      [moment.utc("2024-06-15"), moment.utc("2024-01-15")],
      [moment.utc("2024-01-15"), moment.utc("2024-01-15")],
    ];
    for (const [a, b] of pairs) {
      expect(a.isAfter(b)).toBe(b.isBefore(a));
    }
  });

  test("clone independence: a.clone().isAfter(b) = a.isAfter(b)", () => {
    const pairs = [
      [moment.utc("2024-01-15"), moment.utc("2024-06-15")],
      [moment.utc("2024-06-15"), moment.utc("2024-01-15")],
    ];
    for (const [a, b] of pairs) {
      expect(a.clone().isAfter(b)).toBe(a.isAfter(b));
      expect(a.isAfter(b.clone())).toBe(a.isAfter(b));
      expect(a.clone().isAfter(b.clone())).toBe(a.isAfter(b));
    }
  });

  test("isAfter agrees with diff > 0", () => {
    const pairs = [
      [moment.utc("2024-06-15"), moment.utc("2024-01-15")], // diff > 0
      [moment.utc("2024-01-15"), moment.utc("2024-06-15")], // diff < 0
      [moment.utc("2024-01-15"), moment.utc("2024-01-15")], // diff = 0
    ];
    for (const [a, b] of pairs) {
      const d = a.diff(b);
      expect(a.isAfter(b)).toBe(d > 0);
      expect(a.isBefore(b)).toBe(d < 0);
      expect(a.isSame(b)).toBe(d === 0);
    }
  });
});

// ---------------------------------------------------------------------------
// 9. isBetween with various unit types (exercises all _compareCalendarValues paths)
// ---------------------------------------------------------------------------
describe("isBetween with all unit types", () => {
  const m = moment.utc("2024-06-15T12:30:00.500");
  const from = moment.utc("2024-06-14T00:00:00");
  const to = moment.utc("2024-06-16T00:00:00");

  // Same-year dates need [] inclusivity since !isAfter for same-year
  test("isBetween with year unit (inclusive)", () => {
    expect(m.isBetween(from, to, "year", "[]")).toBe(true);
    // Exclusive: same year → isAfter false → false
    expect(m.isBetween(from, to, "year", "()")).toBe(false);
  });

  test("isBetween with month unit (inclusive)", () => {
    expect(m.isBetween(from, to, "month", "[]")).toBe(true);
  });

  test("isBetween with week unit (inclusive)", () => {
    expect(m.isBetween(from, to, "week", "[]")).toBe(true);
  });

  test("isBetween with isoWeek unit (inclusive)", () => {
    expect(m.isBetween(from, to, "isoWeek", "[]")).toBe(true);
  });

  test("isBetween with quarter unit (inclusive)", () => {
    expect(m.isBetween(from, to, "quarter", "[]")).toBe(true);
  });

  test("isBetween with day unit", () => {
    expect(m.isBetween(from, to, "day")).toBe(true);
  });

  test("isBetween with hour unit", () => {
    expect(m.isBetween(from, to, "hour")).toBe(true);
  });

  test("isBetween with minute unit", () => {
    expect(m.isBetween(from, to, "minute")).toBe(true);
  });

  test("isBetween with second unit", () => {
    expect(m.isBetween(from, to, "second")).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 10. Edge cases: equality at boundaries for single-unit comparisons
// ---------------------------------------------------------------------------
describe("isAfter family: boundary equality", () => {
  test("isSame at year boundary", () => {
    const dec31 = moment.utc("2024-12-31T23:59:59");
    const jan1 = moment.utc("2025-01-01T00:00:00");
    expect(dec31.isSame(jan1, "year")).toBe(false);
    expect(dec31.isBefore(jan1, "year")).toBe(true);
    expect(jan1.isAfter(dec31, "year")).toBe(true);
  });

  test("isSame at month boundary", () => {
    const jan31 = moment.utc("2024-01-31T23:59:59");
    const feb1 = moment.utc("2024-02-01T00:00:00");
    expect(jan31.isSame(feb1, "month")).toBe(false);
    expect(jan31.isBefore(feb1, "month")).toBe(true);
  });

  test("isSame at day boundary across midnight UTC", () => {
    const justBefore = moment.utc("2024-01-15T23:59:59.999");
    const justAfter = moment.utc("2024-01-16T00:00:00.000");
    expect(justBefore.isSame(justAfter, "day")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 11. isSameOrAfter / isSameOrBefore default millisecond unit
// ---------------------------------------------------------------------------
describe("isSameOrAfter/isSameOrBefore default millisecond unit", () => {
  test("isSameOrAfter default unit matches raw epoch comparison", () => {
    const a = moment.utc("2024-01-15T12:00:00");
    const b = moment.utc("2024-01-15T12:00:00.001");
    expect(a.isSameOrAfter(b)).toBe(false);
    expect(a.isSameOrAfter(b, "millisecond")).toBe(false);
    expect(a.clone().add(1, "ms").isSameOrAfter(b)).toBe(true);
  });

  test("isSameOrBefore default unit matches raw epoch comparison", () => {
    const a = moment.utc("2024-01-15T12:00:00.001");
    const b = moment.utc("2024-01-15T12:00:00");
    expect(a.isSameOrBefore(b)).toBe(false);
    expect(a.isSameOrBefore(b, "millisecond")).toBe(false);
    expect(b.isSameOrBefore(a)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 12. Ternary branches in _compareCalendarValues for each unit type
//     Each ternary (this._isUTC / other._isUTC) at lines 2341,2346,2351,2356,2380
//     needs both true/false branches covered.
// ---------------------------------------------------------------------------
describe("_compareCalendarValues: UTC ternary branches per unit type", () => {
  const ts = Date.UTC(2024, 0, 15, 12, 30, 45, 500);
  const ts2 = Date.UTC(2024, 0, 15, 12, 30, 46, 0);

  function assertTernaryBranch(
    label: string,
    unit: string,
    compareFn: (a: moment.Moment, b: moment.Moment, u: string) => boolean,
  ) {
    // 4 combos for _isUTC: (this, other) = (F,F), (F,T), (T,F), (T,T)
    const localA = moment(ts);
    const localB = moment(ts2);
    const utcA = moment.utc(ts);
    const utcB = moment.utc(ts2);

    // (F,F)
    expect(compareFn(localA, localB, unit)).toBe(true);
    expect(compareFn(localB, localA, unit)).toBe(false);
    // (F,T)
    expect(compareFn(localA, utcB, unit)).toBe(true);
    expect(compareFn(localB, utcA, unit)).toBe(false);
    // (T,F)
    expect(compareFn(utcA, localB, unit)).toBe(true);
    expect(compareFn(utcB, localA, unit)).toBe(false);
    // (T,T)
    expect(compareFn(utcA, utcB, unit)).toBe(true);
    expect(compareFn(utcB, utcA, unit)).toBe(false);

    // equal values → false for all combos
    expect(compareFn(localA, moment(ts), unit)).toBe(false);
    expect(compareFn(utcA, moment.utc(ts), unit)).toBe(false);
    expect(compareFn(localA, moment.utc(ts), unit)).toBe(false);
    expect(compareFn(utcA, moment(ts), unit)).toBe(false);
  }

  test("second unit — all 4 UTC ternary combos", () => {
    assertTernaryBranch("second", "second", (a, b, u) => a.isBefore(b, u));
  });

  test("minute unit — all 4 UTC ternary combos", () => {
    const m0 = moment.utc("2024-01-15T12:30:00");
    const m1 = moment.utc("2024-01-15T12:31:00");
    const l0 = moment(m0.valueOf());
    const l1 = moment(m1.valueOf());
    expect(l0.isBefore(l1, "minute")).toBe(true);
    expect(l0.isBefore(moment.utc(m1.valueOf()), "minute")).toBe(true);
    expect(moment.utc(m0.valueOf()).isBefore(l1, "minute")).toBe(true);
    expect(moment.utc(m0.valueOf()).isBefore(moment.utc(m1.valueOf()), "minute")).toBe(true);
  });

  test("hour unit — all 4 UTC ternary combos", () => {
    const m0 = moment.utc("2024-01-15T10:00:00");
    const m1 = moment.utc("2024-01-15T11:00:00");
    const l0 = moment(m0.valueOf());
    const l1 = moment(m1.valueOf());
    expect(l0.isBefore(l1, "hour")).toBe(true);
    expect(l0.isBefore(moment.utc(m1.valueOf()), "hour")).toBe(true);
    expect(moment.utc(m0.valueOf()).isBefore(l1, "hour")).toBe(true);
    expect(moment.utc(m0.valueOf()).isBefore(moment.utc(m1.valueOf()), "hour")).toBe(true);
  });

  test("millisecond unit — all 4 UTC ternary combos in _compareCalendarValues", () => {
    // isSameOrAfter/isSameOrBefore use _compareCalendarValues with "millisecond" by default
    // but isSame with unit="millisecond" also goes through _compareCalendarValues
    const ms_ts = Date.UTC(2024, 0, 15, 12, 0, 0, 100);
    const msLater = Date.UTC(2024, 0, 15, 12, 0, 0, 200);
    const localA = moment(ms_ts);
    const localB = moment(msLater);
    const utcA = moment.utc(ms_ts);
    const utcB = moment.utc(msLater);

    // (F,F)
    expect(localA.isSame(localB, "millisecond")).toBe(false);
    expect(localA.isBefore(localB, "millisecond")).toBe(true);
    // (F,T)
    expect(localA.isSame(utcB, "millisecond")).toBe(false);
    expect(localA.isBefore(utcB, "millisecond")).toBe(true);
    // (T,F)
    expect(utcA.isSame(localB, "millisecond")).toBe(false);
    expect(utcA.isBefore(localB, "millisecond")).toBe(true);
    // (T,T)
    expect(utcA.isSame(utcB, "millisecond")).toBe(false);
    expect(utcA.isBefore(utcB, "millisecond")).toBe(true);
  });

  test("day unit — UTC-day-floor path (line 2380) with both UTC and mixed modes", () => {
    // Both UTC: enters the "this._isUTC && other._isUTC" fast path
    const utc0 = moment.utc("2024-01-15T12:00:00");
    const utc1 = moment.utc("2024-01-16T00:00:00"); // different UTC day
    const utcSame = moment.utc("2024-01-15T23:59:59"); // same UTC day, triggers day-floor fallthrough

    // Both UTC, different days → uses day-floor
    expect(utc0.isBefore(utc1, "day")).toBe(true);
    // Both UTC, same day → falls through to field compare
    expect(utc0.isSame(utcSame, "day")).toBe(true);

    // Mixed UTC/local → skips "this._isUTC && other._isUTC" condition
    const local0 = moment(utc0.valueOf());
    const local1 = moment(utc1.valueOf());
    expect(local0.isBefore(utc1, "day")).toBe(true);
    expect(utc0.isBefore(local1, "day")).toBe(true);

    // Both local → skips as well
    expect(local0.isBefore(local1, "day")).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 13. Property-Based Testing: string inputs with/without offsets vs oracle
// ---------------------------------------------------------------------------
describe("PBT: isAfter family with string inputs (vs oracle)", () => {
  // Generate ISO date strings with various offset representations
  const isoStringArb = fc
    .date({ min: new Date("2000-01-01"), max: new Date("2030-12-31"), noInvalidDate: true })
    .chain((d) => {
      const plain = d.toISOString().replace(/\.\d{3}Z$/, ""); // "2024-01-15T12:00:00"
      const withZ = d.toISOString().replace(/\.\d{3}Z$/, "Z"); // "2024-01-15T12:00:00Z"
      // Generate random offset ±HH:MM
      const offsetH = fc.integer({ min: -12, max: 14 });
      const offsetM = fc.constantFrom(0, 30, 45);
      return fc
        .tuple(fc.constant(plain), fc.constant(withZ), fc.tuple(offsetH, offsetM))
        .map(([p, z, [oh, om]]) => {
          const sign = oh >= 0 ? "+" : "-";
          const absH = Math.abs(oh).toString().padStart(2, "0");
          const absM = om.toString().padStart(2, "0");
          // Adjust the base time by the offset to produce the correct wall clock
          const offsetMs = oh * 3600000 + om * 60000;
          const adjusted = new Date(d.getTime() + offsetMs);
          const wallIso = adjusted.toISOString().replace(/\.\d{3}Z$/, "");
          const withOffset = `${wallIso}${sign}${absH}:${absM}`;
          return fc.constantFrom(p, z, withOffset);
        })
        .chain((x) => x);
    });

  test("isAfter with ISO strings matches moment.js oracle", () => {
    fc.assert(
      fc.property(
        fc.date({ min: new Date("2000-01-01"), max: new Date("2030-12-31"), noInvalidDate: true }),
        isoStringArb,
        (base, str) => {
          const m = moment.utc(base);
          const om = originalMoment.utc(base);
          expect(m.isAfter(str)).toBe(om.isAfter(str));
        },
      ),
      { numRuns: 100 },
    );
  });

  test("isBefore with ISO strings matches moment.js oracle", () => {
    fc.assert(
      fc.property(
        fc.date({ min: new Date("2000-01-01"), max: new Date("2030-12-31"), noInvalidDate: true }),
        isoStringArb,
        (base, str) => {
          const m = moment.utc(base);
          const om = originalMoment.utc(base);
          expect(m.isBefore(str)).toBe(om.isBefore(str));
        },
      ),
      { numRuns: 100 },
    );
  });

  test("isSame with ISO strings matches moment.js oracle", () => {
    fc.assert(
      fc.property(
        fc.date({ min: new Date("2000-01-01"), max: new Date("2030-12-31"), noInvalidDate: true }),
        isoStringArb,
        (base, str) => {
          const m = moment.utc(base);
          const om = originalMoment.utc(base);
          expect(m.isSame(str)).toBe(om.isSame(str));
        },
      ),
      { numRuns: 100 },
    );
  });

  test("isSameOrAfter with ISO strings matches moment.js oracle", () => {
    fc.assert(
      fc.property(
        fc.date({ min: new Date("2000-01-01"), max: new Date("2030-12-31"), noInvalidDate: true }),
        isoStringArb,
        (base, str) => {
          const m = moment.utc(base);
          const om = originalMoment.utc(base);
          expect(m.isSameOrAfter(str)).toBe(om.isSameOrAfter(str));
        },
      ),
      { numRuns: 100 },
    );
  });

  test("isSameOrBefore with ISO strings matches moment.js oracle", () => {
    fc.assert(
      fc.property(
        fc.date({ min: new Date("2000-01-01"), max: new Date("2030-12-31"), noInvalidDate: true }),
        isoStringArb,
        (base, str) => {
          const m = moment.utc(base);
          const om = originalMoment.utc(base);
          expect(m.isSameOrBefore(str)).toBe(om.isSameOrBefore(str));
        },
      ),
      { numRuns: 100 },
    );
  });

  test("isBetween with ISO strings matches moment.js oracle", () => {
    fc.assert(
      fc.property(
        fc.date({ min: new Date("2000-01-01"), max: new Date("2030-12-31"), noInvalidDate: true }),
        isoStringArb,
        isoStringArb,
        (base, fromStr, toStr) => {
          const m = moment.utc(base);
          const om = originalMoment.utc(base);
          expect(m.isBetween(fromStr, toStr)).toBe(om.isBetween(fromStr, toStr));
        },
      ),
      { numRuns: 100 },
    );
  });

  test("isBetween with ISO strings + inclusivity matches oracle", () => {
    fc.assert(
      fc.property(
        fc.date({ min: new Date("2000-01-01"), max: new Date("2030-12-31"), noInvalidDate: true }),
        isoStringArb,
        isoStringArb,
        fc.constantFrom("()", "[]", "(]", "[)"),
        (base, fromStr, toStr, mode) => {
          const m = moment.utc(base);
          const om = originalMoment.utc(base);
          const from = originalMoment.min(originalMoment(fromStr), originalMoment(toStr));
          const to = originalMoment.max(originalMoment(fromStr), originalMoment(toStr));
          expect(m.isBetween(from.toISOString(), to.toISOString(), undefined, mode)).toBe(
            om.isBetween(from.toISOString(), to.toISOString(), undefined, mode),
          );
        },
      ),
      { numRuns: 100 },
    );
  });
});
