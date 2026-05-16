/**
 * Static API tests: moment.tz(), moment.tz.names(), moment.tz.guess(),
 * format tokens z/zz/Z/ZZ, zoneAbbr/zoneName after tz(), Grafana patterns.
 *
 * All behavioral expectations come from moment-timezone oracle.
 */
/* oxlint-disable no-explicit-any */
import { describe, test, expect } from "bun:test";
import { moment, momentTimezone, oracleEqual, TS_EDT } from "./helper";

/* ------------------------------------------------------------------ */
/*  moment.tz() static factory                                        */
/* ------------------------------------------------------------------ */

describe("moment.tz() static factory", () => {
  test("moment.tz() with no args returns valid moment", () => {
    expect(moment.tz().isValid()).toBe(true);
  });

  test("moment.tz(zone) creates current time in zone", () => {
    expect(moment.tz("Asia/Tokyo").isValid()).toBe(true);
  });

  test("moment.tz(zone) returns moment in zone matching oracle", () => {
    // Can't compare exact valueOf since it depends on "now", but smoke check
    const m = moment.tz("Asia/Tokyo");
    expect(m.isValid()).toBe(true);
    expect(typeof m.tz()).toBe("string");
  });

  test("moment.tz(number) creates local (preserves valueOf)", () => {
    const mm = moment.tz(TS_EDT);
    expect(mm.isValid()).toBe(true);
    expect(mm.valueOf()).toBe(TS_EDT);
  });

  test("moment.tz(Date) creates local (preserves valueOf)", () => {
    const mm = moment.tz(new Date(TS_EDT));
    expect(mm.isValid()).toBe(true);
    expect(mm.valueOf()).toBe(TS_EDT);
  });

  test("moment.tz(number, zone) creates moment in zone matching oracle", () => {
    oracleEqual(
      moment.tz(TS_EDT, "America/New_York"),
      momentTimezone.tz(TS_EDT, "America/New_York"),
    );
  });

  test("moment.tz(Date, zone) matches oracle", () => {
    oracleEqual(
      moment.tz(new Date(TS_EDT), "Europe/London"),
      momentTimezone.tz(new Date(TS_EDT), "Europe/London"),
    );
  });
});

/* ------------------------------------------------------------------ */
/*  moment.tz.names / guess                                            */
/* ------------------------------------------------------------------ */

describe("moment.tz.names / guess", () => {
  test("moment.tz.names() includes common zones", () => {
    const names = moment.tz.names();
    expect(Array.isArray(names)).toBe(true);
    expect(names.length).toBeGreaterThan(0);
    expect(names).toContain("UTC");
    expect(names).toContain("America/New_York");
    expect(names).toContain("Asia/Tokyo");
    expect(names).toContain("Europe/London");
  });

  test("moment.tz.guess() returns a string", () => {
    const tz = moment.tz.guess();
    expect(typeof tz).toBe("string");
    expect(tz.length).toBeGreaterThan(0);
  });
});

/* ------------------------------------------------------------------ */
/*  Instance tz() getter/setter                                       */
/* ------------------------------------------------------------------ */

describe("moment().tz() instance", () => {
  test("setter converts and preserves absolute time (oracle)", () => {
    const m = moment.utc(TS_EDT);
    oracleEqual(m.tz("Asia/Tokyo"), momentTimezone.utc(TS_EDT).tz("Asia/Tokyo"));
  });

  test("getter returns zone name when set", () => {
    const m = moment.tz("America/Chicago");
    expect(m.tz()).toBe("America/Chicago");
  });

  test("getter returns a string when not set", () => {
    expect(typeof moment().tz()).toBe("string");
  });

  test("setter with lowercase utc normalizes", () => {
    const m = moment.utc(TS_EDT).tz("utc");
    expect(m.tz()).toBe("UTC");
    expect(m.format("z")).toBe("UTC");
  });

  test("setter with lowercase gmt normalizes", () => {
    expect(moment.utc(TS_EDT).tz("gmt").tz()).toBe("GMT");
  });
});

/* ------------------------------------------------------------------ */
/*  Format tokens z/zz/Z/ZZ                                           */
/* ------------------------------------------------------------------ */

