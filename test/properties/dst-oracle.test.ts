/* oxlint-disable */
import { describe, test, expect } from "bun:test";
import fc from "fast-check";
import baseMoment from "../../src/index.ts";
import { installTimezone } from "../../packages/timezone/src/install.ts";
import { BUILTIN_TZDATA } from "../../packages/timezone/src/builtin-data.generated.ts";

installTimezone(baseMoment as any, BUILTIN_TZDATA);
// oxlint-disable-next-line no-explicit-any
const moment = baseMoment as any;
// oxlint-disable-next-line no-explicit-any
const originalMoment = momentTimezone as any;
originalMoment.suppressDeprecationWarnings = true;

const DST_BOUNDARIES: Record<string, { spring: number; fall: number }> = {
  "America/New_York": {
    spring: Date.UTC(2024, 2, 10, 7, 0, 0, 0),
    fall: Date.UTC(2024, 10, 3, 6, 0, 0, 0),
  },
  "Europe/London": {
    spring: Date.UTC(2024, 2, 31, 1, 0, 0, 0),
    fall: Date.UTC(2024, 9, 27, 1, 0, 0, 0),
  },
  "Australia/Sydney": {
    spring: Date.UTC(2024, 9, 6, 16, 0, 0, 0),
    fall: Date.UTC(2024, 3, 7, 16, 0, 0, 0),
  },
};

function tsAround(center: number, days: number) {
  const spread = days * 86400000;
  return fc.integer({ min: center - spread, max: center + spread });
}

for (const [tz, { spring, fall }] of Object.entries(DST_BOUNDARIES)) {
  describe(`DST oracle: ${tz}`, () => {
    test("spring-forward (±3 days)", () => {
      fc.assert(
        fc.property(tsAround(spring, 3), (ts) => {
          const m2 = moment(ts).tz(tz);
          const mo = originalMoment(ts).tz(tz);
          expect(m2.isValid()).toBe(mo.isValid());
          if (!m2.isValid()) return;
          expect(m2.valueOf()).toBe(mo.valueOf());
          expect(m2.utcOffset()).toBe(mo.utcOffset());
          expect(m2.isDST()).toBe(mo.isDST());
          expect(m2.format()).toBe(mo.format());
          expect(m2.format("YYYY-MM-DD HH:mm:ss.SSS")).toBe(mo.format("YYYY-MM-DD HH:mm:ss.SSS"));
          expect(m2.format("ZZ")).toBe(mo.format("ZZ"));
        }),
        { numRuns: 200 },
      );
    });

    test("fall-back (±3 days)", () => {
      fc.assert(
        fc.property(tsAround(fall, 3), (ts) => {
          const m2 = moment(ts).tz(tz);
          const mo = originalMoment(ts).tz(tz);
          expect(m2.isValid()).toBe(mo.isValid());
          if (!m2.isValid()) return;
          expect(m2.valueOf()).toBe(mo.valueOf());
          expect(m2.utcOffset()).toBe(mo.utcOffset());
          expect(m2.isDST()).toBe(mo.isDST());
          expect(m2.format()).toBe(mo.format());
          expect(m2.format("YYYY-MM-DD HH:mm:ss.SSS")).toBe(mo.format("YYYY-MM-DD HH:mm:ss.SSS"));
          expect(m2.format("ZZ")).toBe(mo.format("ZZ"));
        }),
        { numRuns: 200 },
      );
    });
  });
}

describe("DST oracle: UTC roundtrip near boundaries", () => {
  test("spring-forward: utc → local → utc preserves valueOf", () => {
    fc.assert(
      fc.property(tsAround(DST_BOUNDARIES["America/New_York"].spring, 3), (ts) => {
        const m2 = moment.utc(ts).tz("America/New_York").utc();
        const mo = originalMoment.utc(ts).tz("America/New_York").utc();
        expect(m2.valueOf()).toBe(mo.valueOf());
        expect(m2.format()).toBe(mo.format());
      }),
      { numRuns: 200 },
    );
  });

  test("fall-back: utc → local → utc preserves valueOf", () => {
    fc.assert(
      fc.property(tsAround(DST_BOUNDARIES["America/New_York"].fall, 3), (ts) => {
        const m2 = moment.utc(ts).tz("America/New_York").utc();
        const mo = originalMoment.utc(ts).tz("America/New_York").utc();
        expect(m2.valueOf()).toBe(mo.valueOf());
        expect(m2.format()).toBe(mo.format());
      }),
      { numRuns: 200 },
    );
  });
});
