/**
 * Convert-to-zone tests: create a moment (as instant), then convert to a zone.
 *
 * Invariant: conversion preserves the instant (valueOf).
 * Wall-clock rendering changes according to target zone.
 */
/* oxlint-disable no-explicit-any */
import { describe, test, expect } from "bun:test";
import { moment, momentTimezone, oracleEqual, TS_EDT } from "./helper";

/* ------------------------------------------------------------------ */
/*  Convert moment.utc(timestamp).tz(zone)                            */
/* ------------------------------------------------------------------ */

describe("moment.utc(ts).tz(zone)", () => {
  test("Asia/Tokyo", () => {
    oracleEqual(moment.utc(TS_EDT).tz("Asia/Tokyo"), momentTimezone.utc(TS_EDT).tz("Asia/Tokyo"));
  });

  test("America/New_York", () => {
    oracleEqual(
      moment.utc(TS_EDT).tz("America/New_York"),
      momentTimezone.utc(TS_EDT).tz("America/New_York"),
    );
  });

  test("Europe/Berlin", () => {
    oracleEqual(
      moment.utc(TS_EDT).tz("Europe/Berlin"),
      momentTimezone.utc(TS_EDT).tz("Europe/Berlin"),
    );
  });

  test("Asia/Kolkata", () => {
    oracleEqual(
      moment.utc(TS_EDT).tz("Asia/Kolkata"),
      momentTimezone.utc(TS_EDT).tz("Asia/Kolkata"),
    );
  });

  test("Pacific/Auckland", () => {
    oracleEqual(
      moment.utc(TS_EDT).tz("Pacific/Auckland"),
      momentTimezone.utc(TS_EDT).tz("Pacific/Auckland"),
    );
  });
});

/* ------------------------------------------------------------------ */
/*  Convert moment(timestamp).tz(zone)                                */
/* ------------------------------------------------------------------ */

describe("moment(ts).tz(zone)", () => {
  test("Asia/Tokyo from local timestamp", () => {
    oracleEqual(moment(TS_EDT).tz("Asia/Tokyo"), momentTimezone(TS_EDT).tz("Asia/Tokyo"));
  });

  test("Europe/London from local timestamp", () => {
    oracleEqual(moment(TS_EDT).tz("Europe/London"), momentTimezone(TS_EDT).tz("Europe/London"));
  });
});

/* ------------------------------------------------------------------ */
/*  Convert moment.parseZone(...).tz(zone)                            */
/* ------------------------------------------------------------------ */

describe("moment.parseZone(input).tz(zone)", () => {
  test("parseZone with offset to Asia/Tokyo", () => {
    oracleEqual(
      moment.parseZone("2024-01-15T12:00:00+05:30").tz("Asia/Tokyo"),
      momentTimezone.parseZone("2024-01-15T12:00:00+05:30").tz("Asia/Tokyo"),
    );
  });

  test("parseZone with Z to America/New_York", () => {
    oracleEqual(
      moment.parseZone("2024-06-15T12:00:00Z").tz("America/New_York"),
      momentTimezone.parseZone("2024-06-15T12:00:00Z").tz("America/New_York"),
    );
  });
});

/* ------------------------------------------------------------------ */
/*  Convert Z-suffixed / offset-suffixed strings                      */
/* ------------------------------------------------------------------ */

describe("moment(ISO with offset).tz(zone)", () => {
  test("Z-suffixed to Asia/Tokyo", () => {
    oracleEqual(
      moment("2024-01-15T12:00:00Z").tz("Asia/Tokyo"),
      momentTimezone("2024-01-15T12:00:00Z").tz("Asia/Tokyo"),
    );
  });

  test("Z-suffixed to America/New_York", () => {
    oracleEqual(
      moment("2024-01-15T12:00:00Z").tz("America/New_York"),
      momentTimezone("2024-01-15T12:00:00Z").tz("America/New_York"),
    );
  });

  test("+09:00 offset to Europe/Berlin", () => {
    oracleEqual(
      moment("2024-01-15T12:00:00+09:00").tz("Europe/Berlin"),
      momentTimezone("2024-01-15T12:00:00+09:00").tz("Europe/Berlin"),
    );
  });

  test("-05:00 offset to Asia/Tokyo", () => {
    oracleEqual(
      moment("2024-01-15T12:00:00-05:00").tz("Asia/Tokyo"),
      momentTimezone("2024-01-15T12:00:00-05:00").tz("Asia/Tokyo"),
    );
  });
});

/* ------------------------------------------------------------------ */
/*  Convert moment.utc(input).tz(zone)                                */
/* ------------------------------------------------------------------ */

describe("moment.utc(input).tz(zone)", () => {
  test("string input to Asia/Taipei", () => {
    oracleEqual(
      moment.utc("2013-11-18 11:55").tz("Asia/Taipei"),
      momentTimezone.utc("2013-11-18 11:55").tz("Asia/Taipei"),
    );
  });

  test("string input to America/Toronto", () => {
    oracleEqual(
      moment.utc("2013-11-18 11:55").tz("America/Toronto"),
      momentTimezone.utc("2013-11-18 11:55").tz("America/Toronto"),
    );
  });
});

/* ------------------------------------------------------------------ */
/*  valueOf invariants                                                */
/* ------------------------------------------------------------------ */

describe("valueOf invariants", () => {
  test("tz() preserves valueOf", () => {
    expect(moment.utc(TS_EDT).tz("Asia/Tokyo").valueOf()).toBe(TS_EDT);
  });

  test("tz() then utc() roundtrip preserves valueOf", () => {
    const m = moment.utc(TS_EDT).tz("Asia/Tokyo");
    expect(m.valueOf()).toBe(TS_EDT);
    expect(m.utc().valueOf()).toBe(TS_EDT);
  });

  test("utcOffset after tz() matches oracle", () => {
    const mm = moment.utc(TS_EDT).tz("America/New_York");
    const om = momentTimezone.utc(TS_EDT).tz("America/New_York");
    expect(mm.utcOffset()).toBe(om.utcOffset());
  });
});
