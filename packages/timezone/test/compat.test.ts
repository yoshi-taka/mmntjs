/**
 * Comprehensive moment-timezone compatibility tests.
 * Compares mmntjs-timezone output against moment-timezone (oracle).
 */
import { describe, test, expect, afterEach } from "bun:test";
import { moment, momentTimezone, oracleEqual } from "./helper";

/* ------------------------------------------------------------------ */
/*  Phase 1–2: Static API                                             */
/* ------------------------------------------------------------------ */

describe("moment.tz static API", () => {
  test("moment.tz() with no args returns valid moment", () => {
    const m = moment.tz();
    expect(m.isValid()).toBe(true);
  });

  test("moment.tz(zone) returns moment in zone", () => {
    const m = moment.tz("Asia/Tokyo");
    expect(m.isValid()).toBe(true);
    expect(typeof m.tz()).toBe("string");
  });

  test("moment.tz.names() includes known zones", () => {
    const names = moment.tz.names();
    expect(Array.isArray(names)).toBe(true);
    expect(names.length).toBeGreaterThan(0);
    expect(names).toContain("UTC");
    expect(names).toContain("Asia/Tokyo");
    expect(names).toContain("America/New_York");
    expect(names).toContain("Europe/London");
  });

  test("moment.tz.guess() returns a string (smoke)", () => {
    const tz = moment.tz.guess();
    expect(typeof tz).toBe("string");
    expect(tz.length).toBeGreaterThan(0);
  });
});

/* ------------------------------------------------------------------ */
/*  Phase 3: Parse-in-zone vs Convert-to-zone                         */
/* ------------------------------------------------------------------ */

describe("parse-in-zone vs convert-to-zone", () => {
  test("moment.tz(input, zone) parses wall-clock in zone (Asia/Taipei)", () => {
    const mm = moment.tz("2013-11-18 11:55", "Asia/Taipei");
    const om = momentTimezone.tz("2013-11-18 11:55", "Asia/Taipei");
    oracleEqual(mm, om);
  });

  test("moment.tz(input, zone) parses wall-clock in America/Toronto", () => {
    const mm = moment.tz("2013-11-18 11:55", "America/Toronto");
    const om = momentTimezone.tz("2013-11-18 11:55", "America/Toronto");
    oracleEqual(mm, om);
  });

  test("moment.utc(input).tz(zone) converts instant to zone (Asia/Taipei)", () => {
    const mm = moment.utc("2013-11-18 11:55").tz("Asia/Taipei");
    const om = momentTimezone.utc("2013-11-18 11:55").tz("Asia/Taipei");
    oracleEqual(mm, om);
  });

  test("moment.utc(input).tz(zone) converts instant to America/Toronto", () => {
    const mm = moment.utc("2013-11-18 11:55").tz("America/Toronto");
    const om = momentTimezone.utc("2013-11-18 11:55").tz("America/Toronto");
    oracleEqual(mm, om);
  });

  test("convert Z-suffixed instant to Asia/Tokyo", () => {
    const mm = moment("2013-11-18T11:55:00Z").tz("Asia/Tokyo");
    const om = momentTimezone("2013-11-18T11:55:00Z").tz("Asia/Tokyo");
    oracleEqual(mm, om);
  });

  test("convert Z-suffixed instant to America/New_York", () => {
    const mm = moment("2013-11-18T11:55:00Z").tz("America/New_York");
    const om = momentTimezone("2013-11-18T11:55:00Z").tz("America/New_York");
    oracleEqual(mm, om);
  });

  test("parse and convert produce different valueOf", () => {
    const parsed = moment.tz("2013-11-18 11:55", "Asia/Taipei");
    const converted = moment.utc("2013-11-18 11:55").tz("Asia/Taipei");
    expect(parsed.valueOf()).not.toBe(converted.valueOf());
  });
});

/* ------------------------------------------------------------------ */
/*  Phase 4: Input forms                                              */
/* ------------------------------------------------------------------ */

