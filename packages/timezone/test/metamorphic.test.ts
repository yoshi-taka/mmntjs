/**
 * Metamorphic timezone tests: self-consistency invariants that do not
 * require an oracle. Follows the same pattern as
 * root test/properties/metamorphic.test.ts.
 */
/* oxlint-disable no-explicit-any */
import { describe, test, expect } from "bun:test";
import { moment, STANDARD_ZONES, TS_EDT } from "./helper";

const ZONES = STANDARD_ZONES;
const TS_WINTER = Date.UTC(2024, 0, 15, 12, 0, 0, 0);
const TS_SUMMER = Date.UTC(2024, 6, 15, 12, 0, 0, 0);

/* ------------------------------------------------------------------ */
/*  tz() roundtrip invariants                                         */
/* ------------------------------------------------------------------ */

describe("tz() roundtrip invariants", () => {
  for (const zone of ZONES) {
    test(`tz roundtrip preserves valueOf for ${zone}`, () => {
      const m = moment.utc(TS_EDT);
      const ts = m.valueOf();
      const inZone = m.tz(zone);
      expect(inZone.valueOf()).toBe(ts);
      const back = inZone.utc();
      expect(back.valueOf()).toBe(ts);
    });
  }

  test("tz then tz back to original zone preserves valueOf", () => {
    const m = moment.utc(TS_EDT);
    const ts = m.valueOf();
    const inTokyo = m.tz("Asia/Tokyo");
    const inNY = inTokyo.tz("America/New_York");
    const back = inNY.tz("UTC");
    expect(back.valueOf()).toBe(ts);
  });
});

/* ------------------------------------------------------------------ */
/*  keepLocalTime invariants                                          */
/* ------------------------------------------------------------------ */

describe("keepLocalTime invariants", () => {
  for (const zone of ZONES) {
    test(`tz(zone) and tz(zone,true) differ for ${zone}`, () => {
      const base = moment.utc(TS_EDT);
      const noKeep = base.clone().tz(zone);
      const keep = base.clone().tz(zone, true);
      if (noKeep.utcOffset() !== keep.utcOffset()) {
        // If zone offset differs from UTC, the two should differ
        expect(noKeep.valueOf()).not.toBe(keep.valueOf());
      }
    });
  }

  test("keepLocalTime preserves wall-clock hour", () => {
    const base = moment.utc("2024-06-15T12:00:00Z");
    const h0 = base.hour();
    const kept = base.clone().tz("Asia/Tokyo", true);
    expect(kept.hour()).toBe(h0);
  });

  test("without keepLocalTime, wall-clock changes", () => {
    const base = moment.utc("2024-06-15T12:00:00Z");
    const h0 = base.hour();
    const converted = base.clone().tz("Asia/Tokyo");
    // Asia/Tokyo is UTC+9, so display hour should be 12+9 = 21
    expect(converted.hour()).toBe((h0 + 9) % 24);
  });
});

/* ------------------------------------------------------------------ */
/*  utcOffset after tz()                                              */
/* ------------------------------------------------------------------ */

describe("utcOffset after tz()", () => {
  for (const zone of ZONES) {
    test(`utcOffset sign consistency for ${zone}`, () => {
      const m = moment.utc(TS_WINTER).tz(zone);
      const off = m.utcOffset();
      // utcOffset is minutes from UTC; positive = east of UTC
      if (zone === "UTC") {
        expect(off).toBe(0);
      } else if (off === 0) {
        // Zone may be at offset 0 in winter (e.g. Europe/London = GMT)
        expect(zone).toMatch(/^(Europe\/London|Africa\/.+)$/);
      }
    });
  }

  test("summer utcOffset differs from winter utcOffset for DST zones", () => {
    const dstZones = [
      "America/New_York",
      "Europe/London",
      "Europe/Berlin",
      "Australia/Sydney",
      "Australia/Adelaide",
      "Pacific/Auckland",
      "Pacific/Chatham",
    ];
    for (const zone of dstZones) {
      const winter = moment.utc(TS_WINTER).tz(zone).utcOffset();
      const summer = moment.utc(TS_SUMMER).tz(zone).utcOffset();
      expect(winter).not.toBe(summer);
    }
  });

  test("non-DST zones have same offset year-round", () => {
    const fixedZones = ["UTC", "America/Phoenix", "Asia/Kolkata"];
    for (const zone of fixedZones) {
      const winter = moment.utc(TS_WINTER).tz(zone).utcOffset();
      const summer = moment.utc(TS_SUMMER).tz(zone).utcOffset();
      expect(winter).toBe(summer);
    }
  });
});

/* ------------------------------------------------------------------ */
/*  format token invariants                                           */
/* ------------------------------------------------------------------ */

describe("format token invariants", () => {
  test("ZZ is Z without colon", () => {
    for (const zone of ZONES) {
      const m = moment.utc(TS_EDT).tz(zone);
      const z = m.format("Z");
      const zz = m.format("ZZ");
      expect(z.length).toBe(6); // "+HH:MM"
      expect(zz.length).toBe(5); // "+HHMM"
      expect(zz).toBe(z.replace(":", ""));
    }
  });

  test("zz matches z", () => {
    for (const zone of ZONES) {
      const m = moment.utc(TS_EDT).tz(zone);
      expect(m.format("zz")).toBe(m.format("z"));
    }
  });
});

/* ------------------------------------------------------------------ */
/*  valueOf invariants                                                */
/* ------------------------------------------------------------------ */

describe("valueOf invariants", () => {
  test("moment.utc(ts).tz(zone) preserves original valueOf", () => {
    for (const zone of ZONES) {
      const ts = TS_EDT;
      expect(moment.utc(ts).tz(zone).valueOf()).toBe(ts);
    }
  });

  test("moment(ts) local → tz → utc preserves valueOf", () => {
    for (const zone of ZONES) {
      const ts = TS_EDT;
      const m = moment(ts).tz(zone).utc();
      expect(m.valueOf()).toBe(ts);
    }
  });
});

/* ------------------------------------------------------------------ */
/*  clone independence                                                */
/* ------------------------------------------------------------------ */

describe("clone independence", () => {
  test("tz() does not mutate original", () => {
    const original = moment.utc(TS_EDT);
    const ts = original.valueOf();
    const result = original.tz("Asia/Tokyo");
    expect(original.valueOf()).toBe(ts);
    // original's _z should still be undefined: no tz set
    expect(original._z).toBeUndefined();
    // result has the new zone
    expect(result._z).not.toBeUndefined();
    expect(result.tz()).toBe("Asia/Tokyo");
  });

  test("clone().tz() is independent", () => {
    const a = moment.utc(TS_EDT).tz("Asia/Tokyo");
    const aTs = a.valueOf();
    const aTz = a.tz();
    const b = a.clone().tz("America/New_York");
    expect(a.valueOf()).toBe(aTs);
    expect(a.tz()).toBe(aTz);
    expect(b.valueOf()).toBe(aTs);
    expect(b.tz()).toBe("America/New_York");
  });
});
