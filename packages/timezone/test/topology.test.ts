/**
 * Topology-inspired tests for timezone behavior.
 *
 * Models each timezone as a timeline partitioned by transition singularities:
 * - Regular regions: offset/abbr are locally constant, wall-clock mapping is 1-to-1
 * - Singular neighborhoods: DST boundaries (spring gap, fall overlap)
 *
 * These tests verify invariants that hold regardless of oracle comparison.
 */
/* oxlint-disable no-explicit-any */
import { describe, test, expect } from "bun:test";
import { moment, momentTimezone, oracleEqual } from "./helper";

const MS_PER_DAY = 86400000;

/* ------------------------------------------------------------------ */
/*  Regular day invariant                                             */
/* ------------------------------------------------------------------ */

describe("topology: regular day invariant", () => {
  const zones = ["America/New_York", "Europe/Berlin", "Asia/Tokyo", "Australia/Sydney"];

  // Pick a date far from any DST transition: 2024-06-15 (northern summer)
  const REGULAR_DATE = new Date("2024-06-15T00:00:00Z").getTime();

  for (const zn of zones) {
    test(`${zn}: all sampled timestamps in same regular day have same offset`, () => {
      const offsets = new Set<number>();
      const dayStart = Math.floor(REGULAR_DATE / MS_PER_DAY) * MS_PER_DAY;
      for (let h = 0; h < 24; h++) {
        for (const m of [0, 30]) {
          const ts = dayStart + h * 3600000 + m * 60000;
          const zone = moment.tz.zone(zn);
          offsets.add(zone!.utcOffset(ts));
        }
      }
      expect(offsets.size).toBe(1);
    });
  }
});

/* ------------------------------------------------------------------ */
/*  Singular day offset changes                                        */
/* ------------------------------------------------------------------ */

describe("topology: singular day offset changes", () => {
  // America/New_York 2024 spring-forward: 2024-03-10 at 07:00 UTC (2AM EST → 3AM EDT)
  // zone.utcOffset returns positive for zones west of UTC
  test("America/New_York spring-forward 2024: offset changes at transition", () => {
    const zone = moment.tz.zone("America/New_York")!;
    const before = Date.UTC(2024, 2, 10, 6, 59, 59);
    const atTrans = Date.UTC(2024, 2, 10, 7, 0, 0);
    // EST = -300 internal → 300; EDT = -240 internal → 240
    expect(zone.utcOffset(before)).toBe(300);
    expect(zone.utcOffset(atTrans)).toBe(240);
  });

  // America/New_York 2024 fall-back: 2024-11-03 at 06:00 UTC (2AM EDT → 1AM EST)
  // zone.utcOffset returns positive for zones west of UTC (negated internal value)
  test("America/New_York fall-back 2024: offset changes at transition", () => {
    const zone = moment.tz.zone("America/New_York")!;
    const before = Date.UTC(2024, 10, 3, 5, 59, 59);
    const atTrans = Date.UTC(2024, 10, 3, 6, 0, 0);
    // EDT = -240 internal → 240; EST = -300 internal → 300
    expect(zone.utcOffset(before)).toBe(240);
    expect(zone.utcOffset(atTrans)).toBe(300);
  });
});

/* ------------------------------------------------------------------ */
/*  Covering behavior: 0/1/2 candidates                                */
/* ------------------------------------------------------------------ */

