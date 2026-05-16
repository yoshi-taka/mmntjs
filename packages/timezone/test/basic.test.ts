/* oxlint-disable no-explicit-any, no-unnecessary-type-assertion */

import { describe, test, expect } from "bun:test";
import { moment, momentTimezone, oracleEqual } from "./helper";

const TS = 1587126975779; // 2020-04-17 12:36:15 UTC (EDT/CEST season)

/* ------------------------------------------------------------------ */
/*  Static API (oracle-based)                                         */
/* ------------------------------------------------------------------ */

describe("moment.tz static", () => {
  test("moment.tz() with no args returns valid moment", () => {
    expect(moment.tz().isValid()).toBe(true);
  });

  test("moment.tz(zone) creates current time in zone", () => {
    expect(moment.tz("Asia/Tokyo").isValid()).toBe(true);
  });

  test("moment.tz(input, zone) parses wall-clock in zone", () => {
    oracleEqual(
      moment.tz("2024-01-15 12:00", "America/New_York"),
      momentTimezone.tz("2024-01-15 12:00", "America/New_York"),
    );
  });

  test("moment.tz(input, format, zone) parses with format in zone", () => {
    oracleEqual(
      moment.tz("01/15/2024", "MM/DD/YYYY", "America/New_York"),
      momentTimezone.tz("01/15/2024", "MM/DD/YYYY", "America/New_York"),
    );
  });

  test("moment.tz(number) creates local (preserves valueOf)", () => {
    const mm = moment.tz(TS);
    expect(mm.isValid()).toBe(true);
    expect(mm.valueOf()).toBe(TS);
  });

  test("moment.tz(Date) creates local (preserves valueOf)", () => {
    const mm = moment.tz(new Date(TS));
    expect(mm.isValid()).toBe(true);
    expect(mm.valueOf()).toBe(TS);
  });
});

/* ------------------------------------------------------------------ */
/*  Instance tz() (oracle-based)                                      */
/* ------------------------------------------------------------------ */

describe("moment().tz() instance", () => {
  test("setter converts and preserves absolute time", () => {
    const m = moment.utc(TS);
    oracleEqual(
      m.tz("Asia/Tokyo"),
      momentTimezone.utc(TS).tz("Asia/Tokyo"),
    );
  });

  test("getter returns zone name when set", () => {
    const m = moment.tz("America/Chicago");
    expect(m.tz()).toBe("America/Chicago");
  });

  test("getter returns a string when not set", () => {
    expect(typeof moment().tz()).toBe("string");
  });

  test("setter with lowercase utc normalizes", () => {
    const m = moment.utc(TS).tz("utc");
    expect(m.tz()).toBe("UTC");
    expect(m.format("z")).toBe("UTC");
  });

  test("setter with lowercase gmt normalizes", () => {
    expect(moment.utc(TS).tz("gmt").tz()).toBe("GMT");
  });
});

/* ------------------------------------------------------------------ */
/*  tz(zone, keepTime)                                                */
/* ------------------------------------------------------------------ */

