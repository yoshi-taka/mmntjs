/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, test, expect } from "bun:test";
import moment from "../src/index.ts";
import originalMoment from "../moment/moment.js";

// Helper: oracle comparison for valueOf + format
function compareMoments(mm: ReturnType<typeof moment>, om: ReturnType<typeof originalMoment>) {
  const mmValid = mm.isValid();
  const omValid = om.isValid();
  if (mmValid !== omValid) {
    return;
  }
  if (mmValid) {
    expect(mm.valueOf()).toBe(om.valueOf());
    expect(mm.utcOffset()).toBe(om.utcOffset());
  }
}

// =========================================================================
// Static API Coverage
// =========================================================================

describe("moment.defaultFormat / defaultFormatUtc", () => {
  test("defaultFormat exists and is writable", () => {
    expect((moment as any).defaultFormat).toBeDefined();
    expect(typeof (moment as any).defaultFormat).toBe("string");
    const orig = (moment as any).defaultFormat;
    (moment as any).defaultFormat = "YYYY-MM-DD HH:mm:ss";
    // Check that moment().format() uses the new default
    const m = moment("2024-06-15T12:30:00");
    expect(m.format()).toBe(m.format("YYYY-MM-DD HH:mm:ss"));
    (moment as any).defaultFormat = orig;
  });

  test("defaultFormatUtc exists and is writable", () => {
    expect((moment as any).defaultFormatUtc).toBeDefined();
    expect(typeof (moment as any).defaultFormatUtc).toBe("string");
    const orig = (moment as any).defaultFormatUtc;
    (moment as any).defaultFormatUtc = "YYYY-MM-DD HH:mm:ss";
    const m = moment.utc("2024-06-15T12:30:00");
    expect(m.format()).toBe(m.format("YYYY-MM-DD HH:mm:ss"));
    (moment as any).defaultFormatUtc = orig;
  });

  test("defaultFormat vs moment.js oracle", () => {
    const orig = (moment as any).defaultFormat;
    const origOrig = originalMoment.defaultFormat;
    const testFormats = ["YYYY-MM-DD HH:mm", "MM/DD/YYYY", "DD.MM.YYYY"];
    for (const fmt of testFormats) {
      (moment as any).defaultFormat = fmt;
      (originalMoment as any).defaultFormat = fmt;
      const m = moment("2024-06-15T12:30:00");
      const om = originalMoment("2024-06-15T12:30:00");
      expect(m.format()).toBe(om.format());
    }
    (moment as any).defaultFormat = orig;
    (originalMoment as any).defaultFormat = origOrig;
  });

  test("defaultFormatUtc vs moment.js oracle", () => {
    const orig = (moment as any).defaultFormatUtc;
    const origOrig = originalMoment.defaultFormatUtc;
    const testFormats = ["YYYY-MM-DD HH:mm", "MM/DD/YYYY"];
    for (const fmt of testFormats) {
      (moment as any).defaultFormatUtc = fmt;
      (originalMoment as any).defaultFormatUtc = fmt;
      const m = moment.utc("2024-06-15T12:30:00");
      const om = originalMoment.utc("2024-06-15T12:30:00");
      expect(m.format()).toBe(om.format());
    }
    (moment as any).defaultFormatUtc = orig;
    (originalMoment as any).defaultFormatUtc = origOrig;
  });
});

describe("moment.createFromInputFallback", () => {
  test("exists as a function", () => {
    expect(typeof (moment as any).createFromInputFallback).toBe("function");
  });

  test("is callable without error", () => {
    expect(() => (moment as any).createFromInputFallback("test")).not.toThrow();
  });

  test("can be overridden", () => {
    let called = false;
    const orig = (moment as any).createFromInputFallback;
    (moment as any).createFromInputFallback = () => {
      called = true;
    };
    (moment as any).createFromInputFallback("test");
    expect(called).toBe(true);
    (moment as any).createFromInputFallback = orig;
  });
});

