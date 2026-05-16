/* oxlint-disable no-explicit-any */
import { expect } from "bun:test";
import _moment from "mmntjs";
import { installTimezone } from "../src/install";
import _momentTimezone from "moment-timezone";

installTimezone(_moment as any);

export const moment = _moment as any;
export const momentTimezone = _momentTimezone as any;

/**
 * Compare mmntjs-timezone output against moment-timezone oracle.
 * This is the primary assertion helper for all timezone tests.
 *
 * Checks (in order):
 * - isValid()
 * - valueOf()
 * - utcOffset()
 * - format()
 * - format("YYYY-MM-DDTHH:mm:ss.SSSZ")
 * - format("z"), format("zz")
 * - zoneAbbr(), zoneName()
 * - tz()
 * - utc().format("YYYY-MM-DDTHH:mm:ss.SSS[Z]")
 */
export function oracleEqual(
  mm: any,
  om: any,
  opts?: {
    skipAbbr?: boolean;
    skipOffset?: boolean;
    skipTz?: boolean;
    skipZoneName?: boolean;
  },
): void {
  expect(mm.isValid()).toBe(om.isValid());
  if (!om.isValid()) {
    return;
  }

  // valueOf must match (same instant)
  expect(mm.valueOf()).toBe(om.valueOf());

  // utcOffset must match
  if (!opts?.skipOffset) {
    expect(mm.utcOffset()).toBe(om.utcOffset());
  }

  // Default format must match
  expect(mm.format()).toBe(om.format());

  // ISO format with offset must match
  expect(mm.format("YYYY-MM-DDTHH:mm:ss.SSSZ")).toBe(om.format("YYYY-MM-DDTHH:mm:ss.SSSZ"));

  // UTC format — clone first since .utc() mutates the moment
  expect(mm.clone().utc().format("YYYY-MM-DDTHH:mm:ss.SSS[Z]")).toBe(
    om.clone().utc().format("YYYY-MM-DDTHH:mm:ss.SSS[Z]"),
  );

  // Timezone abbreviation in format
  if (!opts?.skipAbbr) {
    expect(mm.format("z")).toBe(om.format("z"));
    expect(mm.format("zz")).toBe(om.format("zz"));
  }

  // Zone abbreviation API
  if (!opts?.skipAbbr) {
    expect(mm.zoneAbbr()).toBe(om.zoneAbbr());
  }

  // Zone name API
  if (!opts?.skipZoneName) {
    expect(mm.zoneName()).toBe(om.zoneName());
  }

  // tz() getter should return the zone name when both have _z set
  if (!opts?.skipTz) {
    const mmTz = mm.tz();
    const omTz = om.tz();
    if (typeof mmTz === "string" && typeof omTz === "string") {
      expect(mmTz).toBe(omTz);
    }
  }
}

/**
 * Run oracle comparison across a matrix of timestamps and zones.
 */
export function oracleZoneMatrix(
  timestamps: number[],
  zones: string[],
  opts?: { skipAbbr?: boolean; skipZoneName?: boolean },
): void {
  for (const zone of zones) {
    for (const ts of timestamps) {
      const mm = moment(ts).tz(zone);
      const om = momentTimezone(ts).tz(zone);
      oracleEqual(mm, om, opts);
    }
  }
}

/** Standard zone matrix used across tests */
export const STANDARD_ZONES = [
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

/** A fixed timestamp in EDT/CEST season */
export const TS_EDT = 1587126975779; // 2020-04-17 12:36:15 UTC

/** Winter and summer timestamps */
export const TS_WINTER = Date.UTC(2024, 0, 15, 12, 0, 0, 0);
export const TS_SUMMER = Date.UTC(2024, 6, 15, 12, 0, 0, 0);
