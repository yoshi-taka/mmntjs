/**
 * tz(zone, keepLocalTime) behavior.
 *
 * tz(zone) without keepTime preserves the instant (valueOf unchanged).
 * tz(zone, true) preserves the wall-clock rendering.
 */
/* oxlint-disable no-explicit-any */
import { describe, test, expect } from "bun:test";
import { moment, momentTimezone, oracleEqual } from "./helper";

describe("tz() keepLocalTime", () => {
  test("tz(zone) preserves instant (matches oracle)", () => {
    const mm = moment.utc("2024-06-15T12:00:00Z");
    const om = momentTimezone.utc("2024-06-15T12:00:00Z");
    oracleEqual(mm.tz("Europe/Berlin"), om.tz("Europe/Berlin"));
  });

  test("tz(zone, true) preserves wall clock (matches oracle)", () => {
    const mm = moment.utc("2024-06-15T12:00:00Z");
    const om = momentTimezone.utc("2024-06-15T12:00:00Z");
    oracleEqual(mm.tz("Europe/Berlin", true), om.tz("Europe/Berlin", true));
  });

  test("instant differs between keep and no-keep", () => {
    const base = moment.utc("2024-06-15T12:00:00Z");
    const noKeep = base.clone().tz("Europe/Berlin");
    const keep = base.clone().tz("Europe/Berlin", true);
    expect(noKeep.valueOf()).not.toBe(keep.valueOf());
  });

  test("keepTime with America/New_York", () => {
    oracleEqual(
      moment.utc("2024-12-25T10:00:00Z").tz("America/New_York", true),
      momentTimezone.utc("2024-12-25T10:00:00Z").tz("America/New_York", true),
    );
  });

  test("declared zone with keepTime", () => {
    const base = moment("2024-07-22T10:00:00");
    const m = base.clone().tz("Asia/Tokyo", true);
    const o = momentTimezone("2024-07-22T10:00:00").tz("Asia/Tokyo", true);
    oracleEqual(m, o);
  });
});