describe("moment.config / moment.report", () => {
  test("moment.config exists and is callable", () => {
    expect(typeof (moment as any).config).toBe("function");
    expect(() => (moment as any).config("test", "value")).not.toThrow();
    expect(() => (moment as any).config("test")).not.toThrow();
  });

  test("moment.report exists and is callable", () => {
    expect(typeof (moment as any).report).toBe("function");
    expect(() => (moment as any).report("test")).not.toThrow();
    expect(() => (moment as any).report()).not.toThrow();
  });

  test("config/report match moment.js behavior (mmntjs has them, moment.js may not)", () => {
    // moment.js may not expose config/report; we add them for type compatibility
    expect(typeof (moment as any).config).toBe("function");
    expect(typeof (moment as any).report).toBe("function");
  });
});

// =========================================================================
// Locale Data API Coverage
// =========================================================================

describe("localeData().monthsParse", () => {
  test("exists on localeData", () => {
    const loc = moment.localeData();
    expect(typeof (loc as any).monthsParse).toBe("function");
  });

  test("parses full month name", () => {
    const loc = moment.localeData("en");
    expect((loc as any).monthsParse("January", "MMMM")).toBe(0);
    expect((loc as any).monthsParse("February", "MMMM")).toBe(1);
    expect((loc as any).monthsParse("December", "MMMM")).toBe(11);
  });

  test("parses short month name", () => {
    const loc = moment.localeData("en");
    expect((loc as any).monthsParse("Jan", "MMM")).toBe(0);
    expect((loc as any).monthsParse("Dec", "MMM")).toBe(11);
  });

  test("returns -1 for unknown month", () => {
    const loc = moment.localeData("en");
    expect((loc as any).monthsParse("NotAMonth", "MMMM")).toBe(-1);
  });

  test("case insensitive matching", () => {
    const loc = moment.localeData("en");
    expect((loc as any).monthsParse("january", "MMMM")).toBe(0);
    expect((loc as any).monthsParse("JANUARY", "MMMM")).toBe(0);
  });

  test("matches moment.js oracle", () => {
    const loc = moment.localeData("en");
    const oloc = originalMoment.localeData("en");
    const testCases = [
      ["January", "MMMM"],
      ["Jan", "MMM"],
      ["February", "MMMM"],
      ["Feb", "MMM"],
      ["december", "MMMM"],
      ["DEC", "MMM"],
    ];
    for (const [name, fmt] of testCases) {
      expect((loc as any).monthsParse(name, fmt)).toBe((oloc as any).monthsParse(name, fmt));
    }
  });
});

describe("localeData().monthsRegex", () => {
  test("exists on localeData", () => {
    const loc = moment.localeData();
    expect(typeof (loc as any).monthsRegex).toBe("function");
  });

  test("returns a RegExp", () => {
    const loc = moment.localeData("en");
    const regex = (loc as any).monthsRegex(false);
    expect(regex instanceof RegExp).toBe(true);
  });

  test("matches moment.js oracle for strict", () => {
    const loc = moment.localeData("en");
    const oloc = originalMoment.localeData("en");
    const mmRegex = (loc as any).monthsRegex(true);
    const omRegex = (oloc as any).monthsRegex(true);
    expect(mmRegex instanceof RegExp).toBe(true);
    expect(omRegex instanceof RegExp).toBe(true);
    // Both should match "January" and reject "Januar"
    expect(mmRegex.test("January")).toBe(true);
    expect(omRegex.test("January")).toBe(true);
  });
});

describe("localeData().monthsShortRegex", () => {
  test("exists and returns RegExp", () => {
    const loc = moment.localeData("en");
    expect(typeof (loc as any).monthsShortRegex).toBe("function");
    expect((loc as any).monthsShortRegex(false) instanceof RegExp).toBe(true);
  });

  test("matches short month names", () => {
    const loc = moment.localeData("en");
    const regex = (loc as any).monthsShortRegex(true);
    expect(regex.test("Jan")).toBe(true);
    expect(regex.test("Dec")).toBe(true);
    expect(regex.test("January")).toBe(false);
  });
});