describe("input forms", () => {
  describe("string input without timezone", () => {
    test("YYYY-MM-DD HH:mm:ss in America/New_York", () => {
      const mm = moment.tz("2024-01-15 12:34:56", "America/New_York");
      const om = momentTimezone.tz("2024-01-15 12:34:56", "America/New_York");
      oracleEqual(mm, om);
    });

    test("YYYY-MM-DDTHH:mm:ss in Asia/Tokyo", () => {
      const mm = moment.tz("2024-01-15T12:34:56", "Asia/Tokyo");
      const om = momentTimezone.tz("2024-01-15T12:34:56", "Asia/Tokyo");
      oracleEqual(mm, om);
    });
  });

  describe("string input with timezone offset", () => {
    test("with Z suffix in Asia/Tokyo", () => {
      const mm = moment.tz("2024-01-15T12:34:56Z", "Asia/Tokyo");
      const om = momentTimezone.tz("2024-01-15T12:34:56Z", "Asia/Tokyo");
      oracleEqual(mm, om);
    });

    test("with +09:00 offset in Asia/Tokyo", () => {
      const mm = moment.tz("2024-01-15T12:34:56+09:00", "Asia/Tokyo");
      const om = momentTimezone.tz("2024-01-15T12:34:56+09:00", "Asia/Tokyo");
      oracleEqual(mm, om);
    });

    test("with -05:00 offset in Asia/Tokyo", () => {
      const mm = moment.tz("2024-01-15T12:34:56-05:00", "Asia/Tokyo");
      const om = momentTimezone.tz("2024-01-15T12:34:56-05:00", "Asia/Tokyo");
      oracleEqual(mm, om);
    });
  });

  describe("format + zone", () => {
    test("YYYY-MM-DD HH:mm with zone", () => {
      const mm = moment.tz("2024-01-15 12:34", "YYYY-MM-DD HH:mm", "Asia/Tokyo");
      const om = momentTimezone.tz("2024-01-15 12:34", "YYYY-MM-DD HH:mm", "Asia/Tokyo");
      oracleEqual(mm, om);
    });

    test("YYYY/MM/DD with zone", () => {
      const mm = moment.tz("2024/01/15", "YYYY/MM/DD", "America/New_York");
      const om = momentTimezone.tz("2024/01/15", "YYYY/MM/DD", "America/New_York");
      oracleEqual(mm, om);
    });
  });

  describe("non-string input", () => {
    const TS = 1705311200000;
    const D = new Date("2024-01-15T12:00:00Z");

    test("timestamp number", () => {
      const mm = moment.tz(TS, "America/New_York");
      const om = momentTimezone.tz(TS, "America/New_York");
      oracleEqual(mm, om);
    });

    test("Date object", () => {
      const mm = moment.tz(D, "America/New_York");
      const om = momentTimezone.tz(D, "America/New_York");
      oracleEqual(mm, om);
    });
  });
});

/* ------------------------------------------------------------------ */
/*  Phase 5: DST correctness                                          */
/* ------------------------------------------------------------------ */

describe("DST transitions", () => {
  describe("America/New_York spring forward", () => {
    const inputs = [
      "2012-03-11 01:59:59",
      "2012-03-11 02:00:00",
      "2012-03-11 02:30:00",
      "2012-03-11 02:59:59",
      "2012-03-11 03:00:00",
    ];
    for (const input of inputs) {
      test(input, () => {
        const mm = moment.tz(input, "America/New_York");
        const om = momentTimezone.tz(input, "America/New_York");
        oracleEqual(mm, om);
      });
    }
  });

  describe("America/New_York fall back", () => {
    const inputs = [
      "2012-11-04 00:59:59",
      "2012-11-04 01:00:00",
      "2012-11-04 01:30:00",
      "2012-11-04 01:59:59",
      "2012-11-04 02:00:00",
    ];
    for (const input of inputs) {
      test(input, () => {
        const mm = moment.tz(input, "America/New_York");
        const om = momentTimezone.tz(input, "America/New_York");
        oracleEqual(mm, om);
      });
    }
  });

  describe("fall back with explicit offset", () => {
    test("-04:00 (EDT, first occurrence)", () => {
      const mm = moment.tz("2012-11-04 01:30:00-04:00", "America/New_York");
      const om = momentTimezone.tz("2012-11-04 01:30:00-04:00", "America/New_York");
      oracleEqual(mm, om);
    });

    test("-05:00 (EST, second occurrence)", () => {
      const mm = moment.tz("2012-11-04 01:30:00-05:00", "America/New_York");
      const om = momentTimezone.tz("2012-11-04 01:30:00-05:00", "America/New_York");
      oracleEqual(mm, om);
    });
  });

  describe("Europe/London spring forward", () => {
    const inputs = [
      "2012-03-25 00:59:59",
      "2012-03-25 01:00:00",
      "2012-03-25 01:30:00",
      "2012-03-25 02:00:00",
    ];
    for (const input of inputs) {
      test(input, () => {
        const mm = moment.tz(input, "Europe/London");
        const om = momentTimezone.tz(input, "Europe/London");
        oracleEqual(mm, om);
      });
    }
  });
});

/* ------------------------------------------------------------------ */
/*  Phase 6: Zone matrix                                              */
/* ------------------------------------------------------------------ */

