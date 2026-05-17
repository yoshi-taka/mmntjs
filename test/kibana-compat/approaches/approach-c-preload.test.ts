// Approach C: Aliased preload
// Uses the preload script to resolve 'moment' and 'moment-timezone'
// to mmntjs packages. Run with:
//   bun test --preload test/kibana-compat/approaches/approach-c-preload.ts
//
// Note: This test file imports 'moment' and 'moment-timezone' with no
// node_modules symlinks needed -- the preload hook handles resolution.

/* eslint-disable @typescript-eslint/no-explicit-any */

import { describe, it, expect } from "bun:test";
import moment from "moment";
import _mtz from "moment-timezone";
const mtz = _mtz as any;

describe("Approach C: Preload alias", () => {
  it("moment() resolves to mmntjs", () => {
    const m = moment();
    expect(m.isValid()).toBe(true);
  });

  it("moment.isMoment() works", () => {
    expect(moment.isMoment(moment())).toBe(true);
  });

  it("moment-timezone resolves correctly", () => {
    expect(typeof mtz.tz).toBe("function");
  });

  it("tz.zone() returns correct data", () => {
    const zone = mtz.tz.zone("America/New_York");
    expect(zone?.name).toBe("America/New_York");
    expect(typeof zone?.abbr).toBe("function");
  });

  it("full datetime pipeline works", () => {
    const ts = 1587126975779;
    const utcDate = moment.utc(ts);
    const withTz = mtz(utcDate).tz("America/New_York");
    expect(withTz.format("YYYY-MM-DD HH:mm:ss z")).toBe("2020-04-17 08:36:15 EDT");
  });

  it("duration works", () => {
    const d = moment.duration(2, "hours");
    expect(d.asHours()).toBe(2);
  });

  it("format with Z offset works", () => {
    const m = moment.utc(1587126975779);
    expect(m.format("YYYY-MM-DDTHH:mm:ss.SSSZ")).toBe("2020-04-17T12:36:15.779+00:00");
  });
});