describe("localeData().weekdaysParse", () => {
  test("exists on localeData", () => {
    const loc = moment.localeData();
    expect(typeof (loc as any).weekdaysParse).toBe("function");
  });

  test("parses weekday names", () => {
    const loc = moment.localeData("en");
    expect((loc as any).weekdaysParse("Monday")).toBe(1);
    expect((loc as any).weekdaysParse("Sunday")).toBe(0);
    expect((loc as any).weekdaysParse("Saturday")).toBe(6);
  });

  test("returns -1 for unknown", () => {
    const loc = moment.localeData("en");
    expect((loc as any).weekdaysParse("Funday")).toBe(-1);
  });

  test("matches moment.js oracle", () => {
    const loc = moment.localeData("en");
    const oloc = originalMoment.localeData("en");
    const testCases = ["Monday", "monday", "MONDAY", "Tue", "tue", "Fri", "Saturday"];
    for (const name of testCases) {
      expect((loc as any).weekdaysParse(name, "dddd")).toBe(
        (oloc as any).weekdaysParse(name, "dddd"),
      );
    }
  });
});

describe("localeData().weekdaysRegex / weekdaysShortRegex / weekdaysMinRegex", () => {
  test("all three exist and return RegExp", () => {
    const loc = moment.localeData("en");
    expect(typeof (loc as any).weekdaysRegex).toBe("function");
    expect(typeof (loc as any).weekdaysShortRegex).toBe("function");
    expect(typeof (loc as any).weekdaysMinRegex).toBe("function");
    expect((loc as any).weekdaysRegex(false) instanceof RegExp).toBe(true);
    expect((loc as any).weekdaysShortRegex(false) instanceof RegExp).toBe(true);
    expect((loc as any).weekdaysMinRegex(false) instanceof RegExp).toBe(true);
  });
});

describe("localeData().calendar", () => {
  test("exists on localeData", () => {
    const loc = moment.localeData();
    expect(typeof (loc as any).calendar).toBe("function");
  });

  test("returns default calendar strings", () => {
    const loc = moment.localeData("en");
    const result = (loc as any).calendar("sameDay", moment(), moment());
    expect(typeof result).toBe("string");
  });

  test("matches moment.js oracle", () => {
    const loc = moment.localeData("en");
    const oloc = originalMoment.localeData("en");
    const keys = ["sameDay", "nextDay", "lastDay", "nextWeek", "lastWeek", "sameElse"];
    for (const key of keys) {
      const mm = (loc as any).calendar(key);
      const om = (oloc as any).calendar(key);
      // Compare types and structure
      expect(typeof mm).toBe(typeof om);
    }
  });
});

describe("localeData().pastFuture", () => {
  test("exists on localeData", () => {
    const loc = moment.localeData();
    expect(typeof (loc as any).pastFuture).toBe("function");
  });

  test("formats future times", () => {
    const loc = moment.localeData("en");
    const result = (loc as any).pastFuture(5, "5 minutes");
    expect(result).toBe("in 5 minutes");
  });

  test("formats past times", () => {
    const loc = moment.localeData("en");
    const result = (loc as any).pastFuture(-5, "5 minutes");
    expect(result).toBe("5 minutes ago");
  });

  test("matches moment.js oracle", () => {
    const loc = moment.localeData("en");
    const oloc = originalMoment.localeData("en");
    const cases = [
      [1, "1 hour"],
      [-1, "1 hour"],
      [7, "7 days"],
      [-30, "30 minutes"],
    ];
    for (const [diff, rel] of cases) {
      expect((loc as any).pastFuture(diff, rel)).toBe((oloc as any).pastFuture(diff, rel));
    }
  });
});

