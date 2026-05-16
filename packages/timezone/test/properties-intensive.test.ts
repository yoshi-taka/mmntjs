/**
 * Larger property-based differential tests (test:hard only).
 * More zones, more runs, broader format coverage.
 */
import { describe, test, expect } from "bun:test";
import fc from "fast-check";
import { moment, momentTimezone } from "./helper";

const ZONES = [
  "UTC",
  "Asia/Tokyo",
  "Asia/Kolkata",
  "Asia/Taipei",
  "America/New_York",
  "America/Los_Angeles",
  "America/Phoenix",
  "America/Toronto",
  "Europe/London",
  "Europe/Berlin",
  "Europe/Stockholm",
  "Australia/Sydney",
  "Australia/Adelaide",
  "Pacific/Auckland",
  "Pacific/Chatham",
];

const MIN_TS = Date.UTC(2000, 0, 1, 0, 0, 0, 0);
const MAX_TS = Date.UTC(2030, 11, 31, 23, 59, 59, 999);

describe("property-intensive: format matches moment-timezone", () => {
  const timestamps = fc.integer({ min: MIN_TS, max: MAX_TS });
  const zones = fc.constantFrom(...ZONES);
  const formats = fc.constantFrom(
    "YYYY-MM-DDTHH:mm:ss.SSSZ",
    "YYYY-MM-DD HH:mm:ss",
    "YYYY/MM/DD",
    "MM/DD/YYYY HH:mm",
    "YYYY-MM-DD",
  );

  test("random timestamps across 15 zones", () => {
    fc.assert(
      fc.property(timestamps, zones, formats, (ts, zone, fmt) => {
        const mm = moment(ts).tz(zone);
        const om = momentTimezone(ts).tz(zone);
        expect(mm.valueOf()).toBe(om.valueOf());
        expect(mm.utcOffset()).toBe(om.utcOffset());
        expect(mm.format(fmt)).toBe(om.format(fmt));
      }),
      { numRuns: 2000 },
    );
  });
});

describe("property-intensive: tz() preserves valueOf", () => {
  const timestamps = fc.integer({ min: MIN_TS, max: MAX_TS });
  const zones = fc.constantFrom(...ZONES);

  test("valueOf invariant across all zones", () => {
    fc.assert(
      fc.property(timestamps, zones, (ts, zone) => {
        const base = moment(ts);
        const m = base.tz(zone);
        expect(m.valueOf()).toBe(base.valueOf());
      }),
      { numRuns: 500 },
    );
  });
});
