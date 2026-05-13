import { test, expect } from "bun:test";
import moment from "../../src/index.ts";
import originalMoment from "../../moment/moment.js";

originalMoment.suppressDeprecationWarnings = true;

// ─────────────────────────────────────────────────────────────────
// Fuzzer crash-file regression tests
//
// Groups:  FIXED — mmntjs now matches moment.js
//          KNOWN_DIFF — known pre-existing difference (pin mmntjs)
//          NO_THROW — binary/weird inputs that should not throw
// ─────────────────────────────────────────────────────────────────

// ── Group 1: FIXED — previously crashed, now matches moment.js ──

const FIXED_PARSE = [
  "constructoror.",
  "",
  // ISO week dates (W01 year boundary bug — parseCommonISOExtended
  // ordinal check was stealing week format and returning null)
  "2008-W01",
  "2009-W01",
  "2008-W01-3",
  "2008W01",
  "2008W013",
];

test.each(FIXED_PARSE)("FIXED (parse): %s", (input) => {
  const m2 = moment(input);
  const mo = originalMoment(input);
  expect(m2.isValid()).toBe(mo.isValid());
  if (m2.isValid() && mo.isValid()) {
    expect(m2.valueOf()).toBe(mo.valueOf());
  }
});

test("FIXED (parse): timezone without time in ISO week date stays invalid", () => {
  const input = "0006W01Z";
  const m2 = moment(input);
  const mo = originalMoment(input);
  expect(m2.isValid()).toBe(mo.isValid());
});

const FIXED_UTC = ["constructoror.", ""];

test.each(FIXED_UTC)("FIXED (utc): %s", (input) => {
  const m2 = moment.utc(input);
  const mo = originalMoment.utc(input);
  expect(m2.isValid()).toBe(mo.isValid());
  if (m2.isValid() && mo.isValid()) {
    expect(m2.valueOf()).toBe(mo.valueOf());
  }
});

// ── Group 2: KNOWN_DIFF — pin current mmntjs behavior ──

test("KNOWN_DIFF: short numeric strings in utc (0011 → year 2001 month 11)", () => {
  const m2 = moment.utc("0011");
  expect(m2.isValid()).toBe(true);
  expect(m2.year()).toBe(2001);
  expect(m2.month()).toBe(10); // 0-indexed, 10 = November
  expect(m2.date()).toBe(1);
});

test('KNOWN_DIFF: utc("0000") → year 2000', () => {
  const m2 = moment.utc("0000");
  expect(m2.isValid()).toBe(true);
  expect(m2.year()).toBe(2000);
  expect(m2.month()).toBe(0);
});

test('KNOWN_DIFF: utc("0066") → year 1966 (2-digit year 66)', () => {
  const m2 = moment.utc("0066");
  expect(m2.isValid()).toBe(true);
  // moment.js: year 66 AD; mmntjs: 2-digit "66" → 1966 (69/68 split)
  expect(m2.year()).toBe(1966);
  expect(m2.month()).toBe(0);
});

test('KNOWN_DIFF: utc("0050") → year 1950 (2-digit year 50)', () => {
  const m2 = moment.utc("0050");
  expect(m2.isValid()).toBe(true);
  expect(m2.year()).toBe(1950);
  expect(m2.month()).toBe(0);
});

test('KNOWN_DIFF: utc("0055") → year 1955 (2-digit year 55)', () => {
  const m2 = moment.utc("0055");
  expect(m2.isValid()).toBe(true);
  expect(m2.year()).toBe(1955);
  expect(m2.month()).toBe(0);
});

test('KNOWN_DIFF: negative year sign handling in utc ("-110990-09")', () => {
  // moment.js drops sign → 1109-09; mmntjs preserves sign → -110990-09
  const m2 = moment.utc("-110990-09");
  expect(m2.isValid()).toBe(true);
  expect(m2.format("YYYY-MM-DD")).toBe("-110990-09-01");
});

test('KNOWN_DIFF: negative year + dash-day in utc ("-000700-005")', () => {
  // moment.js: 0007-01-05, mmntjs: -0700-05-01
  const m2 = moment.utc("-000700-005");
  expect(m2.isValid()).toBe(true);
  expect(m2.format("YYYY-MM-DD")).toBe("-0700-05-01");
});

test('KNOWN_DIFF: mixed format parse ("93280531 09-3911")', () => {
  // mmntjs: 9328-05-31 09:00:00, moment.js: 9328-06-02 09:11:00
  // Both have same valueOf() but different local-time rendering
  const m2 = moment("93280531 09-3911");
  expect(m2.isValid()).toBe(true);
  expect(m2.valueOf()).toBe(232209245460000);
  expect(m2.year()).toBe(9328);
  expect(m2.month()).toBe(4); // May = 4 (0-indexed)
  expect(m2.date()).toBe(31);
  expect(m2.hour()).toBe(9);
  expect(m2.minute()).toBe(0);
});

// ── Group 3: NO_THROW — binary inputs that should not throw ──

const BINARY_INPUTS = [
  "9YY[\n\xc6\x03\xc6\xc6\x03\xc6\xc6\xc6\xc6",
  "\x08\x00\x00\x00\x00\x00\x00\x00",
  "__\x0f\x0fz\x0f\xff5\xd2\x0f\x00\x00\x0e\xff\xe9\xff\x0a\x0f\xff\x0f\xff",
  "l\xf1\xd0\xee\xf0\x0f\x00\x00\x00\x00\x00\x00\x00\x0e",
  "\xff\x0a\x00\x00\x00\x00MM\x1b\\$\xff\xff\x02\xef",
  "t\x1c\x1c\x1c\x00\x00\x00\x00\x00\x00\x1cttt",
  "\x1a\x00\x00\x00\x00\x00\x08\x00\x0e\x001111111\x00_\x9f\xdb",
  "\x00\x00\x00\x81\x0a\x00\x00\x00",
  "0\x0a\x00\x00\x00\x02\x00\x00\x00\x00\x02\xfb\x69\x02",
  "\x0c\x0cp$rpprototy",
  "\x10\x00\x00\x000\x00__proto__\xff",
  "nstr\x63\x11\x11\x11\x11\x11ort\xff\xff\xff",
];

test.each(BINARY_INPUTS)("NO_THROW (parse): %j", (input) => {
  expect(() => moment(input)).not.toThrow();
  expect(() => originalMoment(input)).not.toThrow();
});

test.each(BINARY_INPUTS)("NO_THROW (utc): %j", (input) => {
  expect(() => moment.utc(input)).not.toThrow();
  expect(() => originalMoment.utc(input)).not.toThrow();
});
