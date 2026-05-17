/* eslint-disable @typescript-eslint/no-explicit-any */
// Approach A: npm alias (zero code change)
// Tests that importing 'moment' resolves to mmntjs via node_modules symlinks.
// This simulates `"moment": "npm:mmntjs"` in package.json

import { describe, it, expect } from "bun:test";

// These resolve via test/kibana-compat/node_modules symlinks
import moment from "moment";
import _mtz from "moment-timezone";
const mtz = _mtz as any;

describe("Approach A: npm alias (zero code change)", () => {
  it("moment() constructor works", () => {
    const m = moment();
    expect(m.isValid()).toBe(true);
  });

  it("moment.utc() works", () => {
    const m = moment.utc(1587126975779);
    expect(m.format()).toBe("2020-04-17T12:36:15Z");
  });

  it("moment.isMoment() works", () => {
    expect(moment.isMoment(moment())).toBe(true);
  });

  it("moment.duration() works", () => {
    const d = moment.duration(2, "hours");
    expect(d.asHours()).toBe(2);
    expect(d.asMilliseconds()).toBe(7200000);
  });

  it("moment-timezone exports tz function", () => {
    expect(typeof mtz.tz).toBe("function");
  });

  it("tz.zone() returns correct data", () => {
    const zone = mtz.tz.zone("America/New_York");
    expect(zone).not.toBeNull();
    expect(zone!.name).toBe("America/New_York");
    expect(typeof zone!.abbr).toBe("function");
    expect(typeof zone!.utcOffset).toBe("function");
  });

  it("tz.guess() returns a string", () => {
    const guessed = mtz.tz.guess();
    expect(typeof guessed).toBe("string");
    expect(guessed.length).toBeGreaterThan(0);
  });

  it("moment.tz() converts to timezone", () => {
    const m = mtz.tz(1587126975779, "America/New_York");
    expect(m.format("YYYY-MM-DD HH:mm:ss")).toBe("2020-04-17 08:36:15");
  });

  it("full datetime pipeline: utc -> tz -> format", () => {
    const ts = 1587126975779;
    const formatted = moment.utc(ts).tz("America/New_York").format("YYYY-MM-DD HH:mm:ss z");
    expect(formatted).toBe("2020-04-17 08:36:15 EDT");
  });

  it("has required static methods", () => {
    expect(typeof moment.utc).toBe("function");
    expect(typeof moment.isMoment).toBe("function");
    expect(typeof moment.duration).toBe("function");
    expect(typeof moment.locale).toBe("function");
  });

  it("has ISO_8601 constant", () => {
    expect(moment.ISO_8601).toBeDefined();
  });
});
