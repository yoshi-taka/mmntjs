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
  "-055555-05",
  "-000700-005",
  "-881802-88",
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

const BASIC_ISO_DATETIMES = [
  "20240615T12",
  "20240615T1230",
  "20240615T123045.1Z",
  "20240615T123045.123456+0900",
  "20240615T123045,12-04:30",
];

const EXTENDED_ISO_VARIABLE_FRACTION_DATETIMES = [
  "2024-06-15T12:30:45.1Z",
  "2024-06-15T12:30:45.123456+0900",
  "2024-06-15T12:30:45,12-04:30",
];

test.each(BASIC_ISO_DATETIMES)("basic ISO datetime scanner matches moment: %s", (input) => {
  const m2 = moment(input);
  const mo = originalMoment(input);
  expect(m2.isValid()).toBe(mo.isValid());
  if (m2.isValid() && mo.isValid()) {
    expect(m2.valueOf()).toBe(mo.valueOf());
  }
});

test.each(EXTENDED_ISO_VARIABLE_FRACTION_DATETIMES)(
  "extended ISO fraction scanner matches moment: %s",
  (input) => {
    const m2 = moment(input);
    const mo = originalMoment(input);
    expect(m2.isValid()).toBe(mo.isValid());
    if (m2.isValid() && mo.isValid()) {
      expect(m2.valueOf()).toBe(mo.valueOf());
    }
  },
);

test.each(["20240615T123045", "20240615T240000", "20240229T123045", "20240230T123045"])(
  "basic ISO format fast path matches moment: %s",
  (input) => {
    const format = "YYYYMMDD[T]HHmmss";
    const m2 = moment(input, format);
    const mo = originalMoment(input, format);
    expect(m2.isValid()).toBe(mo.isValid());
    if (m2.isValid() && mo.isValid()) {
      expect(m2.valueOf()).toBe(mo.valueOf());
    }
  },
);

test("slash date format array fast path matches moment", () => {
  const input = "2024/06/15";
  const formats = ["YYYY-MM-DD", "YYYY/MM/DD", "DD/MM/YYYY"];
  const m2 = moment(input, formats);
  const mo = originalMoment(input, formats);
  expect(m2.isValid()).toBe(mo.isValid());
  expect(m2.valueOf()).toBe(mo.valueOf());
});

test.each(["2024/06/15", "2024/02/29", "2024/02/30"])(
  "slash date format fast path matches moment: %s",
  (input) => {
    const format = "YYYY/MM/DD";
    const m2 = moment(input, format);
    const mo = originalMoment(input, format);
    expect(m2.isValid()).toBe(mo.isValid());
    if (m2.isValid() && mo.isValid()) {
      expect(m2.valueOf()).toBe(mo.valueOf());
    }
  },
);

test.each(["15 January 2024", "29 February 2024", "29 February 2023", "15 june 2024"])(
  "English month format fast path matches moment: %s",
  (input) => {
    const format = "DD MMMM YYYY";
    const m2 = moment(input, format);
    const mo = originalMoment(input, format);
    expect(m2.isValid()).toBe(mo.isValid());
    if (m2.isValid() && mo.isValid()) {
      expect(m2.valueOf()).toBe(mo.valueOf());
    }
  },
);

test("invalid extended ISO datetime remains invalid", () => {
  const input = "2024-99-99T25:61:61";
  expect(moment(input).isValid()).toBe(originalMoment(input).isValid());
});

test("extended ISO end of day remains valid", () => {
  const input = "2024-06-15T24:00:00";
  const m2 = moment(input);
  const mo = originalMoment(input);
  expect(m2.isValid()).toBe(mo.isValid());
  expect(m2.valueOf()).toBe(mo.valueOf());
});

const FIXED_UTC = [
  "constructoror.",
  "",
  "0010",
  "0011",
  "0000",
  "0066",
  "0050",
  "0055",
  "-110990-09",
];

test.each(FIXED_UTC)("FIXED (utc): %s", (input) => {
  const m2 = moment.utc(input);
  const mo = originalMoment.utc(input);
  expect(m2.isValid()).toBe(mo.isValid());
  if (m2.isValid() && mo.isValid()) {
    expect(m2.valueOf()).toBe(mo.valueOf());
  }
});

// ── Group 2: KNOWN_DIFF — pin current mmntjs behavior ──

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

// ── Group 4: PBT counterexamples (fast-check property failures) ──
// Generated by: bun run scripts/pbt-regression.ts --seed <N> --values '<JSON>' --desc '<text>'

test("PBT: set('hour',24) normalizes to 0", () => {
  const d = new Date("1970-01-01T00:00:00.000Z");
  const m2 = moment(d);
  const mo = originalMoment(d);
  m2.set("hour", 24);
  mo.set("hour", 24);
  expect(m2.hour()).toBe(mo.hour());
  expect(m2.valueOf()).toBe(mo.valueOf());
});


test("PBT: PBT seed=1631974943", () => {
  const vals = [{"text":"2003-01-01T00:00:00.000+00:00","offset":0}, {"text":"2003-01-01T00:00:00.000+00:15","offset":15}, "month"];
  // TODO: adapt assertion to match the original property
  // seed=1631974943
});
// ── Group 5: ISO week W53 regression (factory-shared.ts maxWeeks fix) ──

// Years with 53 ISO weeks via "Jan 1 is Thursday" rule
// (previously broken: old dayOfJan4||dayOfDec31 check missed these)
const W53_THURSDAY = ["1976-W53", "2004-W53", "2032-W53", "2060-W53", "2088-W53"];

// Years with 53 ISO weeks via "leap year + Jan 1 is Wednesday" rule
const W53_WEDNESDAY_LEAP = ["2020-W53", "2048-W53", "2076-W53"];

test.each(W53_THURSDAY)("W53 regression (Thursday-start): %s", (input) => {
  const m2 = moment(input);
  const mo = originalMoment(input);
  expect(m2.isValid()).toBe(true);
  expect(mo.isValid()).toBe(true);
  expect(m2.valueOf()).toBe(mo.valueOf());
});

test.each(W53_WEDNESDAY_LEAP)("W53 regression (Wed-leap): %s", (input) => {
  const m2 = moment(input);
  const mo = originalMoment(input);
  expect(m2.isValid()).toBe(true);
  expect(mo.isValid()).toBe(true);
  expect(m2.valueOf()).toBe(mo.valueOf());
});

// W52 should always be valid; W54 always invalid
test.each(["1976-W52", "2004-W52", "2032-W52", "2020-W52"])("W52 always valid: %s", (input) => {
  const m2 = moment(input);
  const mo = originalMoment(input);
  expect(m2.isValid()).toBe(true);
  expect(mo.isValid()).toBe(true);
  expect(m2.valueOf()).toBe(mo.valueOf());
});

test.each(["1976-W54", "2004-W54", "2020-W54", "2030-W54"])("W54 always invalid: %s", (input) => {
  const m2 = moment(input);
  const mo = originalMoment(input);
  expect(m2.isValid()).toBe(false);
  expect(mo.isValid()).toBe(false);
});
