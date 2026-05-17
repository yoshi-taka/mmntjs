/* eslint-disable @typescript-eslint/no-unused-vars, @typescript-eslint/no-explicit-any */
// Approach B: Direct import replacement
// Simulates rewriting imports from 'moment' to 'mmntjs'
// and 'moment-timezone' to 'moment-timezone' (already pointing to mmntjs-timezone)

import { describe, it, expect, beforeAll } from "bun:test";

let moment: any;
let mtz: any;

beforeAll(async () => {
  const momentMod: any = await import("../../../dist/index.js");
  moment = momentMod.default ?? momentMod;
  const mtzMod: any = await import("../../../packages/timezone/dist/index.js");
  mtz = mtzMod.default ?? mtzMod;
});

describe("Approach B: Direct import replacement", () => {
  it("moment() constructor works", () => {
    const m = moment();
    expect(m.isValid()).toBe(true);
  });

  it("moment.utc() with timestamp", () => {
    const m = moment.utc(1587126975779);
    expect(m.format()).toBe("2020-04-17T12:36:15Z");
  });

  it("moment.isMoment() works", () => {
    expect(moment.isMoment(moment())).toBe(true);
  });

  it("moment.duration() works", () => {
    const d = moment.duration(2, "hours");
    expect(d.asHours()).toBe(2);
  });

  it("tz.zone() returns correct data", () => {
    const zone = mtz.tz.zone("America/New_York");
    expect(zone).not.toBeNull();
    expect(zone!.name).toBe("America/New_York");
    expect(typeof zone!.abbr).toBe("function");
  });

  it("tz.guess() returns a string", () => {
    const guessed = mtz.tz.guess();
    expect(typeof guessed).toBe("string");
  });

  it("moment.tz() converts timezone", () => {
    const m = mtz.tz(1587126975779, "America/New_York");
    expect(m.format("YYYY-MM-DD HH:mm:ss")).toBe("2020-04-17 08:36:15");
  });

  it("format with timezone abbreviation", () => {
    const ts = 1587126975779;
    const formatted = moment.utc(ts).tz("America/New_York").format("YYYY-MM-DD HH:mm:ss z");
    expect(formatted).toBe("2020-04-17 08:36:15 EDT");
  });

  it("format with Z offset", () => {
    const m = moment.utc(1587126975779);
    expect(m.format("YYYY-MM-DDTHH:mm:ss.SSSZ")).toBe("2020-04-17T12:36:15.779+00:00");
  });

  it("has static methods", () => {
    expect(typeof moment.isMoment).toBe("function");
    expect(typeof moment.locale).toBe("function");
    expect(typeof moment.ISO_8601).not.toBe("undefined");
  });

  it("tz module exports correctly", () => {
    expect(typeof mtz.tz.names).toBe("function");
    expect(typeof mtz.tz.guess).toBe("function");
  });
});
