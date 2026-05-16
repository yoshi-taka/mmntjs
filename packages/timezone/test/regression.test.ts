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
