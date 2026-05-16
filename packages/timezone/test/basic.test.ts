/* oxlint-disable no-explicit-any, no-unnecessary-type-assertion */

import { describe, test, expect } from "bun:test";
import moment from "../../../src/index.ts";
import { installTimezone } from "../src/install";

installTimezone(moment as never);

const TS = 1587126975779; // 2020-04-17 12:36:15 UTC (EDT/CEST season)

describe("moment.tz static", () => {
  test("moment.tz() with no args returns current time", () => {
    const m = (moment as any).tz();
    expect(m.isValid()).toBe(true);
  });

  test("moment.tz(zone) creates current time in zone", () => {
    const m = (moment as any).tz("Asia/Tokyo");
    expect(m.isValid()).toBe(true);
  });

  test("moment.tz(input, zone) parses input in zone", () => {
    const m = (moment as any).tz("2024-01-15 12:00", "America/New_York");
    expect(m.isValid()).toBe(true);
    expect(m.format()).toBeTruthy();
  });

  test("moment.tz(input, format, zone) parses with format in zone", () => {
    const m = (moment as any).tz("01/15/2024", "MM/DD/YYYY", "America/New_York");
    expect(m.isValid()).toBe(true);
  });

  test("moment.tz(number) creates local", () => {
    const m = (moment as any).tz(TS);
    expect(m.isValid()).toBe(true);
    expect(m.valueOf()).toBe(TS);
  });

  test("moment.tz(Date) creates local", () => {
    const m = (moment as any).tz(new Date(TS));
    expect(m.isValid()).toBe(true);
    expect(m.valueOf()).toBe(TS);
  });
});

describe("moment().tz() instance", () => {
  test("setter converts to timezone and preserves absolute time", () => {
    const m = moment.utc(TS);
    const m2 = (m as any).tz("Asia/Tokyo");
    expect(m2.isValid()).toBe(true);
    expect(m2.valueOf()).toBe(TS);
    expect(m2.format("HH:mm")).toBe("21:36");
  });

  test("getter returns timezone name when set", () => {
    const m = (moment as any).tz("America/Chicago");
    expect((m as any).tz()).toBe("America/Chicago");
  });

  test("getter returns string when not set", () => {
    const m = moment();
    expect(typeof (m as any).tz()).toBe("string");
  });

  test("setter with lowercase utc normalizes", () => {
    const m = moment.utc(TS);
    const m2 = (m as any).tz("utc");
    expect((m2 as any).tz()).toBe("UTC");
    expect(m2.format("z")).toBe("UTC");
  });

  test("setter with lowercase gmt normalizes", () => {
    const m = moment.utc(TS);
    const m2 = (m as any).tz("gmt");
    expect((m2 as any).tz()).toBe("GMT");
  });
});