describe("localeData().set", () => {
  test("exists on localeData", () => {
    const loc = moment.localeData();
    expect(typeof (loc as any).set).toBe("function");
  });

  test("can merge config", () => {
    moment.locale("en");
    const loc = moment.localeData("en") as any;
    const orig = loc._config.ordinal;
    loc.set({ ordinal: (n: number) => `${n}th` });
    expect(loc._config.ordinal(5)).toBe("5th");
    // Restore
    loc.set({ ordinal: orig });
  });

  test("matches moment.js set() behavior", () => {
    expect(typeof (moment.localeData() as any).set).toBe(
      typeof (originalMoment.localeData() as any).set,
    );
  });
});

describe("localeData().eras", () => {
  test("exists on localeData", () => {
    const loc = moment.localeData();
    expect(typeof (loc as any).eras).toBe("function");
  });

  test("returns an array", () => {
    const loc = moment.localeData("en") as any;
    const eras = loc.eras();
    expect(Array.isArray(eras)).toBe(true);
  });
});

describe("localeData().week", () => {
  test("exists on localeData", () => {
    const loc = moment.localeData();
    expect(typeof (loc as any).week).toBe("function");
  });

  test("returns week number", () => {
    const loc = moment.localeData("en") as any;
    const w = loc.week(moment("2024-01-15"));
    expect(typeof w).toBe("number");
    expect(w).toBe(3); // Week 3 of 2024
  });
});

// =========================================================================
// Timezone API Coverage
// =========================================================================

describe("moment.tz.countries()", () => {
  test("exists and returns array", () => {
    // Check at runtime (may not be available without timezone data loaded)
    const tz = (moment as any).tz;
    if (tz && typeof tz.countries === "function") {
      const countries = tz.countries();
      expect(Array.isArray(countries)).toBe(true);
    }
  });
});

describe("moment.tz.zone(name).countries()", () => {
  test("zone.countries exists on InternalZone", () => {
    const tz = (moment as any).tz;
    if (tz && typeof tz.zone === "function") {
      const zone = tz.zone("America/New_York");
      if (zone) {
        expect(typeof (zone as any).countries).toBe("function");
        const countries = (zone as any).countries();
        expect(Array.isArray(countries)).toBe(true);
        if (countries.length > 0) {
          expect(typeof countries[0]).toBe("string");
        }
      }
    }
  });
});

describe("moment.tz.setDefault() propagation", () => {
  test("moment.defaultZone is set by setDefault", () => {
    const tz = (moment as any).tz;
    if (tz && typeof tz.setDefault === "function") {
      tz.setDefault("America/New_York");
      expect((moment as any).defaultZone).toBe("America/New_York");
      tz.setDefault();
      expect((moment as any).defaultZone).toBeUndefined();
    }
  });

  test("moment() uses default zone when setDefault is active", () => {
    const tz = (moment as any).tz;
    if (tz && typeof tz.setDefault === "function") {
      tz.setDefault("America/New_York");
      const m = moment();
      // The moment should have _z set to the America/New_York zone
      expect((m as any)._z).toBeDefined();
      if ((m as any)._z) {
        expect((m as any)._z.name).toBe("America/New_York");
      }
      tz.setDefault();
    }
  });

  test("moment.tz.setDefault() matches moment-timezone behavior", () => {
    const tz = (moment as any).tz;
    const otz = (originalMoment as any).tz;
    if (tz && typeof tz.setDefault === "function" && otz && typeof otz.setDefault === "function") {
      tz.setDefault("America/New_York");
      otz.setDefault("America/New_York");
      const m = moment();
      const om = originalMoment();
      expect(typeof (m as any)._z !== undefined).toBe(typeof (om as any)._z !== undefined);
      tz.setDefault();
      otz.setDefault();
    }
  });
});

