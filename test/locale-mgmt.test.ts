import { describe, test, expect, beforeEach } from "bun:test";
import fc from "fast-check";
import moment from "../src/index.ts";
import originalMoment from "../moment/moment.js";

const nullLocaleConfig = null as unknown as Record<string, unknown>;
const localeSpec = (config: Record<string, unknown>): Record<string, unknown> => config;

// guarantee we always start from "en" locale
beforeEach(() => {
  moment.locale("en");
  originalMoment.locale("en");
});

describe("moment.locale()", () => {
  test("returns current locale name", () => {
    expect(typeof moment.locale()).toBe("string");
  });

  test("sets locale by name for a defined locale", () => {
    moment.locale("xx-switch", {
      months: "A B C D E F G H I J K L".split(" "),
    });
    expect(moment.locale("xx-switch")).toBe("xx-switch");
    expect(moment.locale()).toBe("xx-switch");
    moment.locale("xx-switch", nullLocaleConfig);
  });

  test("sets locale by array - picks first available", () => {
    const result = moment.locale(["en"]);
    expect(result).toBe("en");
  });

  test("unknown locale string keeps current locale", () => {
    moment.locale("xx-current", {
      months: "A B C D E F G H I J K L".split(" "),
    });
    originalMoment.locale(
      "xx-current",
      localeSpec({
        months: "A B C D E F G H I J K L".split(" "),
      }),
    );
    expect(moment.locale("xx-YY")).toBe(originalMoment.locale("xx-YY"));
    expect(moment.locale()).toBe(originalMoment.locale());
    moment.locale("xx-current", nullLocaleConfig);
    originalMoment.locale("xx-current", nullLocaleConfig);
  });

  test("locale set by exact name works", () => {
    moment.locale("en");
    const result = moment.locale("en");
    expect(result).toBe("en");
  });
});

describe("moment.locale() with key-value (defineLocale)", () => {
  test("defines a new locale inline", () => {
    const result = moment.locale("xx-dialect", {
      months: "A B C D E F G H I J K L".split(" "),
    });
    expect(result).toBe("xx-dialect");
    expect(moment.locale()).toBe("xx-dialect");
    moment.locale("xx-dialect", nullLocaleConfig);
  });

  test("defines locale with parentLocale", () => {
    moment.locale("xx-child", {
      parentLocale: "en",
      months: "Xx1 Xx2 Xx3 Xx4 Xx5 Xx6 Xx7 Xx8 Xx9 Xx10 Xx11 Xx12".split(" "),
    });
    const m = moment();
    expect(m.format("MMMM")).toMatch(/^Xx/);
    moment.locale("xx-child", nullLocaleConfig);
  });

  test("defines locale then updates it", () => {
    moment.locale("xx-test", {
      months: "Ja Fe Ma Ap Ma Ju Ju Au Se Oc No De".split(" "),
    });
    const m1 = moment.utc("2024-01-15");
    expect(m1.format("MMMM")).toBe("Ja");
    expect(m1.locale()).toBe("xx-test");

    moment.updateLocale("xx-test", {
      monthsShort: "J F M A M J J A S O N D".split(" "),
    });
    expect(moment.utc("2024-01-15").format("MMM")).toBe("J");
    expect(moment.utc("2024-01-15").format("MMMM")).toBe("Ja");
    moment.locale("xx-test", nullLocaleConfig);
  });
});

describe("moment.updateLocale()", () => {
  test("returns the locale object", () => {
    const result = moment.updateLocale("en", {});
    expect(result).toBeDefined();
  });

  test("resets locale to null removes it", () => {
    moment.locale("xx-reset", {
      months: "A B C D E F G H I J K L".split(" "),
    });
    moment.updateLocale("xx-reset", null);
    expect(moment.locales()).not.toContain("xx-reset");
  });

  test("updateLocale with null on non-existent locale returns en", () => {
    expect(moment.updateLocale("xx-nonexist", null) as unknown).toBe(
      originalMoment.updateLocale("xx-nonexist", null as unknown as never) as unknown,
    );
  });
});

