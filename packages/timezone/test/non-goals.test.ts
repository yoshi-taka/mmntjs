/* oxlint-disable no-explicit-any */
import { describe, test, expect } from "bun:test";
import { moment } from "./helper";

describe("runtime timezone registry compatibility", () => {
  test("moment.tz.add() registers a packed zone", () => {
    moment.tz.add("Etc/Test_Zone|TST|0|0||0");

    const zone = moment.tz.zone("Etc/Test_Zone");
    expect(zone).not.toBeNull();
    expect(zone?.name).toBe("Etc/Test_Zone");
    expect(zone?.utcOffset(0)).toBe(0);
    expect(moment.tz.names()).toContain("Etc/Test_Zone");
  });

  test("moment.tz.link() registers aliases", () => {
    moment.tz.add("Etc/Test_Link_Target|TLT|0|0||0");
    moment.tz.link("US/Test_Eastern|Etc/Test_Link_Target");

    const zone = moment.tz.zone("US/Test_Eastern");
    expect(zone).not.toBeNull();
    expect(zone?.name).toBe("US/Test_Eastern");
    expect(zone?.utcOffset(0)).toBe(0);
    expect(moment.tz.names()).toContain("US/Test_Eastern");
  });

  test("moment.tz.load() hydrates countries and dataVersion", () => {
    moment.tz.load({
      version: "TEST-2026a",
      zones: ["Etc/Test_Country_Zone|TCZ|0|0||0"],
      countries: ["XZ|Etc/Test_Country_Zone"],
    });

    expect(moment.tz.dataVersion).toBe("TEST-2026a");
    expect(moment.tz.countries()).toContain("XZ");
    expect(moment.tz.zonesForCountry("XZ")).toEqual(["Etc/Test_Country_Zone"]);
  });

  test("moment.tz.unpackBase60() matches known values", () => {
    expect(moment.tz.unpackBase60("10")).toBe(60);
    expect(moment.tz.unpackBase60("1a")).toBe(70);
    expect(moment.tz.unpackBase60("-1")).toBe(-1);
  });

  test("moment.tz.unpack() expands a packed zone", () => {
    const unpacked = moment.tz.unpack("Etc/Test_Unpack|TST TDT|0 10|01|0 10|42");

    expect(unpacked.name).toBe("Etc/Test_Unpack");
    expect(unpacked.abbrs).toEqual(["TST", "TDT"]);
    expect(unpacked.offsets).toEqual([0, 60]);
    expect(unpacked.population).toBe(42);
    expect(unpacked.untils[1]).toBe(Number.POSITIVE_INFINITY);
  });
});
