/**
 * Zone object API: moment.tz.zone().
 *
 * All behavioral expectations come from moment-timezone oracle.
 * No hand-written zone names, offsets, or abbreviations.
 */
/* oxlint-disable no-explicit-any */
import { describe, test, expect } from "bun:test";
import {
  moment,
  momentTimezone,
  oracleEqual,
  oracleZoneMatrix,
  STANDARD_ZONES,
  TS_WINTER,
  TS_SUMMER,
  TS_EDT,
} from "./helper";

const TEST_TIMESTAMPS = [TS_EDT, TS_WINTER, TS_SUMMER];

/* ------------------------------------------------------------------ */
/*  moment.tz.zone() — API surface                                    */
/* ------------------------------------------------------------------ */

describe("moment.tz.zone()", () => {
  test("returns zone object for valid zone", () => {
    const z = moment.tz.zone("America/New_York");
    expect(z).not.toBeNull();
  });

  test("returns null for invalid zone", () => {
    expect(moment.tz.zone("Invalid/Zone")).toBeNull();
    expect(moment.tz.zone("")).toBeNull();
  });

  test("zone.name matches oracle", () => {
    for (const zn of STANDARD_ZONES) {
      const mm = moment.tz.zone(zn)?.name;
      const om = momentTimezone.tz.zone(zn)?.name;
      expect(mm).toBe(om);
    }
  });

  test("zone.abbr matches oracle at multiple timestamps", () => {
    for (const zn of STANDARD_ZONES) {
      for (const ts of TEST_TIMESTAMPS) {
        const mm = moment.tz.zone(zn)?.abbr(ts);
        const om = momentTimezone.tz.zone(zn)?.abbr(ts);
        expect(mm).toBe(om);
      }
    }
  });

  test("zone.offset matches oracle at multiple timestamps", () => {
    for (const zn of STANDARD_ZONES) {
      for (const ts of TEST_TIMESTAMPS) {
        const mm = moment.tz.zone(zn)?.offset(ts);
        const om = momentTimezone.tz.zone(zn)?.offset(ts);
        expect(mm).toBe(om);
      }
    }
  });

  test("zone.utcOffset matches oracle at multiple timestamps", () => {
    for (const zn of STANDARD_ZONES) {
      for (const ts of TEST_TIMESTAMPS) {
        const mm = moment.tz.zone(zn)?.utcOffset(ts);
        const om = momentTimezone.tz.zone(zn)?.utcOffset(ts);
        expect(mm).toBe(om);
      }
    }
  });

  test("zone.parse matches oracle (returns offset number)", () => {
    for (const zn of STANDARD_ZONES) {
      for (const ts of TEST_TIMESTAMPS) {
        const mm = moment.tz.zone(zn)?.parse(ts);
        const om = momentTimezone.tz.zone(zn)?.parse(ts);
        expect(mm).toBe(om);
      }
    }
  });
});

/* ------------------------------------------------------------------ */
/*  Zone matrix: winter + summer across all standard zones            */
/* ------------------------------------------------------------------ */

describe("zone matrix (winter + summer)", () => {
  test("all standard zones match oracle at winter + summer", () => {
    oracleZoneMatrix([TS_WINTER, TS_SUMMER], STANDARD_ZONES, { skipZoneName: true });
  });
});

/* ------------------------------------------------------------------ */
/*  Additional zone edge cases                                        */
/* ------------------------------------------------------------------ */

describe("additional zones", () => {
  test("America/Phoenix (no DST)", () => {
    oracleEqual(
      moment.utc(TS_EDT).tz("America/Phoenix"),
      momentTimezone.utc(TS_EDT).tz("America/Phoenix"),
    );
  });

  test("America/Toronto", () => {
    oracleEqual(
      moment.utc(TS_EDT).tz("America/Toronto"),
      momentTimezone.utc(TS_EDT).tz("America/Toronto"),
    );
  });

  test("Pacific/Chatham", () => {
    oracleEqual(moment(TS_EDT).tz("Pacific/Chatham"), momentTimezone(TS_EDT).tz("Pacific/Chatham"));
  });
});
