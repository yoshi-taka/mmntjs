/**
 * Default timezone behavior: moment.tz.setDefault().
 *
 * Verified against moment-timezone oracle wherever the behavior
 * is supported. Documented limitations reflect current state.
 */
/* oxlint-disable no-explicit-any */
import { describe, test, expect, afterEach } from "bun:test";
import { moment, momentTimezone, oracleEqual } from "./helper";

describe("moment.tz.setDefault", () => {
  const savedDefault = moment.defaultZone;

  afterEach(() => {
    moment.defaultZone = savedDefault;
  });

  test("setDefault stores the zone name", () => {
    moment.tz.setDefault("America/New_York");
    expect(moment.defaultZone).toBe("America/New_York");
  });

  test("moment.tz(explicit, zone) still uses explicit zone (oracle)", () => {
    moment.tz.setDefault("America/New_York");
    oracleEqual(
      moment.tz("2024-01-15 12:00", "Asia/Tokyo"),
      momentTimezone.tz("2024-01-15 12:00", "Asia/Tokyo"),
    );
  });

  test("moment.utc() after default set is still UTC (oracle)", () => {
    moment.tz.setDefault("America/New_York");
    const m = moment.utc("2024-06-15T12:00:00");
    const om = momentTimezone.utc("2024-06-15T12:00:00");
    expect(m.isUTC()).toBe(om.isUTC());
    expect(m.utcOffset()).toBe(om.utcOffset());
  });

  test("moment.tz(input, format, zone) still works after default (oracle)", () => {
    moment.tz.setDefault("America/New_York");
    oracleEqual(
      moment.tz("01/15/2024", "MM/DD/YYYY", "Asia/Tokyo"),
      momentTimezone.tz("01/15/2024", "MM/DD/YYYY", "Asia/Tokyo"),
    );
  });

  test("moment.tz(ts, zone) still works after default (oracle)", () => {
    moment.tz.setDefault("America/New_York");
    const ts = 1587126975779;
    oracleEqual(moment.tz(ts, "Asia/Tokyo"), momentTimezone.tz(ts, "Asia/Tokyo"));
  });

  test("reset default zone (set to undefined)", () => {
    moment.tz.setDefault("America/New_York");
    moment.tz.setDefault(undefined as unknown as string);
    expect(moment.defaultZone).toBeUndefined();
  });

  test("no leakage across tests — defaultZone is restored", () => {
    expect(moment.defaultZone).toBe(savedDefault);
  });

  test("setDefault with Europe/Berlin does not affect explicit tz() calls", () => {
    moment.tz.setDefault("Europe/Berlin");
    const m = moment.tz("2024-01-15 12:00", "Asia/Tokyo");
    expect(m.tz()).toBe("Asia/Tokyo");
  });
});
