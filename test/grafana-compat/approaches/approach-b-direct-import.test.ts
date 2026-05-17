/* eslint-disable @typescript-eslint/no-unused-vars, @typescript-eslint/no-explicit-any */
// Approach B: Direct import replacement
// Instead of importing 'moment', directly import mmntjs.
// This simulates rewriting imports from 'moment' to 'mmntjs'
import { describe, it, expect, beforeAll } from "bun:test";

let moment: any;
let mtz: any;
let tzFn: any;

beforeAll(async () => {
  const momentMod: any = await new Function(`return import("../../../dist/index.js")`)();
  moment = momentMod.default ?? momentMod;
  const mtzMod: any = await new Function(
    `return import("../../../packages/timezone/dist/index.js")`,
  )();
  mtz = mtzMod.default ?? mtzMod;
  tzFn = mtz.tz;
});

describe("Approach B: Direct import replacement", () => {
  it("moment() with no args", () => {
    const m = moment();
    expect(m.isValid()).toBe(true);
  });

  it("moment.utc() with timestamp", () => {
    const m = moment.utc(1587126975779);
    expect(m.format()).toBe("2020-04-17T12:36:15Z");
  });

  it("moment.tz.zone() works", () => {
    const zone = mtz.tz.zone("America/New_York");
    expect(zone).not.toBeNull();
    expect(zone!.name).toBe("America/New_York");
  });

  it("moment-Timezone abbreviation", () => {
    const ts = 1587126975779;
    const utcDate = moment.utc(ts);
    const withTz = mtz(utcDate).tz("America/New_York");
    expect(withTz.format("YYYY-MM-DD HH:mm:ss z")).toBe("2020-04-17 08:36:15 EDT");
  });

  it("moment.duration()", () => {
    const d = moment.duration(2, "hours");
    expect(d.asHours()).toBe(2);
  });

  it("has static methods", () => {
    expect(typeof moment.isMoment).toBe("function");
    expect(typeof moment.locale).toBe("function");
    expect(typeof moment.ISO_8601).not.toBe("undefined");
  });

  it("tz module exports correctly", () => {
    expect(typeof tzFn).toBe("function");
    expect(typeof mtz.tz.names).toBe("function");
    expect(typeof mtz.tz.guess).toBe("function");
  });
});