describe("moment.locale() -> defineLocale null", () => {
  test("undeletes a locale", () => {
    moment.locale("xx-del", {
      months: "A B C D E F G H I J K L".split(" "),
    });
    expect(moment.locales()).toContain("xx-del");
    moment.locale("xx-del", nullLocaleConfig);
    expect(moment.locales()).not.toContain("xx-del");
  });

  test("defineLocale null on unknown locale returns en", () => {
    expect(moment.locale("xx-ghost", nullLocaleConfig)).toBe(
      originalMoment.locale("xx-ghost", nullLocaleConfig),
    );
    expect(moment.locales()).not.toContain("xx-ghost");
  });
});

describe("moment.locales()", () => {
  test("returns array of known locale names", () => {
    const locales = moment.locales();
    expect(Array.isArray(locales)).toBe(true);
    expect(locales.length).toBeGreaterThan(0);
    expect(locales).toContain("en");
  });
});

describe("moment.months()", () => {
  test("returns full month names", () => {
    const months = moment.months();
    expect(Array.isArray(months)).toBe(true);
    expect(months.length).toBe(12);
    expect(months[0]).toBe("January");
  });

  test("returns short month names", () => {
    const short = moment.monthsShort();
    expect(Array.isArray(short)).toBe(true);
    expect(short.length).toBe(12);
    expect(short[0]).toBe("Jan");
  });

  test("returns month name by index", () => {
    expect(moment.months(0)).toBe("January");
    expect(moment.months(11)).toBe("December");
    expect(moment.monthsShort(0)).toBe("Jan");
    expect(moment.monthsShort(11)).toBe("Dec");
  });

  test("month(index) with short format returns short", () => {
    moment.locale("en");
    originalMoment.locale("en");
    expect(moment.months("MMM", 0)).toBe(originalMoment.months("MMM", 0));
  });
});

describe("moment.weekdays()", () => {
  test("returns full weekday names", () => {
    const wd = moment.weekdays();
    expect(Array.isArray(wd)).toBe(true);
    expect(wd.length).toBe(7);
    expect(wd[0]).toBe("Sunday");
  });

  test("returns weekday by index", () => {
    expect(moment.weekdays(0)).toBe("Sunday");
    expect(moment.weekdays(6)).toBe("Saturday");
  });

  test("returns short weekday names", () => {
    const short = moment.weekdaysShort();
    expect(Array.isArray(short)).toBe(true);
    expect(short.length).toBe(7);
    expect(short[0]).toBe("Sun");
  });

  test("returns min weekday names", () => {
    const min = moment.weekdaysMin();
    expect(Array.isArray(min)).toBe(true);
    expect(min.length).toBe(7);
    expect(min[0]).toBe("Su");
  });

  test("returns reordered weekdays for format=true", () => {
    const reordered = moment.weekdays(true);
    expect(Array.isArray(reordered)).toBe(true);
    expect(reordered.length).toBe(7);
  });

  test("returns format weekday string", () => {
    expect(moment.weekdays("format")).toBe(originalMoment.weekdays("format"));
  });

  test("returns shortFormat weekday string", () => {
    expect(moment.weekdays("shortFormat")).toBe(originalMoment.weekdays("shortFormat"));
  });

  test("returns minFormat weekday string", () => {
    expect(moment.weekdays("minFormat")).toBe(originalMoment.weekdays("minFormat"));
  });

  test("returns specific index with format", () => {
    expect(moment.weekdays("format", 1)).toBe(originalMoment.weekdays("format", 1));
  });
});

describe("moment.localeData()", () => {
  test("returns locale data for current locale", () => {
    const ld = moment.localeData();
    expect(ld).toBeDefined();
    expect(ld._months).toBeDefined();
    expect(ld._months.length).toBe(12);
  });

  test("returns locale data for specific locale", () => {
    const ld = moment.localeData("en");
    expect(ld).toBeDefined();
    expect(ld._months[0]).toBe("January");
  });

  test("localeData for unknown locale falls back to en", () => {
    const ld = moment.localeData("xx-unknown");
    expect(ld).toBeDefined();
    expect(ld._months[0]).toBe("January");
  });
});

