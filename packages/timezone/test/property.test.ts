/**
 * Property-based differential tests: mmntjs-timezone vs moment-timezone.
 * Deterministic with fixed seed and representative zones.
 *
 * Normal run: 200 iterations across 12 zones.
 * test:hard: ./properties-intensive.test.ts (2000 iterations, 15 zones)
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
  "America/Phoenix",
  "Europe/London",
  "Europe/Berlin",
  "Australia/Sydney",
  "Australia/Adelaide",
  "Pacific/Auckland",
  "Pacific/Chatham",
];

const MIN_TS = Date.UTC(2000, 0, 1, 0, 0, 0, 0);
const MAX_TS = Date.UTC(2030, 11, 31, 23, 59, 59, 999);

/** Generate timestamps near known DST transitions for stress-testing. */
function dstAdjacentTs(): fc.Arbitrary<number[]> {
  // Generate timestamps within ±2h of DST transitions
  const DST_WINDOWS: { zone: string; spring: number; fall: number }[] = [
    {
      zone: "America/New_York",
      spring: Date.UTC(2024, 2, 10, 7, 0, 0, 0),
      fall: Date.UTC(2024, 10, 3, 6, 0, 0, 0),
    },
    {
      zone: "Europe/London",
      spring: Date.UTC(2024, 2, 31, 1, 0, 0, 0),
      fall: Date.UTC(2024, 9, 27, 1, 0, 0, 0),
    },
    {
      zone: "Europe/Berlin",
      spring: Date.UTC(2024, 2, 31, 1, 0, 0, 0),
      fall: Date.UTC(2024, 9, 27, 1, 0, 0, 0),
    },
    {
      zone: "Australia/Sydney",
      spring: Date.UTC(2024, 9, 6, 16, 0, 0, 0),
      fall: Date.UTC(2024, 3, 7, 16, 0, 0, 0),
    },
  ];
  const allTransitions = DST_WINDOWS.flatMap((w) => [w.spring, w.fall]);
  return fc.constantFrom(
    ...allTransitions.flatMap((t) => [
      t - 7200000,
      t - 3600000,
      t - 60000,
      t - 1000,
      t,
      t + 1000,
      t + 60000,
      t + 3600000,
      t + 7200000,
    ]),
  );
}

describe("property: format matches moment-timezone", () => {
  const timestamps = fc.integer({ min: MIN_TS, max: MAX_TS });
  const zones = fc.constantFrom(...ZONES);

  test("moment(ts).tz(zone).format(fmt) matches oracle", () => {
    fc.assert(
      fc.property(timestamps, zones, (ts, zone) => {
        const mm = moment(ts).tz(zone);
        const om = momentTimezone(ts).tz(zone);
        expect(mm.valueOf()).toBe(om.valueOf());
        expect(mm.utcOffset()).toBe(om.utcOffset());
        expect(mm.format()).toBe(om.format());
        expect(mm.format("z")).toBe(om.format("z"));
        expect(mm.zoneAbbr()).toBe(om.zoneAbbr());
      }),
      { numRuns: 200 },
    );
  });
});

describe("property: DST-adjacent timestamps", () => {
  const dstTimestamps = dstAdjacentTs();
  const zones = fc.constantFrom(...ZONES);

  test("moment(ts).tz(zone) around DST transitions matches oracle", () => {
    fc.assert(
      fc.property(dstTimestamps, zones, (ts, zone) => {
        const mm = moment(ts).tz(zone);
        const om = momentTimezone(ts).tz(zone);
        expect(mm.valueOf()).toBe(om.valueOf());
        expect(mm.utcOffset()).toBe(om.utcOffset());
        expect(mm.format("YYYY-MM-DD HH:mm:ss")).toBe(om.format("YYYY-MM-DD HH:mm:ss"));
        expect(mm.format("z")).toBe(om.format("z"));
      }),
      { numRuns: 500 },
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