describe("zone matrix", () => {
  const WINTER_TS = Date.UTC(2024, 0, 15, 12, 0, 0, 0);
  const SUMMER_TS = Date.UTC(2024, 6, 15, 12, 0, 0, 0);

  const zones = [
    "UTC",
    "Asia/Tokyo",
    "Asia/Kolkata",
    "America/New_York",
    "America/Los_Angeles",
    "America/Phoenix",
    "Europe/London",
    "Europe/Berlin",
    "Australia/Sydney",
    "Australia/Adelaide",
    "Pacific/Auckland",
  ];

  for (const zone of zones) {
    test(`${zone} winter`, () => {
      const mm = moment(WINTER_TS).tz(zone);
      const om = momentTimezone(WINTER_TS).tz(zone);
      oracleEqual(mm, om);
    });

    test(`${zone} summer`, () => {
      const mm = moment(SUMMER_TS).tz(zone);
      const om = momentTimezone(SUMMER_TS).tz(zone);
      oracleEqual(mm, om);
    });
  }
});

/* ------------------------------------------------------------------ */
/*  Phase 7: Zone object API                                          */
/* ------------------------------------------------------------------ */

describe("moment.tz.zone()", () => {
  test("returns zone object for valid zone", () => {
    const z = moment.tz.zone("Asia/Tokyo");
    expect(z).not.toBeNull();
    expect(z.name).toBe("Asia/Tokyo");
  });

  test("returns null for invalid zone", () => {
    expect(moment.tz.zone("Invalid/Zone")).toBeNull();
    expect(moment.tz.zone("")).toBeNull();
  });

  test("zone.abbr exists and returns a string", () => {
    const z = moment.tz.zone("Asia/Tokyo");
    expect(typeof z.abbr(0)).toBe("string");
  });

  test("zone.offset returns a number", () => {
    const z = moment.tz.zone("Asia/Tokyo");
    expect(typeof z.offset(0)).toBe("number");
  });

  test("zone.utcOffset returns a number", () => {
    const z = moment.tz.zone("Asia/Tokyo");
    expect(typeof z.utcOffset(0)).toBe("number");
  });

  test("zone.parse returns object with name and offset", () => {
    const z = moment.tz.zone("America/New_York");
    const p = z.parse(0);
    expect(p.name).toBe("America/New_York");
    expect(typeof p.offset).toBe("number");
  });
});

/* ------------------------------------------------------------------ */
/*  Phase 8: Default timezone                                         */
/* ------------------------------------------------------------------ */

describe("moment.tz.setDefault", () => {
  const savedDefault = moment.defaultZone;

  afterEach(() => {
    moment.defaultZone = savedDefault;
  });

  test("setDefault stores the zone name", () => {
    moment.tz.setDefault("America/New_York");
    expect(moment.defaultZone).toBe("America/New_York");
  });

  test("moment.tz(explicit, zone) still works after default is set", () => {
    moment.tz.setDefault("America/New_York");
    const m = moment.tz("2024-01-15 12:00", "Asia/Tokyo");
    const om = momentTimezone.tz("2024-01-15 12:00", "Asia/Tokyo");
    oracleEqual(m, om);
  });

  test("moment.utc() after default set is still UTC", () => {
    moment.tz.setDefault("America/New_York");
    const m = moment.utc("2024-06-15T12:00:00");
    expect(m.isUTC()).toBe(true);
    expect(m.utcOffset()).toBe(0);
  });
});

/* ------------------------------------------------------------------ */
/*  Phase 9: keepLocalTime                                            */
/* ------------------------------------------------------------------ */

describe("tz() keepLocalTime", () => {
  test("tz(zone) preserves instant (matches oracle)", () => {
    const mm = moment.utc("2024-06-15T12:00:00Z");
    const om = momentTimezone.utc("2024-06-15T12:00:00Z");
    const mmTz = mm.tz("Europe/Berlin");
    const omTz = om.tz("Europe/Berlin");
    oracleEqual(mmTz, omTz);
  });

  test("tz(zone, true) preserves wall clock (matches oracle)", () => {
    const mm = moment.utc("2024-06-15T12:00:00Z");
    const om = momentTimezone.utc("2024-06-15T12:00:00Z");
    const mmTz = mm.tz("Europe/Berlin", true);
    const omTz = om.tz("Europe/Berlin", true);
    oracleEqual(mmTz, omTz);
  });

  test("instant differs between keep and no-keep", () => {
    const base = moment.utc("2024-06-15T12:00:00Z");
    const noKeep = base.clone().tz("Europe/Berlin");
    const keep = base.clone().tz("Europe/Berlin", true);
    expect(noKeep.valueOf()).not.toBe(keep.valueOf());
  });
});

/* ------------------------------------------------------------------ */
/*  Phase 10: Regression fixtures                                     */
/* ------------------------------------------------------------------ */

describe("regression", () => {
  test("parse vs convert must not collapse", () => {
    const parsed = moment.tz("2013-11-18 11:55", "Asia/Taipei");
    const converted = moment("2013-11-18T11:55:00Z").tz("Asia/Taipei");
    expect(parsed.valueOf()).not.toBe(converted.valueOf());
  });
});