describe("tz() with keepTime", () => {
  test("tz(zone) without keepTime preserves instant", () => {
    oracleEqual(
      moment.utc("2024-06-15T12:00:00Z").tz("Europe/Berlin"),
      momentTimezone.utc("2024-06-15T12:00:00Z").tz("Europe/Berlin"),
    );
  });

  test("tz(zone, true) preserves wall clock", () => {
    oracleEqual(
      moment.utc("2024-06-15T12:00:00Z").tz("Europe/Berlin", true),
      momentTimezone.utc("2024-06-15T12:00:00Z").tz("Europe/Berlin", true),
    );
  });

  test("valueOf differs between keep and no-keep", () => {
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
});

/* ------------------------------------------------------------------ */
/*  Zone object (oracle-based where applicable)                       */
/* ------------------------------------------------------------------ */

describe("moment.tz.zone()", () => {
  test("returns zone object for valid zone", () => {
    const z = moment.tz.zone("America/New_York");
    expect(z).not.toBeNull();
    expect(z!.name).toBe("America/New_York");
  });

  test("returns null for invalid zone", () => {
    expect(moment.tz.zone("Invalid/Zone")).toBeNull();
    expect(moment.tz.zone("")).toBeNull();
  });

  test("zone.name matches oracle", () => {
    const zones = ["Europe/Stockholm", "Asia/Tokyo", "America/New_York"];
    for (const zn of zones) {
      expect(moment.tz.zone(zn)?.name).toBe(momentTimezone.tz.zone(zn)?.name);
    }
  });

  test("zone.abbr matches oracle", () => {
    const zones = [
      "Europe/Stockholm", "America/New_York", "Europe/Bucharest",
      "Asia/Tokyo", "Australia/Sydney", "Europe/London",
      "America/Los_Angeles", "Asia/Kolkata", "Asia/Taipei",
    ];
    for (const zn of zones) {
      const mm = moment.tz.zone(zn)?.abbr(TS);
      const om = momentTimezone.tz.zone(zn)?.abbr(TS);
      expect(mm).toBe(om);
    }
  });

  test("zone.offset matches oracle", () => {
    const zones = ["Asia/Tokyo", "America/New_York"];
    for (const zn of zones) {
      const mm = moment.tz.zone(zn)?.offset(TS);
      const om = momentTimezone.tz.zone(zn)?.offset(TS);
      expect(mm).toBe(om);
    }
  });

  test("zone.utcOffset matches oracle", () => {
    const zn = "Asia/Tokyo";
    const mm = moment.tz.zone(zn)?.utcOffset(TS);
    const om = momentTimezone.tz.zone(zn)?.utcOffset(TS);
    expect(mm).toBe(om);
  });

  test("zone.parse returns object with name and offset", () => {
    const parsed = moment.tz.zone("America/New_York")?.parse(TS);
    expect(parsed?.name).toBe("America/New_York");
    expect(typeof parsed?.offset).toBe("number");
  });
});

/* ------------------------------------------------------------------ */
/*  Format tokens z/zz/Z/ZZ (oracle-based)                            */
/* ------------------------------------------------------------------ */

describe("format tokens with timezone", () => {
  const zones = [
    "Europe/Stockholm", "America/New_York", "Europe/Bucharest",
    "Asia/Tokyo", "Europe/London", "America/Los_Angeles",
    "Australia/Sydney", "Asia/Kolkata", "Australia/Adelaide",
  ];

  for (const zn of zones) {
    test(`format z for ${zn} matches oracle`, () => {
      const mm = moment.utc(TS).tz(zn);
      const om = momentTimezone.utc(TS).tz(zn);
      expect(mm.format("z")).toBe(om.format("z"));
    });
  }

  test("format z for UTC returns UTC", () => {
    expect(moment.utc(TS).tz("UTC").format("z")).toBe("UTC");
  });

  test("format zz matches format z for timezone moments", () => {
    const m = moment.utc(TS).tz("Europe/Stockholm");
    expect(m.format("zz")).toBe(m.format("z"));
  });

  test("format Z and ZZ match oracle", () => {
    const mm = moment.utc(TS).tz("Europe/Stockholm");
    const om = momentTimezone.utc(TS).tz("Europe/Stockholm");
    expect(mm.format("Z")).toBe(om.format("Z"));
    expect(mm.format("ZZ")).toBe(om.format("ZZ"));
  });
});

/* ------------------------------------------------------------------ */
/*  zoneAbbr / zoneName                                               */
/* ------------------------------------------------------------------ */

describe("zoneAbbr / zoneName", () => {
  test("zoneAbbr() after tz() matches oracle", () => {
    const m = moment.utc(TS).tz("Europe/Stockholm");
    const o = momentTimezone.utc(TS).tz("Europe/Stockholm");
    expect(m.zoneAbbr()).toBe(o.zoneAbbr());
  });

  test("zoneName() after tz() matches oracle", () => {
    const m = moment.utc(TS).tz("Europe/Stockholm");
    const o = momentTimezone.utc(TS).tz("Europe/Stockholm");
    expect(m.zoneName()).toBe(o.zoneName());
  });

  test("zoneAbbr() for UTC moment returns UTC", () => {
    expect(moment.utc(TS).zoneAbbr()).toBe("UTC");
  });

  test("zoneName() for UTC moment returns Coordinated Universal Time", () => {
    expect(moment.utc(TS).zoneName()).toBe("Coordinated Universal Time");
  });

  test("zoneAbbr() for local moment returns empty string", () => {
    expect(moment(TS).zoneAbbr()).toBe("");
  });

  test("zoneName() for local moment returns empty string", () => {
    expect(moment(TS).zoneName()).toBe("");
  });
});

/* ------------------------------------------------------------------ */
/*  Grafana-specific patterns (oracle-based)                          */
/* ------------------------------------------------------------------ */

describe("Grafana-specific patterns", () => {
  test("toUtc + tz + format z matches oracle", () => {
    const mm = moment.utc(TS).tz("Europe/Stockholm");
    const om = momentTimezone.utc(TS).tz("Europe/Stockholm");
    expect(mm.format("YYYY-MM-DD HH:mm:ss z")).toBe(om.format("YYYY-MM-DD HH:mm:ss z"));
  });

  test("America/New_York with format + z matches oracle", () => {
    const mm = moment.utc(TS).tz("America/New_York");
    const om = momentTimezone.utc(TS).tz("America/New_York");
    expect(mm.format("YYYY-MM-DD HH:mm:ss z")).toBe(om.format("YYYY-MM-DD HH:mm:ss z"));
  });

  test("Europe/Bucharest with format + z matches oracle", () => {
    const mm = moment.utc(TS).tz("Europe/Bucharest");
    const om = momentTimezone.utc(TS).tz("Europe/Bucharest");
    expect(mm.format("YYYY-MM-DD HH:mm:ss z")).toBe(om.format("YYYY-MM-DD HH:mm:ss z"));
  });
});

/* ------------------------------------------------------------------ */
/*  UTC offset and mode invariants                                    */
/* ------------------------------------------------------------------ */

describe("utc offset and mode", () => {
  test("tz() preserves valueOf", () => {
    expect(moment.utc(TS).tz("Asia/Tokyo").valueOf()).toBe(TS);
  });

  test("tz() then utc() roundtrip preserves valueOf", () => {
    const m = moment.utc(TS).tz("Asia/Tokyo");
    expect(m.valueOf()).toBe(TS);
    expect(m.utc().valueOf()).toBe(TS);
  });

  test("utcOffset after tz() matches oracle", () => {
    const mm = moment.utc(TS).tz("America/New_York");
    const om = momentTimezone.utc(TS).tz("America/New_York");
    expect(mm.utcOffset()).toBe(om.utcOffset());
  });
});

/* ------------------------------------------------------------------ */
/*  Southern hemisphere DST (Adelaide, Sydney, Auckland)              */
/* ------------------------------------------------------------------ */

describe("southern hemisphere DST", () => {
  // Australia/Adelaide: DST ends April 7, 2024 at 03:00 ACDT → 02:00 ACST
  test("Adelaide autumn: 02:59:59 before fall-back", () => {
    oracleEqual(
      moment.tz("2024-04-06 02:59:59", "Australia/Adelaide"),
      momentTimezone.tz("2024-04-06 02:59:59", "Australia/Adelaide"),
    );
  });

  test("Adelaide autumn: 03:00 after fall-back", () => {
    oracleEqual(
      moment.tz("2024-04-07 03:00:00", "Australia/Adelaide"),
      momentTimezone.tz("2024-04-07 03:00:00", "Australia/Adelaide"),
    );
  });

  test("Adelaide spring-forward exists", () => {
    oracleEqual(
      moment.tz("2024-10-06 02:30:00", "Australia/Adelaide"),
      momentTimezone.tz("2024-10-06 02:30:00", "Australia/Adelaide"),
    );
  });

  // Pacific/Auckland: DST ends April 7, 2024 at 03:00 NZDT → 02:00 NZST
  test("Auckland autumn: 02:59:59 before fall-back", () => {
    oracleEqual(
      moment.tz("2024-04-06 02:59:59", "Pacific/Auckland"),
      momentTimezone.tz("2024-04-06 02:59:59", "Pacific/Auckland"),
    );
  });

  test("Auckland winter valueOf matches", () => {
    const mm = moment.utc(TS).tz("Pacific/Auckland");
    const om = momentTimezone.utc(TS).tz("Pacific/Auckland");
    expect(mm.valueOf()).toBe(om.valueOf());
    expect(mm.utcOffset()).toBe(om.utcOffset());
  });
});

/* ------------------------------------------------------------------ */
/*  Additional zones (Chatham, Phoenix, Toronto)                      */
/* ------------------------------------------------------------------ */

describe("additional zones", () => {
  test("Pacific/Chatham winter format matches oracle", () => {
    const W = Date.UTC(2024, 5, 15, 12, 0, 0, 0);
    const mm = moment(W).tz("Pacific/Chatham");
    const om = momentTimezone(W).tz("Pacific/Chatham");
    expect(mm.valueOf()).toBe(om.valueOf());
    expect(mm.utcOffset()).toBe(om.utcOffset());
    expect(mm.format("z")).toBe(om.format("z"));
  });

  test("America/Phoenix (no DST) matches oracle", () => {
    const mm = moment.utc(TS).tz("America/Phoenix");
    const om = momentTimezone.utc(TS).tz("America/Phoenix");
    oracleEqual(mm, om);
  });

  test("America/Toronto matches oracle", () => {
    const mm = moment.utc(TS).tz("America/Toronto");
    const om = momentTimezone.utc(TS).tz("America/Toronto");
    oracleEqual(mm, om);
  });
});

/* ------------------------------------------------------------------ */
/*  Edge cases (non-oracle, smoke only)                               */
/* ------------------------------------------------------------------ */

describe("edge cases", () => {
  test("moment.tz.add() is a no-op", () => {
    moment.tz.add({});
  });

  test("moment.tz.link() is a no-op", () => {
    moment.tz.link({});
  });

  test("moment.tz.countries() returns empty array", () => {
    const c = moment.tz.countries();
    expect(Array.isArray(c)).toBe(true);
    expect(c.length).toBe(0);
  });

  test("moment.tz.zonesForCountry() returns empty array", () => {
    const z = moment.tz.zonesForCountry("US");
    expect(Array.isArray(z)).toBe(true);
    expect(z.length).toBe(0);
  });

  test("moment.tz.guess() returns a string", () => {
    const tz = moment.tz.guess();
    expect(typeof tz).toBe("string");
    expect(tz.length).toBeGreaterThan(0);
  });

  test("moment.tz.names() includes common zones", () => {
    const names = moment.tz.names();
    expect(names).toContain("UTC");
    expect(names).toContain("America/New_York");
    expect(names).toContain("Asia/Tokyo");
  });
});
