/**
 * Regression test fixtures.
 *
 * Whenever a mismatch is found between mmntjs-timezone and moment-timezone,
 * add a named regression test FIRST, then fix the implementation.
 *
 * Each regression test includes:
 * - input, zone, expected oracle behavior
 * - bug class description
 *
 * Do not weaken tests to match current implementation.
 */
/* oxlint-disable no-explicit-any */
import { describe, test, expect } from "bun:test";
import { moment, momentTimezone, oracleEqual } from "./helper";

describe("regression: parse vs convert distinction", () => {
  test("parse vs convert must not collapse", () => {
    // Bug class: parse-in-zone and convert-to-zone must produce different instants
    // for the same wall-clock string when the zone is not UTC.
    const parsed = moment.tz("2013-11-18 11:55", "Asia/Taipei");
    const converted = moment("2013-11-18T11:55:00Z").tz("Asia/Taipei");
    expect(parsed.valueOf()).not.toBe(converted.valueOf());
  });
});

describe("regression: tz() instant preservation", () => {
  test("tz() roundtrip preserves exact instant", () => {
    const ts = 1587126975779;
    const m = moment.utc(ts).tz("Asia/Tokyo");
    expect(m.valueOf()).toBe(ts);
    expect(m.utc().valueOf()).toBe(ts);
  });
});

describe("regression: DST boundary resolution", () => {
  test("spring-forward ambiguous wall-clock resolves same as moment-timezone", () => {
    oracleEqual(
      moment.tz("2012-03-11 02:30:00", "America/New_York"),
      momentTimezone.tz("2012-03-11 02:30:00", "America/New_York"),
    );
  });

  test("fall-back ambiguous wall-clock resolves same as moment-timezone", () => {
    oracleEqual(
      moment.tz("2012-11-04 01:30:00", "America/New_York"),
      momentTimezone.tz("2012-11-04 01:30:00", "America/New_York"),
    );
  });
});

describe("regression: zone abbreviation consistency", () => {
  test("Asia/Kolkata abbreviation matches oracle", () => {
    const ts = 1587126975779;
    const mm = moment.tz.zone("Asia/Kolkata")?.abbr(ts);
    const om = momentTimezone.tz.zone("Asia/Kolkata")?.abbr(ts);
    expect(mm).toBe(om);
  });

  test("Europe/Stockholm summer abbreviation matches oracle", () => {
    const ts = 1587126975779; // summer for northern hemisphere
    const mm = moment.tz.zone("Europe/Stockholm")?.abbr(ts);
    const om = momentTimezone.tz.zone("Europe/Stockholm")?.abbr(ts);
    expect(mm).toBe(om);
  });
});

describe("regression: keepLocalTime valueOf difference", () => {
  test("keepLocalTime=true produces different instant than keepLocalTime=false", () => {
    const base = moment.utc("2024-06-15T12:00:00Z");
    const noKeep = base.clone().tz("Europe/Berlin");
    const keep = base.clone().tz("Europe/Berlin", true);
    expect(noKeep.valueOf()).not.toBe(keep.valueOf());
  });
});

/* ------------------------------------------------------------------ */
/*  DST transition second cache correctness                            */
/* ------------------------------------------------------------------ */

describe("regression: DST transition second boundary", () => {
  const ZONE_NY = "America/New_York";

  test("spring-forward 2024: offset flips at exact transition second", () => {
    // zone.offset uses west-positive convention (deprecated moment-timezone compat)
    const beforeMs = Date.UTC(2024, 2, 10, 6, 59, 59, 999); // EST = +300
    const afterMs = Date.UTC(2024, 2, 10, 7, 0, 0, 0); // EDT = +240
    const zone = moment.tz.zone(ZONE_NY)!;
    const oracleZone = momentTimezone.tz.zone(ZONE_NY)!;
    expect(zone.offset(beforeMs)).toBe(oracleZone.offset(beforeMs));
    expect(zone.offset(afterMs)).toBe(oracleZone.offset(afterMs));
    expect(zone.offset(beforeMs)).toBe(300);
    expect(zone.offset(afterMs)).toBe(240);
  });

  test("fall-back 2024: offset flips at exact transition second", () => {
    const beforeMs = Date.UTC(2024, 10, 3, 5, 59, 59, 999); // EDT = +240
    const afterMs = Date.UTC(2024, 10, 3, 6, 0, 0, 0); // EST = +300
    const zone = moment.tz.zone(ZONE_NY)!;
    const oracleZone = momentTimezone.tz.zone(ZONE_NY)!;
    expect(zone.offset(beforeMs)).toBe(oracleZone.offset(beforeMs));
    expect(zone.offset(afterMs)).toBe(oracleZone.offset(afterMs));
    expect(zone.offset(beforeMs)).toBe(240);
    expect(zone.offset(afterMs)).toBe(300);
  });

  test("cache returns correct offset when queried after→before across transition", () => {
    const zone = moment.tz.zone(ZONE_NY)!;
    const oracleZone = momentTimezone.tz.zone(ZONE_NY)!;
    const afterMs = Date.UTC(2024, 2, 10, 7, 0, 0, 0);
    const beforeMs = Date.UTC(2024, 2, 10, 6, 59, 59, 999);
    expect(zone.offset(afterMs)).toBe(oracleZone.offset(afterMs)); // EDT cache populates
    expect(zone.offset(beforeMs)).toBe(oracleZone.offset(beforeMs)); // different key → EST
    expect(zone.offset(afterMs)).toBe(240);
    expect(zone.offset(beforeMs)).toBe(300);
  });

  test("same-second bucket after transition is consistent", () => {
    const zone = moment.tz.zone(ZONE_NY)!;
    const afterMs = Date.UTC(2024, 2, 10, 7, 0, 0, 0);
    const afterMsLater = Date.UTC(2024, 2, 10, 7, 0, 0, 500);
    expect(zone.offset(afterMs)).toBe(240);
    expect(zone.offset(afterMsLater)).toBe(240);
  });

  test("zone.offset matches oracle across years and seasons", () => {
    const zone = moment.tz.zone(ZONE_NY)!;
    const oracleZone = momentTimezone.tz.zone(ZONE_NY)!;
    for (const year of [2000, 2010, 2020, 2024, 2030]) {
      for (const month of [0, 6]) {
        const ts = Date.UTC(year, month, 15, 12, 0, 0, 0);
        expect(zone.offset(ts)).toBe(oracleZone.offset(ts));
      }
    }
  });

  test("abbr cache does not return stale value across DST transition", () => {
    const zone = moment.tz.zone(ZONE_NY)!;
    const oracleZone = momentTimezone.tz.zone(ZONE_NY)!;
    const beforeMs = Date.UTC(2024, 2, 10, 6, 59, 59, 999);
    const afterMs = Date.UTC(2024, 2, 10, 7, 0, 0, 0);
    expect(zone.abbr(beforeMs)).toBe(oracleZone.abbr(beforeMs));
    expect(zone.abbr(afterMs)).toBe(oracleZone.abbr(afterMs));
    expect(zone.abbr(beforeMs)).toBe("EST");
    expect(zone.abbr(afterMs)).toBe("EDT");
  });

  test("abbr cache reverse query order", () => {
    // Query after first, then before — both must still be correct
    const zone = moment.tz.zone(ZONE_NY)!;
    const beforeMs = Date.UTC(2024, 2, 10, 6, 59, 59, 999);
    const afterMs = Date.UTC(2024, 2, 10, 7, 0, 0, 0);
    expect(zone.abbr(afterMs)).toBe("EDT");
    expect(zone.abbr(beforeMs)).toBe("EST");
  });
});