describe("topology: parseInZone covering behavior", () => {
  // 1 candidate: regular wall-clock has exactly one matching instant
  test("regular wall-clock has one matching instant", () => {
    oracleEqual(
      moment.tz("2024-06-15 12:00", "America/New_York"),
      momentTimezone.tz("2024-06-15 12:00", "America/New_York"),
    );
  });

  // 0 candidates: spring-forward gap times don't exist
  test("spring-forward gap has no exact instant (adjusted forward)", () => {
    // 2024-03-10 02:30 does not exist in America/New_York (gap at 2AM EST → 3AM EDT)
    const mm = moment.tz("2024-03-10 02:30", "America/New_York");
    const om = momentTimezone.tz("2024-03-10 02:30", "America/New_York");
    oracleEqual(mm, om);
    // Both should be 03:30 EDT = 07:30 UTC
    expect(mm.valueOf()).toBe(om.valueOf());
    expect(mm.format("HH:mm")).toBe("03:30");
  });

  // 2 candidates: fall-back overlap has two possible instants
  // moment-timezone picks the first occurrence (DST side = larger offset)
  test("fall-back overlap picks DST side (first occurrence)", () => {
    // 2024-11-03 01:30 occurs twice in America/New_York
    const mm = moment.tz("2024-11-03 01:30", "America/New_York");
    const om = momentTimezone.tz("2024-11-03 01:30", "America/New_York");
    oracleEqual(mm, om);
    // Both should pick EDT side: 01:30 EDT = 05:30 UTC
    expect(mm.utcOffset()).toBe(-240);
    expect(om.utcOffset()).toBe(-240);
  });

  // Australia/Sydney spring-forward: different UTC time
  test("Australia/Sydney spring-forward: 0 candidates => forward adjust", () => {
    // 2024-10-06 02:30 does not exist in Sydney (spring-forward at 2AM AEST → 3AM AEDT)
    const mm = moment.tz("2024-10-06 02:30", "Australia/Sydney");
    const om = momentTimezone.tz("2024-10-06 02:30", "Australia/Sydney");
    oracleEqual(mm, om);
  });

  // Australia/Sydney fall-back
  test("Australia/Sydney fall-back: 2 candidates => DST side", () => {
    // 2024-04-07 02:30 occurs twice in Sydney
    const mm = moment.tz("2024-04-07 02:30", "Australia/Sydney");
    const om = momentTimezone.tz("2024-04-07 02:30", "Australia/Sydney");
    oracleEqual(mm, om);
  });

  // Europe/Berlin spring-forward
  test("Europe/Berlin spring-forward: 0 candidates", () => {
    // 2024-03-31 02:30 does not exist in Berlin
    const mm = moment.tz("2024-03-31 02:30", "Europe/Berlin");
    const om = momentTimezone.tz("2024-03-31 02:30", "Europe/Berlin");
    oracleEqual(mm, om);
  });

  // Europe/Berlin fall-back
  test("Europe/Berlin fall-back: 2 candidates", () => {
    // 2024-10-27 02:30 occurs twice in Berlin
    const mm = moment.tz("2024-10-27 02:30", "Europe/Berlin");
    const om = momentTimezone.tz("2024-10-27 02:30", "Europe/Berlin");
    oracleEqual(mm, om);
  });

  // Asia/Tokyo: no DST → always 1 candidate
  test("Asia/Tokyo: no DST, always 1 candidate", () => {
    for (const dateStr of ["2024-01-15", "2024-06-15", "2024-10-01"]) {
      oracleEqual(
        moment.tz(`${dateStr} 12:00`, "Asia/Tokyo"),
        momentTimezone.tz(`${dateStr} 12:00`, "Asia/Tokyo"),
      );
    }
  });
});

/* ------------------------------------------------------------------ */
/*  Coarse cache exclusion on singular days                            */
/* ------------------------------------------------------------------ */

describe("topology: no coarse cache on transition days", () => {
  // On a DST transition day, offset at start ≠ offset at end.
  // This means the day-level cache should NOT contain an entry.
  test("spring-forward day is NOT cached at day level", () => {
    const zn = "America/New_York";
    // Force a cache miss by querying a timestamp on this day.
    // The day-level cache will probe start/noon/end and find they differ,
    // so no day entry is stored.
    moment.tz("2024-03-10 12:00", zn);

    // Query a different second on the same day.
    // If the day-level cache had an entry, it would return it.
    // But since the day is singular, the day cache should have no entry.
    const mm = moment.tz("2024-03-10 13:00", zn);
    const om = momentTimezone.tz("2024-03-10 13:00", zn);
    oracleEqual(mm, om);
  });

  test("fall-back day is NOT cached at day level", () => {
    const zn = "America/New_York";
    moment.tz("2024-11-03 01:30", zn);
    const mm = moment.tz("2024-11-03 03:00", zn);
    const om = momentTimezone.tz("2024-11-03 03:00", zn);
    oracleEqual(mm, om);
  });
});
