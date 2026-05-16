/**
 * Property-based differential tests: mmntjs-timezone vs moment-timezone.
 * Deterministic with fixed seed and representative zones.
 */
import { describe, test, expect } from "bun:test";
import fc from "fast-check";
import { moment, momentTimezone } from "./helper";

const ZONES = [
  "UTC",
  "Asia/Tokyo",
  "Asia/Kolkata",
  "America/New_York",
  "America/Los_Angeles",
  "Europe/London",
  "Europe/Berlin",
  "Australia/Sydney",
];

const MIN_TS = Date.UTC(2000, 0, 1, 0, 0, 0, 0);
const MAX_TS = Date.UTC(2030, 11, 31, 23, 59, 59, 999);

describe("property: format matches moment-timezone", () => {
  const timestamps = fc.integer({ min: MIN_TS, max: MAX_TS });
  const zones = fc.constantFrom(...ZONES);
  const formatStr = fc.constantFrom(
    "YYYY-MM-DDTHH:mm:ss.SSSZ",
    "YYYY-MM-DD HH:mm:ss",
    "YYYY/MM/DD",
  );

  test("moment(ts).tz(zone).format(fmt) matches oracle", () => {
    fc.assert(
      fc.property(timestamps, zones, formatStr, (ts, zone, fmt) => {
        const mm = moment(ts).tz(zone);
        const om = momentTimezone(ts).tz(zone);
        expect(mm.valueOf()).toBe(om.valueOf());
        expect(mm.utcOffset()).toBe(om.utcOffset());
        expect(mm.format(fmt)).toBe(om.format(fmt));
      }),
      { numRuns: 200 },
    );
  });
});

describe("property: utcOffset and valueOf invariant", () => {
  const timestamps = fc.integer({ min: MIN_TS, max: MAX_TS });
  const zones = fc.constantFrom(...ZONES);

  test("tz zone preserves valueOf", () => {
    fc.assert(
      fc.property(timestamps, zones, (ts, zone) => {
        const base = moment(ts);
        const m = base.tz(zone);
        expect(m.valueOf()).toBe(base.valueOf());
      }),
      { numRuns: 100 },
    );
  });
});