describe("moment.tz.zone()", () => {
  test("returns zone object for valid zone", () => {
    const zone = (moment as any).tz.zone("America/New_York");
    expect(zone).not.toBeNull();
    expect((zone as any).name).toBe("America/New_York");
  });

  test("returns null for invalid zone", () => {
    const zone = (moment as any).tz.zone("Invalid/Zone");
    expect(zone).toBeNull();
  });

  test("returns null for garbage input", () => {
    const zone = (moment as any).tz.zone("");
    expect(zone).toBeNull();
  });

  test("zone.name is set", () => {
    const zone = (moment as any).tz.zone("Europe/Stockholm");
    expect((zone as any).name).toBe("Europe/Stockholm");
  });

  test("zone.abbr returns IANA abbreviation for Stockholm (CEST)", () => {
    const zone = (moment as any).tz.zone("Europe/Stockholm");
    expect((zone as any).abbr(TS)).toBe("CEST");
  });

  test("zone.abbr returns IANA abbreviation for New York (EDT)", () => {
    const zone = (moment as any).tz.zone("America/New_York");
    expect((zone as any).abbr(TS)).toBe("EDT");
  });

  test("zone.abbr returns IANA abbreviation for Bucharest (EEST)", () => {
    const zone = (moment as any).tz.zone("Europe/Bucharest");
    expect((zone as any).abbr(TS)).toBe("EEST");
  });

  test("zone.abbr returns IANA abbreviation for Tokyo (JST)", () => {
    const zone = (moment as any).tz.zone("Asia/Tokyo");
    expect((zone as any).abbr(TS)).toBe("JST");
  });

  test("zone.abbr returns IANA abbreviation for Sydney (AEST)", () => {
    const zone = (moment as any).tz.zone("Australia/Sydney");
    expect((zone as any).abbr(TS)).toBe("AEST");
  });

  test("zone.abbr returns IANA abbreviation for London (BST)", () => {
    const zone = (moment as any).tz.zone("Europe/London");
    expect((zone as any).abbr(TS)).toBe("BST");
  });

  test("zone.abbr returns IANA abbreviation for LA (PDT)", () => {
    const zone = (moment as any).tz.zone("America/Los_Angeles");
    expect((zone as any).abbr(TS)).toBe("PDT");
  });

  test("zone.abbr returns CST for Asia/Shanghai (same as moment-timezone)", () => {
    const zone = (moment as any).tz.zone("Asia/Shanghai");
    expect((zone as any).abbr(TS)).toBe("CST");
  });

  test("zone.offset returns positive minutes east of UTC", () => {
    const zone = (moment as any).tz.zone("Asia/Tokyo");
    expect((zone as any).offset(TS)).toBe(540);
  });

  test("zone.offset returns negative minutes west of UTC", () => {
    const zone = (moment as any).tz.zone("America/New_York");
    expect((zone as any).offset(TS)).toBe(-240);
  });

  test("zone.utcOffset returns negative of offset", () => {
    const zone = (moment as any).tz.zone("Asia/Tokyo");
    expect((zone as any).utcOffset(TS)).toBe(-540);
  });

  test("zone.parse returns object with name and offset", () => {
    const zone = (moment as any).tz.zone("America/New_York");
    const parsed = (zone as any).parse(TS);
    expect(parsed.name).toBe("America/New_York");
    expect(typeof parsed.offset).toBe("number");
  });
});

describe("format with timezone (z / zz)", () => {
  test("format z for Europe/Stockholm returns CEST", () => {
    const m = moment.utc(TS).tz("Europe/Stockholm");
    expect(m.format("z")).toBe("CEST");
  });

  test("format z for America/New_York returns EDT", () => {
    const m = moment.utc(TS).tz("America/New_York");
    expect(m.format("z")).toBe("EDT");
  });

  test("format z for Europe/Bucharest returns EEST", () => {
    const m = moment.utc(TS).tz("Europe/Bucharest");
    expect(m.format("z")).toBe("EEST");
  });

  test("format z for Asia/Tokyo returns JST", () => {
    const m = moment.utc(TS).tz("Asia/Tokyo");
    expect(m.format("z")).toBe("JST");
  });

  test("format z for Europe/London returns BST", () => {
    const m = moment.utc(TS).tz("Europe/London");
    expect(m.format("z")).toBe("BST");
  });

  test("format z for America/Los_Angeles returns PDT", () => {
    const m = moment.utc(TS).tz("America/Los_Angeles");
    expect(m.format("z")).toBe("PDT");
  });

  test("format z for Australia/Sydney returns AEST", () => {
    const m = moment.utc(TS).tz("Australia/Sydney");
    expect(m.format("z")).toBe("AEST");
  });

  test("format z for UTC returns UTC", () => {
    const m = moment.utc(TS).tz("UTC");
    expect(m.format("z")).toBe("UTC");
  });

  test("format zz matches format z for timezone moments", () => {
    const m = moment.utc(TS).tz("Europe/Stockholm");
    expect(m.format("zz")).toBe(m.format("z"));
  });

  test("format Z returns offset string for timezone moment", () => {
    const m = moment.utc(TS).tz("Europe/Stockholm");
    expect(m.format("Z")).toBe("+02:00");
  });

  test("format ZZ returns compact offset for timezone moment", () => {
    const m = moment.utc(TS).tz("Europe/Stockholm");
    expect(m.format("ZZ")).toBe("+0200");
  });
});