describe("format tokens with timezone", () => {
  const zones = [
    "Europe/Stockholm",
    "America/New_York",
    "Europe/Bucharest",
    "Asia/Tokyo",
    "Europe/London",
    "America/Los_Angeles",
    "Australia/Sydney",
    "Asia/Kolkata",
    "Australia/Adelaide",
  ];

  for (const zn of zones) {
    test(`format z for ${zn} matches oracle`, () => {
      const mm = moment.utc(TS_EDT).tz(zn);
      const om = momentTimezone.utc(TS_EDT).tz(zn);
      expect(mm.format("z")).toBe(om.format("z"));
    });
  }

  test("format z for UTC returns UTC", () => {
    expect(moment.utc(TS_EDT).tz("UTC").format("z")).toBe("UTC");
  });

  test("format zz matches format z for timezone moments", () => {
    const m = moment.utc(TS_EDT).tz("Europe/Stockholm");
    expect(m.format("zz")).toBe(m.format("z"));
  });

  test("format Z and ZZ match oracle", () => {
    const mm = moment.utc(TS_EDT).tz("Europe/Stockholm");
    const om = momentTimezone.utc(TS_EDT).tz("Europe/Stockholm");
    expect(mm.format("Z")).toBe(om.format("Z"));
    expect(mm.format("ZZ")).toBe(om.format("ZZ"));
  });

  for (const zn of zones) {
    test(`format ZZ for ${zn} matches oracle`, () => {
      const mm = moment.utc(TS_EDT).tz(zn);
      const om = momentTimezone.utc(TS_EDT).tz(zn);
      expect(mm.format("ZZ")).toBe(om.format("ZZ"));
    });
  }
});

/* ------------------------------------------------------------------ */
/*  zoneAbbr / zoneName                                               */
/* ------------------------------------------------------------------ */

describe("zoneAbbr / zoneName", () => {
  test("zoneAbbr() after tz() matches oracle", () => {
    const m = moment.utc(TS_EDT).tz("Europe/Stockholm");
    const o = momentTimezone.utc(TS_EDT).tz("Europe/Stockholm");
    expect(m.zoneAbbr()).toBe(o.zoneAbbr());
  });

  test("zoneName() after tz() matches oracle", () => {
    const m = moment.utc(TS_EDT).tz("Europe/Stockholm");
    const o = momentTimezone.utc(TS_EDT).tz("Europe/Stockholm");
    expect(m.zoneName()).toBe(o.zoneName());
  });

  test("zoneAbbr() for UTC moment returns UTC", () => {
    expect(moment.utc(TS_EDT).zoneAbbr()).toBe("UTC");
  });

  test("zoneName() for UTC moment returns Coordinated Universal Time", () => {
    expect(moment.utc(TS_EDT).zoneName()).toBe("Coordinated Universal Time");
  });

  test("zoneAbbr() for local moment returns empty string", () => {
    expect(moment(TS_EDT).zoneAbbr()).toBe("");
  });

  test("zoneName() for local moment returns empty string", () => {
    expect(moment(TS_EDT).zoneName()).toBe("");
  });
});

/* ------------------------------------------------------------------ */
/*  Grafana-specific patterns                                         */
/* ------------------------------------------------------------------ */

describe("Grafana-specific patterns", () => {
  test("toUtc + tz + format z matches oracle", () => {
    const mm = moment.utc(TS_EDT).tz("Europe/Stockholm");
    const om = momentTimezone.utc(TS_EDT).tz("Europe/Stockholm");
    expect(mm.format("YYYY-MM-DD HH:mm:ss z")).toBe(om.format("YYYY-MM-DD HH:mm:ss z"));
  });

  test("America/New_York with format + z matches oracle", () => {
    const mm = moment.utc(TS_EDT).tz("America/New_York");
    const om = momentTimezone.utc(TS_EDT).tz("America/New_York");
    expect(mm.format("YYYY-MM-DD HH:mm:ss z")).toBe(om.format("YYYY-MM-DD HH:mm:ss z"));
  });

  test("Europe/Bucharest with format + z matches oracle", () => {
    const mm = moment.utc(TS_EDT).tz("Europe/Bucharest");
    const om = momentTimezone.utc(TS_EDT).tz("Europe/Bucharest");
    expect(mm.format("YYYY-MM-DD HH:mm:ss z")).toBe(om.format("YYYY-MM-DD HH:mm:ss z"));
  });
});