describe("moment.locale() edge cases", () => {
  test("updateLocale on existing locale preserves original", () => {
    moment.updateLocale("en", { months: "A B C D E F G H I J K L".split(" ") });
    expect(moment.months(0)).toBe("A");
    moment.updateLocale("en", null);
    expect(moment.months(0)).toBe("January");
  });

  test("defineLocale with parentLocale that does not exist yet (locale still created but with warnings)", () => {
    const result = moment.locale("xx-orphan", {
      parentLocale: "xx-missing",
      months: "A B C D E F G H I J K L".split(" "),
    });
    const expected = originalMoment.locale(
      "xx-orphan",
      localeSpec({
        parentLocale: "xx-missing",
        months: "A B C D E F G H I J K L".split(" "),
      }),
    );
    expect(result).toBe(expected);
    expect(moment.locales().includes("xx-orphan")).toBe(
      originalMoment.locales().includes("xx-orphan"),
    );
    moment.locale("xx-orphan", nullLocaleConfig);
  });

  test("defineLocale updates existing config without parentLocale", () => {
    moment.locale("xx-dup", {
      months: "Aa Bb Cc Dd Ee Ff Gg Hh Ii Jj Kk Ll".split(" "),
    });
    moment.locale("xx-dup", {
      monthsShort: "A B C D E F G H I J K L".split(" "),
    });
    expect(moment.monthsShort(0)).toBe("A");
    moment.locale("xx-dup", nullLocaleConfig);
  });

  test("setLocaleFromArray picks exact match first", () => {
    moment.locale("en");
    const result = moment.locale(["en"]);
    expect(result).toBe("en");
  });

  test("setLocale falls back to en when none match", () => {
    moment.locale("en");
    const result = moment.locale(["xx-a", "xx-b"]);
    expect(result).toBe("en");
  });
});

describe("property-based locale management patterns", () => {
  const monthIndices = fc.integer({ min: 0, max: 11 });
  const weekdayIndices = fc.integer({ min: 0, max: 6 });

  test("months() by index matches moment.js", () => {
    fc.assert(
      fc.property(monthIndices, (i) => {
        expect(moment.months(i)).toBe(originalMoment.months(i));
        expect(moment.monthsShort(i)).toBe(originalMoment.monthsShort(i));
      }),
      { numRuns: 50 },
    );
  });

  test("weekdays() by index matches moment.js", () => {
    fc.assert(
      fc.property(weekdayIndices, (i) => {
        expect(moment.weekdays(i)).toBe(originalMoment.weekdays(i));
        expect(moment.weekdaysShort(i)).toBe(originalMoment.weekdaysShort(i));
        expect(moment.weekdaysMin(i)).toBe(originalMoment.weekdaysMin(i));
      }),
      { numRuns: 50 },
    );
  });

  test("localeData()._months matches moment.js", () => {
    fc.assert(
      fc.property(monthIndices, (i) => {
        const ld = moment.localeData("en");
        const old = originalMoment.localeData("en");
        expect(ld._months[i]).toBe(old._months[i]);
        expect(ld._monthsShort[i]).toBe(old._monthsShort[i]);
      }),
      { numRuns: 50 },
    );
  });

  test("localeData()._weekdays matches moment.js", () => {
    fc.assert(
      fc.property(weekdayIndices, (i) => {
        const ld = moment.localeData("en");
        const old = originalMoment.localeData("en");
        expect(ld._weekdays[i]).toBe(old._weekdays[i]);
        // mmntjs does not expose _weekdaysShort/_weekdaysMin on localeData
      }),
      { numRuns: 50 },
    );
  });

  test("locale() with unknown locale keeps current locale (same as moment.js)", () => {
    fc.assert(
      fc.property(fc.string({ minLength: 4, maxLength: 8 }), (name) => {
        const safeName = name.replaceAll(/[^a-z]/gi, "x").toLowerCase();
        if (safeName === "en" || safeName.length < 2) {
          return;
        }
        moment.locale("en");
        originalMoment.locale("en");
        const mResult = moment.locale(safeName as string);
        const oResult = originalMoment.locale(safeName as string);
        expect(mResult).toBe(oResult);
        expect(moment.locale()).toBe(originalMoment.locale());
      }),
      { numRuns: 100 },
    );
  });
});
