/**
 * Parse-in-zone tests: moment.tz(input, zone) and moment.tz(input, format, zone).
 *
 * moment-timezone interprets wall-clock components as being in the target zone,
 * NOT as local time followed by conversion. This is the core of parse-in-zone
 * semantics.
 */
/* oxlint-disable no-explicit-any */
import { describe, test, expect } from "bun:test";
import { moment, momentTimezone, oracleEqual } from "./helper";

/* ------------------------------------------------------------------ */
/*  moment.tz(input, zone)                                            */
/* ------------------------------------------------------------------ */

describe("moment.tz(input, zone) — parse wall-clock in zone", () => {
  test("America/New_York", () => {
    oracleEqual(
      moment.tz("2024-01-15 12:00", "America/New_York"),
      momentTimezone.tz("2024-01-15 12:00", "America/New_York"),
    );
  });

  test("Asia/Tokyo", () => {
    oracleEqual(
      moment.tz("2024-01-15 12:00", "Asia/Tokyo"),
      momentTimezone.tz("2024-01-15 12:00", "Asia/Tokyo"),
    );
  });

  test("Europe/London", () => {
    oracleEqual(
      moment.tz("2024-01-15 12:00", "Europe/London"),
      momentTimezone.tz("2024-01-15 12:00", "Europe/London"),
    );
  });

  test("Asia/Kolkata", () => {
    oracleEqual(
      moment.tz("2024-01-15 12:00", "Asia/Kolkata"),
      momentTimezone.tz("2024-01-15 12:00", "Asia/Kolkata"),
    );
  });

  test("Europe/Stockholm", () => {
    oracleEqual(
      moment.tz("2013-11-18 11:55", "Europe/Stockholm"),
      momentTimezone.tz("2013-11-18 11:55", "Europe/Stockholm"),
    );
  });

  test("America/Toronto", () => {
    oracleEqual(
      moment.tz("2013-11-18 11:55", "America/Toronto"),
      momentTimezone.tz("2013-11-18 11:55", "America/Toronto"),
    );
  });

  test("Asia/Taipei", () => {
    oracleEqual(
      moment.tz("2013-11-18 11:55", "Asia/Taipei"),
      momentTimezone.tz("2013-11-18 11:55", "Asia/Taipei"),
    );
  });

  test("Australia/Sydney", () => {
    oracleEqual(
      moment.tz("2024-07-15 12:00", "Australia/Sydney"),
      momentTimezone.tz("2024-07-15 12:00", "Australia/Sydney"),
    );
  });
});

/* ------------------------------------------------------------------ */
/*  moment.tz(input, format, zone)                                    */
/* ------------------------------------------------------------------ */

describe("moment.tz(input, format, zone) — parse with format in zone", () => {
  test("MM/DD/YYYY in America/New_York", () => {
    oracleEqual(
      moment.tz("01/15/2024", "MM/DD/YYYY", "America/New_York"),
      momentTimezone.tz("01/15/2024", "MM/DD/YYYY", "America/New_York"),
    );
  });

  test("YYYY/MM/DD HH:mm in Asia/Tokyo", () => {
    oracleEqual(
      moment.tz("2024/01/15 12:34", "YYYY/MM/DD HH:mm", "Asia/Tokyo"),
      momentTimezone.tz("2024/01/15 12:34", "YYYY/MM/DD HH:mm", "Asia/Tokyo"),
    );
  });

  test("YYYY-MM-DD HH:mm in Europe/Berlin", () => {
    oracleEqual(
      moment.tz("2024-06-15 08:00", "YYYY-MM-DD HH:mm", "Europe/Berlin"),
      momentTimezone.tz("2024-06-15 08:00", "YYYY-MM-DD HH:mm", "Europe/Berlin"),
    );
  });

  test("YYYY/MM/DD in America/New_York", () => {
    oracleEqual(
      moment.tz("2024/01/15", "YYYY/MM/DD", "America/New_York"),
      momentTimezone.tz("2024/01/15", "YYYY/MM/DD", "America/New_York"),
    );
  });

  test("YYYY-MM-DD HH:mm in Asia/Tokyo", () => {
    oracleEqual(
      moment.tz("2024-01-15 12:34", "YYYY-MM-DD HH:mm", "Asia/Tokyo"),
      momentTimezone.tz("2024-01-15 12:34", "YYYY-MM-DD HH:mm", "Asia/Tokyo"),
    );
  });
});

/* ------------------------------------------------------------------ */
/*  Strict format dispatch                                            */
/* ------------------------------------------------------------------ */

describe("strict format dispatch", () => {
  test("moment.tz(input, format, true, zone)", () => {
    oracleEqual(
      moment.tz("01/15/2024", "MM/DD/YYYY", true, "America/New_York"),
      momentTimezone.tz("01/15/2024", "MM/DD/YYYY", true, "America/New_York"),
    );
  });

  test("moment.tz(input, format, false, zone)", () => {
    oracleEqual(
      moment.tz("01/15/2024", "MM/DD/YYYY", false, "America/New_York"),
      momentTimezone.tz("01/15/2024", "MM/DD/YYYY", false, "America/New_York"),
    );
  });
});

/* ------------------------------------------------------------------ */
/*  String input with timezone offset (passed through to zone)        */
/* ------------------------------------------------------------------ */

describe("string input with explicit offset in zone", () => {
  test("Z suffix in Asia/Tokyo", () => {
    oracleEqual(
      moment.tz("2024-01-15T12:34:56Z", "Asia/Tokyo"),
      momentTimezone.tz("2024-01-15T12:34:56Z", "Asia/Tokyo"),
    );
  });

  test("+09:00 offset in Asia/Tokyo", () => {
    oracleEqual(
      moment.tz("2024-01-15T12:34:56+09:00", "Asia/Tokyo"),
      momentTimezone.tz("2024-01-15T12:34:56+09:00", "Asia/Tokyo"),
    );
  });

  test("-05:00 offset in Asia/Tokyo (converted)", () => {
    oracleEqual(
      moment.tz("2024-01-15T12:34:56-05:00", "Asia/Tokyo"),
      momentTimezone.tz("2024-01-15T12:34:56-05:00", "Asia/Tokyo"),
    );
  });
});

/* ------------------------------------------------------------------ */
/*  Parse vs convert must not collapse                                 */
/* ------------------------------------------------------------------ */

describe("parse vs convert distinction", () => {
  test("parse and convert produce different valueOf", () => {
    const parsed = moment.tz("2013-11-18 11:55", "Asia/Taipei");
    const converted = moment.utc("2013-11-18 11:55").tz("Asia/Taipei");
    expect(parsed.valueOf()).not.toBe(converted.valueOf());
  });

  test("local parse vs UTC parse differ for non-UTC zone", () => {
    const localParsed = moment.tz("2013-11-18 11:55", "Asia/Taipei");
    const utcParsed = moment.utc("2013-11-18 11:55").tz("Asia/Taipei");
    expect(localParsed.valueOf()).not.toBe(utcParsed.valueOf());
  });

  test("parse and convert same wall-clock different zones produce different instants", () => {
    const ny = moment.tz("2024-06-15 12:00", "America/New_York");
    const ldn = moment.tz("2024-06-15 12:00", "Europe/London");
    expect(ny.valueOf()).not.toBe(ldn.valueOf());
  });
});