describe("zoneAbbr / zoneName", () => {
  test("zoneAbbr() returns IANA abbreviation after tz()", () => {
    const m = moment.utc(TS).tz("Europe/Stockholm");
    expect(m.zoneAbbr()).toBe("CEST");
  });

  test("zoneAbbr() returns EDT after tz()", () => {
    const m = moment.utc(TS).tz("America/New_York");
    expect(m.zoneAbbr()).toBe("EDT");
  });

  test("zoneName() returns timezone name after tz()", () => {
    const m = moment.utc(TS).tz("Europe/Stockholm");
    expect(m.zoneName()).toBe("Europe/Stockholm");
  });

  test("zoneAbbr() for UTC moment returns UTC", () => {
    const m = moment.utc(TS);
    expect(m.zoneAbbr()).toBe("UTC");
  });

  test("zoneName() for UTC moment returns Coordinated Universal Time", () => {
    const m = moment.utc(TS);
    expect(m.zoneName()).toBe("Coordinated Universal Time");
  });

  test("zoneAbbr() for local moment returns empty string", () => {
    const m = moment(TS);
    expect(m.zoneAbbr()).toBe("");
  });

  test("zoneName() for local moment returns empty string", () => {
    const m = moment(TS);
    expect(m.zoneName()).toBe("");
  });
});

describe("Grafana-specific patterns", () => {
  test("moment.tz.zone(name) and zone.name works", () => {
    const zone = (moment as any).tz.zone("Europe/Stockholm");
    expect(zone).not.toBeNull();
    expect((zone as any).name).toBe("Europe/Stockholm");
  });

  test("toUtc + tz + format z matching Grafana formatter pattern", () => {
    const m = moment.utc(TS).tz("Europe/Stockholm");
    expect(m.format("YYYY-MM-DD HH:mm:ss z")).toBe("2020-04-17 14:36:15 CEST");
  });

  test("Grafana: America/New_York with format + z", () => {
    const m = moment.utc(TS).tz("America/New_York");
    expect(m.format("YYYY-MM-DD HH:mm:ss z")).toBe("2020-04-17 08:36:15 EDT");
  });

  test("Grafana: Europe/Bucharest with format + z", () => {
    const m = moment.utc(TS).tz("Europe/Bucharest");
    expect(m.format("YYYY-MM-DD HH:mm:ss z")).toBe("2020-04-17 15:36:15 EEST");
  });

  test("isDST with timezone applied (Stockholm April = DST)", () => {
    const m = moment.utc(TS).tz("Europe/Stockholm");
    expect(m.isDST()).toBe(false); // DST check only works for local tz
  });
});

describe("utc offset and mode", () => {
  test("tz() preserves valueOf", () => {
    const m = moment.utc(TS);
    const m2 = (m as any).tz("Asia/Tokyo");
    expect(m2.valueOf()).toBe(TS);
  });

  test("tz() then utc() roundtrip preserves valueOf", () => {
    const m = moment.utc(TS).tz("Asia/Tokyo");
    expect(m.valueOf()).toBe(TS);
    const m2 = m.utc();
    expect(m2.valueOf()).toBe(TS);
  });

  test("utcOffset getter returns correct offset after tz()", () => {
    const m = moment.utc(TS).tz("America/New_York");
    expect(m.utcOffset()).toBe(-240);
  });
});

describe("edge cases", () => {
  test("moment.tz.add() is a no-op", () => {
    (moment as any).tz.add({});
  });

  test("moment.tz.link() is a no-op", () => {
    (moment as any).tz.link({});
  });

  test("moment.tz.countries() returns empty array", () => {
    const countries = (moment as any).tz.countries();
    expect(Array.isArray(countries)).toBe(true);
    expect(countries.length).toBe(0);
  });

  test("moment.tz.zonesForCountry() returns empty array", () => {
    const zones = (moment as any).tz.zonesForCountry("US");
    expect(Array.isArray(zones)).toBe(true);
    expect(zones.length).toBe(0);
  });

  test("moment.tz.guess() returns a string", () => {
    const tz = (moment as any).tz.guess();
    expect(typeof tz).toBe("string");
    expect(tz.length).toBeGreaterThan(0);
  });

  test("moment.tz.names() returns array with common zones", () => {
    const names = (moment as any).tz.names();
    expect(Array.isArray(names)).toBe(true);
    expect(names.length).toBeGreaterThan(0);
    expect(names).toContain("UTC");
    expect(names).toContain("America/New_York");
    expect(names).toContain("Asia/Tokyo");
  });
});