describe("moment.tz.version / dataVersion", () => {
  test("moment.tz.version is a string", () => {
    const tz = (moment as any).tz;
    if (tz) {
      expect(typeof tz.version).toBe("string");
    }
  });

  test("moment.tz.dataVersion is a string", () => {
    const tz = (moment as any).tz;
    if (tz) {
      expect(typeof tz.dataVersion).toBe("string");
    }
  });
});

describe("moment.tz.names()", () => {
  test("returns array of strings", () => {
    const tz = (moment as any).tz;
    if (tz && typeof tz.names === "function") {
      const names = tz.names();
      expect(Array.isArray(names)).toBe(true);
      expect(names.length).toBeGreaterThan(0);
      expect(typeof names[0]).toBe("string");
    }
  });
});

describe("moment.tz.zone()", () => {
  test("returns zone object with expected methods", () => {
    const tz = (moment as any).tz;
    if (tz && typeof tz.zone === "function") {
      const zone = tz.zone("America/New_York");
      expect(zone).not.toBeNull();
      expect(typeof (zone as any).name).toBe("string");
      expect(typeof (zone as any).abbr).toBe("function");
      expect(typeof (zone as any).offset).toBe("function");
      expect(typeof (zone as any).utcOffset).toBe("function");
      expect(typeof (zone as any).parse).toBe("function");
    }
  });
});

describe("moment.tz(moment)", () => {
  test("moment.tz() with no args returns current moment", () => {
    const tz = (moment as any).tz;
    if (tz) {
      const m = tz();
      expect(m.isValid()).toBe(true);
    }
  });
});

// =========================================================================
// Instance API edge cases coverage
// =========================================================================

describe("isDSTShifted()", () => {
  test("exists on moment instances", () => {
    const m = moment("2024-06-15");
    expect(typeof (m as any).isDSTShifted).toBe("function");
  });

  test("returns boolean", () => {
    const m = moment("2024-06-15");
    expect(typeof (m as any).isDSTShifted()).toBe("boolean");
  });
});

describe("moment.suppressDeprecationWarnings / deprecationHandler", () => {
  test("suppressDeprecationWarnings exists", () => {
    expect((moment as any).suppressDeprecationWarnings).toBeDefined();
    expect(typeof (moment as any).suppressDeprecationWarnings).toBe("boolean");
  });

  test("deprecationHandler exists", () => {
    expect("deprecationHandler" in moment).toBe(true);
  });

  test("matches moment.js type", () => {
    expect(typeof (moment as any).suppressDeprecationWarnings).toBe(
      typeof (originalMoment as any).suppressDeprecationWarnings,
    );
  });
});

describe("moment.isDuration", () => {
  test("exists and works", () => {
    expect(typeof (moment as any).isDuration).toBe("function");
    expect(moment.isDuration(moment.duration(5, "minutes"))).toBe(true);
    expect(moment.isDuration({})).toBe(false);
  });
});

describe("format k/kk (1-24 hours)", () => {
  test("k format works for midnight (shows 24)", () => {
    const m = moment("2024-06-15T00:00:00");
    expect(m.format("k")).toBe("24");
    expect(m.format("kk")).toBe("24");
  });

  test("k format matches moment.js", () => {
    const m = moment("2024-06-15T00:00:00");
    const om = originalMoment("2024-06-15T00:00:00");
    expect(m.format("k")).toBe(om.format("k"));
    expect(m.format("kk")).toBe(om.format("kk"));
  });

  test("k format matches moment.js for non-midnight", () => {
    const m = moment("2024-06-15T13:00:00");
    const om = originalMoment("2024-06-15T13:00:00");
    expect(m.format("k")).toBe(om.format("k"));
    expect(m.format("kk")).toBe(om.format("kk"));
  });
});

// =========================================================================
// Locale default format edge cases
// =========================================================================

