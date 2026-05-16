/**
 * Intentional compatibility limits.
 *
 * These APIs exist as compatibility shims but do not provide full
 * drop-in behavior. Documented non-goals:
 *
 * - tz.add() — no-op (timezone data comes from runtime Intl)
 * - tz.link() — no-op
 * - tz.countries() — returns empty array
 * - tz.zonesForCountry() — returns empty array
 *
 * Each test verifies the no-op behavior and also documents
 * what the moment-timezone oracle WOULD do.
 */
/* oxlint-disable no-explicit-any */
import { describe, test, expect } from "bun:test";
import { moment, momentTimezone } from "./helper";

describe("intentional non-goals", () => {
  test("moment.tz.add() is a no-op — data from Intl, not packed tzdb", () => {
    const namesBefore = moment.tz.names().length;
    moment.tz.add({
      "Asia/Test_Zone": {
        name: "Asia/Test_Zone",
        abbrs: ["TEST"],
        offsets: [0],
        untils: [Infinity],
      },
    });
    // No new zone was added (our implementation does not support tzdb loading)
    expect(moment.tz.names().length).toBe(namesBefore);
    expect(moment.tz.zone("Asia/Test_Zone")).toBeNull();
  });

  test("moment.tz.link() is a no-op — zone aliases from Intl, not tzdb", () => {
    moment.tz.link({ "US/Eastern": "America/New_York" });
    // moment-timezone would make US/Eastern an alias for America/New_York
    // Our implementation does not — zone resolution stays unchanged
    expect(moment.tz.zone("US/Eastern")).toBeNull();
    expect(moment.tz.zone("America/New_York")).not.toBeNull();
  });

  test("moment.tz.countries() returns empty array", () => {
    const c = moment.tz.countries();
    expect(Array.isArray(c)).toBe(true);
    expect(c.length).toBe(0);
    // moment-timezone would return populated arrays
    const om = momentTimezone.tz.countries();
    expect(om.length).toBeGreaterThan(0);
    expect(c.length).not.toBe(om.length);
  });

  test("moment.tz.zonesForCountry() returns empty array", () => {
    expect(moment.tz.zonesForCountry("US")).toEqual([]);
    expect(moment.tz.zonesForCountry("JP")).toEqual([]);
    expect(moment.tz.zonesForCountry("AU")).toEqual([]);
    expect(moment.tz.zonesForCountry("GB")).toEqual([]);
    expect(moment.tz.zonesForCountry("")).toEqual([]);
  });
});
