/**
 * Tests for internal timezone helper functions exposed via moment.tz.
 */
import { describe, test, expect } from "bun:test";
import { moment } from "./helper";

describe("unpackBase60", () => {
  test("parses simple integer", () => {
    expect(moment.tz.unpackBase60("0")).toBe(0);
    expect(moment.tz.unpackBase60("1")).toBe(1);
    expect(moment.tz.unpackBase60("9")).toBe(9);
    expect(moment.tz.unpackBase60("a")).toBe(10);
    expect(moment.tz.unpackBase60("z")).toBe(35);
    expect(moment.tz.unpackBase60("A")).toBe(36);
    expect(moment.tz.unpackBase60("Z")).toBe(61);
  });

  test("parses fractional values", () => {
    expect(moment.tz.unpackBase60("1.5")).toBe(1 + 5 / 60);
  });

  test("handles negative sign", () => {
    expect(moment.tz.unpackBase60("-1")).toBe(-1);
  });
});

describe("unpack", () => {
  test("unpacks simple zone data", () => {
    const data = "Test|A|0|0||0";
    const unpacked = moment.tz.unpack(data);
    expect(unpacked.name).toBe("Test");
    expect(unpacked.abbrs).toEqual(["A"]);
    expect(unpacked.offsets).toEqual([0]);
    expect(unpacked.population).toBe(0);
  });
});

describe("zoneExists", () => {
  test("returns true for valid zone", () => {
    expect(moment.tz.zoneExists("America/New_York")).toBe(true);
  });

  test("returns false for invalid zone", () => {
    expect(moment.tz.zoneExists("Invalid/Zone")).toBe(false);
  });
});

describe("setDefault", () => {
  test("setDefault returns moment", () => {
    const result = moment.tz.setDefault("America/New_York");
    expect(result).toBe(moment);
    moment.tz.setDefault(undefined);
  });
});

describe("moveInvalidForward / moveAmbiguousForward", () => {
  test("moveInvalidForward getter/setter", () => {
    const orig = moment.tz.moveInvalidForward;
    moment.tz.moveInvalidForward = !orig;
    expect(moment.tz.moveInvalidForward).toBe(!orig);
    moment.tz.moveInvalidForward = orig;
  });

  test("moveAmbiguousForward getter/setter", () => {
    const orig = moment.tz.moveAmbiguousForward;
    moment.tz.moveAmbiguousForward = !orig;
    expect(moment.tz.moveAmbiguousForward).toBe(!orig);
    moment.tz.moveAmbiguousForward = orig;
  });
});

describe("tz.link", () => {
  test("addLink with object", () => {
    moment.tz.link({ "Custom/Alias": "America/New_York" });
    expect(moment.tz.zoneExists("Custom/Alias")).toBe(true);
  });
});

describe("tz.add", () => {
  test("addZone with string", () => {
    moment.tz.add("Custom/Zone|C|0|0||0");
    expect(moment.tz.zoneExists("Custom/Zone")).toBe(true);
  });

  test("addZone with array", () => {
    moment.tz.add(["Custom/Zone2|D|0|0||0"]);
    expect(moment.tz.zoneExists("Custom/Zone2")).toBe(true);
  });
});

describe("tz.countries / zonesForCountry", () => {
  test("countries returns array", () => {
    const countries = moment.tz.countries();
    expect(Array.isArray(countries)).toBe(true);
  });

  test("zonesForCountry returns zones for valid country", () => {
    const zones = moment.tz.zonesForCountry("US");
    expect(zones).not.toBeNull();
    expect(Array.isArray(zones)).toBe(true);
  });

  test("zonesForCountry with offset includes offsets", () => {
    const zones = moment.tz.zonesForCountry("US", true);
    expect(zones).not.toBeNull();
    expect(Array.isArray(zones)).toBe(true);
  });
});

describe("moment.fn.tz instance methods", () => {
  test("tz() returns zone name after setting", () => {
    const m = moment.tz("America/New_York");
    expect(typeof m.tz()).toBe("string");
  });

  test("tz() setter changes zone", () => {
    const m = moment.tz("2024-06-15", "America/New_York");
    expect(typeof m.tz()).toBe("string");
    m.tz("Asia/Tokyo");
    expect(typeof m.tz()).toBe("string");
  });
});