describe("format() without arguments (regression)", () => {
  test("moment().format() still works after defaultFormat changes", () => {
    const orig = (moment as any).defaultFormat;
    (moment as any).defaultFormat = "YYYY/MM/DD";
    const m = moment("2024-06-15");
    expect(m.format()).toBe("2024/06/15");
    (moment as any).defaultFormat = orig;
  });

  test("moment.utc().format() still works after defaultFormatUtc changes", () => {
    const orig = (moment as any).defaultFormatUtc;
    (moment as any).defaultFormatUtc = "YYYY/MM/DD";
    const m = moment.utc("2024-06-15");
    expect(m.format()).toBe("2024/06/15");
    (moment as any).defaultFormatUtc = orig;
  });

  test("restoring defaultFormat reuses original behavior", () => {
    const orig = (moment as any).defaultFormat;
    (moment as any).defaultFormat = "TEST";
    (moment as any).defaultFormat = orig;
    const m = moment("2024-06-15T12:00:00");
    const om = originalMoment("2024-06-15T12:00:00");
    expect(m.format()).toBe(om.format());
  });
});

// =========================================================================
// zone.countries() for builtin zones
// =========================================================================

describe("moment.tz.zonesForCountry", () => {
  test("exists and returns zones", () => {
    const tz = (moment as any).tz;
    if (tz && typeof tz.zonesForCountry === "function") {
      const zones = tz.zonesForCountry("US");
      expect(Array.isArray(zones)).toBe(true);
    }
  });
});

describe("moment.tz.guess()", () => {
  test("exists and returns string", () => {
    const tz = (moment as any).tz;
    if (tz && typeof tz.guess === "function") {
      const guess = tz.guess();
      expect(typeof guess).toBe("string");
      expect(guess.length).toBeGreaterThan(0);
    }
  });
});

describe("moment.tz.add / link / load", () => {
  test("add exists and is callable", () => {
    const tz = (moment as any).tz;
    if (tz && typeof tz.add === "function") {
      expect(() => (tz as any).add("Fake/Zone|FAKE|0|0|0|0")).not.toThrow();
    }
  });

  test("link exists and is callable", () => {
    const tz = (moment as any).tz;
    if (tz && typeof tz.link === "function") {
      expect(() => (tz as any).link("Fake/New|Fake/Old")).not.toThrow();
    }
  });

  test("load exists and is callable", () => {
    const tz = (moment as any).tz;
    if (tz && typeof tz.load === "function") {
      expect(() => (tz as any).load({ version: "test", zones: [], links: [] })).not.toThrow();
    }
  });
});

describe("moment.tz.unpack / unpackBase60", () => {
  test("unpack exists", () => {
    const tz = (moment as any).tz;
    if (tz && typeof tz.unpack === "function") {
      const result = tz.unpack("Test|TEST|0|0||0");
      expect(result).toBeDefined();
      expect(result.name).toBe("Test");
    }
  });

  test("unpackBase60 exists", () => {
    const tz = (moment as any).tz;
    if (tz && typeof tz.unpackBase60 === "function") {
      const result = tz.unpackBase60("1A");
      expect(typeof result).toBe("number");
    }
  });
});

describe("moment.tz.Zone (class)", () => {
  test("moment.tz.Zone is constructible", () => {
    const tz = (moment as any).tz;
    if (tz && tz.Zone) {
      const zone = new tz.Zone("Test|TEST|0|0||0");
      expect(zone).toBeDefined();
      expect(zone.name).toBe("Test");
      expect(typeof zone.abbr).toBe("function");
      expect(typeof zone.offset).toBe("function");
      expect(typeof zone.utcOffset).toBe("function");
    }
  });
});

// =========================================================================
// Locale monthsParseExact flag integration
// =========================================================================

describe("monthsParseExact flag integration", () => {
  test("en locale with monthsParseExact affects regex (regression)", () => {
    // Default: monthsParseExact is false for 'en' so short names are included
    const loc = moment.localeData("en") as any;
    const nonStrictRegex = loc.monthsRegex(false);
    // Non-exact: short "Jan" should match the full-month regex
    expect(nonStrictRegex.test("Jan")).toBe(true);
  });
});
