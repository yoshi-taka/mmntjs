/**
 * Equivalence class tests for timezone inputs.
 * Follows the same pattern as root test/properties/equivalence.test.ts.
 * Partitions input space into valid/invalid/boundary classes.
 */
/* oxlint-disable no-explicit-any */
import { describe, test, expect } from "bun:test";
import { moment, momentTimezone, oracleEqual, oracleZoneMatrix, STANDARD_ZONES } from "./helper";

/* ------------------------------------------------------------------ */
/*  Zone categories                                                    */
/* ------------------------------------------------------------------ */

const ZONE_CATEGORIES = {
  utc: ["UTC"],
  fixed: ["America/Phoenix", "Asia/Kolkata"], // no DST
  dstNorthern: ["America/New_York", "Europe/London", "Europe/Berlin", "America/Los_Angeles"],
  dstSouthern: ["Australia/Sydney", "Australia/Adelaide", "Pacific/Auckland"],
  unusual: ["Pacific/Chatham"], // +12:45/+13:45
} as const;

describe("zone category equivalence", () => {
  const SUMMER_NORTH = Date.UTC(2024, 6, 15, 12, 0, 0, 0);
  const WINTER_NORTH = Date.UTC(2024, 0, 15, 12, 0, 0, 0);
  const BOUNDARY = Date.UTC(2024, 2, 10, 7, 0, 0, 0); // DST transition

  for (const [cat, zones] of Object.entries(ZONE_CATEGORIES)) {
    test(`${cat} zones match oracle at summer`, () => {
      oracleZoneMatrix([SUMMER_NORTH], zones);
    });
    test(`${cat} zones match oracle at winter`, () => {
      oracleZoneMatrix([WINTER_NORTH], zones);
    });
    test(`${cat} zones match oracle at DST boundary`, () => {
      oracleZoneMatrix([BOUNDARY], zones);
    });
  }

  test("UTC offset is always 0", () => {
    for (const ts of [WINTER_NORTH, SUMMER_NORTH, BOUNDARY, 0, 946684800000]) {
      const m = moment(ts).tz("UTC");
      expect(m.utcOffset()).toBe(0);
      expect(m.format("z")).toBe("UTC");
    }
  });
});

/* ------------------------------------------------------------------ */
/*  Input type equivalence                                            */
/* ------------------------------------------------------------------ */

describe("input type equivalence", () => {
  const TS = Date.UTC(2024, 5, 15, 12, 30, 45, 0);

  const inputPairs: {
    label: string;
    oracleInput: any;
    mmInput: any;
  }[] = [
    { label: "number timestamp", oracleInput: TS, mmInput: TS },
    { label: "Date object", oracleInput: new Date(TS), mmInput: new Date(TS) },
  ];

  for (const { label, oracleInput, mmInput } of inputPairs) {
    test(`${label} to America/New_York matches oracle`, () => {
      oracleEqual(
        moment(mmInput).tz("America/New_York"),
        momentTimezone(oracleInput).tz("America/New_York"),
      );
    });
  }
});

/* ------------------------------------------------------------------ */
/*  Validation equivalence                                            */
/* ------------------------------------------------------------------ */

describe("validation equivalence", () => {
  const INVALID_ZONES = ["", "Invalid/Zone", "America/Invalid_City", "UTC/Invalid", "Europe/"];

  for (const badZone of INVALID_ZONES) {
    test(`moment.tz.zone("${badZone}") returns null`, () => {
      expect(moment.tz.zone(badZone)).toBeNull();
    });
  }

  test("moment.tz() with invalid zone after input parsing is handled", () => {
    // moment.tz(123, "Invalid/Zone") should fall back gracefully
    const m = moment.tz(123, "Invalid/Zone");
    expect(m.isValid()).toBe(true);
  });
});

/* ------------------------------------------------------------------ */
/*  Boundary timestamps                                                */
/* ------------------------------------------------------------------ */

describe("boundary timestamp equivalence", () => {
  const BOUNDARY_TS = [
    { label: "epoch", ts: 0 },
    { label: "year 2000", ts: Date.UTC(2000, 0, 1, 0, 0, 0, 0) },
    { label: "year 2030", ts: Date.UTC(2030, 11, 31, 23, 59, 59, 999) },
    { label: "leap day", ts: Date.UTC(2024, 1, 29, 12, 0, 0, 0) },
    { label: "not leap day", ts: Date.UTC(2023, 1, 28, 12, 0, 0, 0) },
  ];

  for (const { label, ts } of BOUNDARY_TS) {
    test(`${label} across all standard zones matches oracle`, () => {
      // Epoch uses historical abbreviations (BST, etc.) that Intl
      // may not know — skip abbreviation comparison for ts=0
      const opts = ts === 0 ? { skipAbbr: true, skipZoneName: true } : undefined;
      oracleZoneMatrix([ts], STANDARD_ZONES, opts);
    });
  }
});
