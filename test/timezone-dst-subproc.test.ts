// This file is run as a subprocess with a specific TZ environment variable
// to test DST boundary behavior.
// It uses only moment.js (original) for reference, comparing against mmntjs.
import moment from "../src/index.ts";
import originalMoment from "../moment/moment.js";
import { describe, test, expect } from "bun:test";

function compareMoments(mm: ReturnType<typeof moment>, om: ReturnType<typeof originalMoment>) {
  expect(mm.valueOf()).toBe(om.valueOf());
  expect(mm.utcOffset()).toBe(om.utcOffset());
  expect(mm.hours()).toBe(om.hours());
  expect(mm.minutes()).toBe(om.minutes());
  expect(mm.isDST()).toBe(om.isDST());
}

function getTZ(): string {
  return process.env.TZ ?? "(unset)";
}

describe(`DST tests under TZ=${getTZ()}`, () => {
  test("historical spring gap refreshes fields after week subtraction", () => {
    if (getTZ() !== "Asia/Tokyo") {
      return;
    }
    const input = new Date("1949-12-10T15:59:59.999Z");
    const mm = moment(input).add(-36, "weeks");
    const om = originalMoment(input).add(-36, "weeks");
    expect(mm.valueOf()).toBe(om.valueOf());
    expect(mm.toArray()).toEqual(om.toArray());
    expect(mm.hours()).toBe(mm.toDate().getHours());
  });

  test("historical fall-back reports DST on both sides of the boundary", () => {
    if (getTZ() !== "Asia/Tokyo") {
      return;
    }
    for (const input of ["1950-09-09T14:59:59.999Z", "1950-09-09T15:00:00.000Z"]) {
      const mm = moment(input);
      const om = originalMoment(input);
      expect(mm.utcOffset()).toBe(om.utcOffset());
      expect(mm.isDST()).toBe(om.isDST());
    }
  });

  // ==============================
  // SPRING FORWARD (nonexistent local times)
  // ==============================
  describe("spring-forward", () => {
    // In America/New_York, spring-forward happens at 2024-03-10 02:00 local
    // Clocks spring forward to 03:00. The time 02:00-02:59:59 does not exist.
    test("nonexistent time 02:30 before spring-forward is interpreted by JS Date", () => {
      // JS Date handles this by adjusting forward
      const mm = moment("2024-03-10T02:30:00");
      const om = originalMoment("2024-03-10T02:30:00");
      compareMoments(mm, om);
    });

    test("01:59:59 just before spring-forward", () => {
      const mm = moment("2024-03-10T01:59:59");
      const om = originalMoment("2024-03-10T01:59:59");
      compareMoments(mm, om);
    });

    test("03:00:00 just after spring-forward", () => {
      const mm = moment("2024-03-10T03:00:00");
      const om = originalMoment("2024-03-10T03:00:00");
      compareMoments(mm, om);
    });

    test("isDST after spring-forward", () => {
      const mm = moment("2024-03-10T12:00:00");
      const om = originalMoment("2024-03-10T12:00:00");
      expect(mm.isDST()).toBe(om.isDST());
    });
  });

  // ==============================
  // FALL BACK (duplicated local times)
  // ==============================
  describe("fall-back", () => {
    // In America/New_York, fall-back happens at 2024-11-03 02:00 local
    // Clocks fall back to 01:00. The time 01:00-01:59:99 occurs TWICE.

    test("01:30 before fall-back (first occurrence, EDT)", () => {
      const mm = moment("2024-11-03T01:30:00");
      const om = originalMoment("2024-11-03T01:30:00");
      compareMoments(mm, om);
    });

    // moment() without parseZone at "01:30" on fall-back day:
    // JS Date interprets this as the SECOND occurrence (EST, after fall-back)
    // moment.js follows JS Date behavior for this

    test("01:30:00.001 after fall-back (EDT)", () => {
      const mm = moment("2024-11-03T01:30:00.001");
      const om = originalMoment("2024-11-03T01:30:00.001");
      compareMoments(mm, om);
    });

    test("02:00 after clocks fall back to 01:00 (now EST)", () => {
      const mm = moment("2024-11-03T02:00:00");
      const om = originalMoment("2024-11-03T02:00:00");
      compareMoments(mm, om);
    });

    test("isDST before fall-back (EDT)", () => {
      const mm = moment("2024-11-03T00:30:00");
      const om = originalMoment("2024-11-03T00:30:00");
      expect(mm.isDST()).toBe(om.isDST());
      // In America/New_York, this should be EDT (still DST)
    });

    test("isDST after fall-back (EST)", () => {
      const mm = moment("2024-11-03T03:00:00");
      const om = originalMoment("2024-11-03T03:00:00");
      expect(mm.isDST()).toBe(om.isDST());
      // In America/New_York, this should be EST (not DST)
    });

    test("isDST in summer should be true", () => {
      const mm = moment("2024-07-04T12:00:00");
      const om = originalMoment("2024-07-04T12:00:00");
      expect(mm.isDST()).toBe(om.isDST());
    });

    test("isDST in winter should be false", () => {
      const mm = moment("2024-01-15T12:00:00");
      const om = originalMoment("2024-01-15T12:00:00");
      expect(mm.isDST()).toBe(om.isDST());
    });
  });

  // ==============================
  // LOCAL/UTC/FIXED-OFFSET TRANSITIONS NEAR DST
  // ==============================
  describe("DST boundary transitions", () => {
    // Test roundtrip: valueOf should be preserved when going local->utc->local near DST
    test("valueOf preserved across local->utc->local near spring-forward", () => {
      // A date well after spring-forward
      const mm = moment("2024-03-15T12:00:00");
      const v = mm.valueOf();
      mm.utc();
      expect(mm.valueOf()).toBe(v);
      mm.local();
      expect(mm.valueOf()).toBe(v);
    });

    test("valueOf preserved across local->utc->local near fall-back", () => {
      // A date after fall-back
      const mm = moment("2024-11-10T12:00:00");
      const v = mm.valueOf();
      mm.utc();
      expect(mm.valueOf()).toBe(v);
      mm.local();
      expect(mm.valueOf()).toBe(v);
    });

    // utcOffset(..., true) near DST boundaries
    test("keepLocalTime near spring-forward", () => {
      // Use a time after spring-forward, when offset is already DST
      const mm = moment("2024-03-10T12:00:00");
      const om = originalMoment("2024-03-10T12:00:00");
      mm.utcOffset(120, true);
      om.utcOffset(120, true);
      expect(mm.hours()).toBe(om.hours());
      expect(mm.minutes()).toBe(om.minutes());
      expect(mm.utcOffset()).toBe(om.utcOffset());
      expect(mm.valueOf()).toBe(om.valueOf());
    });

    test("keepLocalTime near fall-back", () => {
      const mm = moment("2024-11-03T12:00:00");
      const om = originalMoment("2024-11-03T12:00:00");
      mm.utcOffset(-60, true);
      om.utcOffset(-60, true);
      expect(mm.hours()).toBe(om.hours());
      expect(mm.minutes()).toBe(om.minutes());
      expect(mm.utcOffset()).toBe(om.utcOffset());
      expect(mm.valueOf()).toBe(om.valueOf());
    });

    // UTC moment should never claim DST
    test("UTC moment isDST is false near spring-forward date", () => {
      expect(moment.utc("2024-03-10T07:00:00").isDST()).toBe(false);
      expect(moment.utc("2024-07-04T12:00:00").isDST()).toBe(false);
      expect(moment.utc("2024-11-03T06:00:00").isDST()).toBe(false);
    });

    // Fixed-offset moments should never claim DST
    test("fixed-offset isDST is false", () => {
      const mm = moment("2024-07-04T12:00:00").utcOffset(60);
      const om = originalMoment("2024-07-04T12:00:00").utcOffset(60);
      expect(mm.isDST()).toBe(om.isDST());
    });
  });

  // ==============================
  // FORMAT TOKENS NEAR DST
  // ==============================
  describe("format near DST", () => {
    test("format with Z/ZZ matches moment.js near spring-forward", () => {
      const mm = moment("2024-03-10T12:00:00");
      const om = originalMoment("2024-03-10T12:00:00");
      expect(mm.format("YYYY-MM-DD HH:mm:ss Z")).toBe(om.format("YYYY-MM-DD HH:mm:ss Z"));
      expect(mm.format("YYYY-MM-DD HH:mm:ss ZZ")).toBe(om.format("YYYY-MM-DD HH:mm:ss ZZ"));
    });

    test("format with Z/ZZ matches moment.js near fall-back", () => {
      const mm = moment("2024-11-03T04:00:00");
      const om = originalMoment("2024-11-03T04:00:00");
      expect(mm.format("YYYY-MM-DD HH:mm:ss Z")).toBe(om.format("YYYY-MM-DD HH:mm:ss Z"));
      expect(mm.format("YYYY-MM-DD HH:mm:ss ZZ")).toBe(om.format("YYYY-MM-DD HH:mm:ss ZZ"));
    });
  });
});
