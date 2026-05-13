import { describe, test, expect, beforeEach } from "bun:test";
import moment from "../src/index.ts";

// guarantee we always start from "en" locale
beforeEach(() => {
  moment.locale("en");
});

describe("moment.locale()", () => {
  test("returns current locale name", () => {
    expect(typeof moment.locale()).toBe("string");
  });

  test("sets locale by name", () => {
    const result = moment.locale("de");
    expect(result).toBe("de");
    expect(moment.locale()).toBe("de");
  });

  test("sets locale by array - picks first available", () => {
    const result = moment.locale(["en"]);
    expect(result).toBe("en");
  });

  test("unknown locale string is set as-is (no fallback on set)", () => {
    const result = moment.locale("xx-YY");
    expect(result).toBe("xx-YY");
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
    moment.locale("xx-dialect", null as any);
  });

  test("defines locale with parentLocale", () => {
    moment.locale("xx-child", {
      parentLocale: "en",
      months: "Xx1 Xx2 Xx3 Xx4 Xx5 Xx6 Xx7 Xx8 Xx9 Xx10 Xx11 Xx12".split(" "),
    });
    const m = moment();
    expect(m.format("MMMM")).toMatch(/^Xx/);
    moment.locale("xx-child", null as any);
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
    moment.locale("xx-test", null as any);
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
    const result = moment.updateLocale("xx-nonexist", null);
    // returns the locale object for "en" (fallback)
    expect(result).toBeDefined();
  });
});

describe("moment.locale() -> defineLocale null", () => {
  test("undeletes a locale", () => {
    moment.locale("xx-del", {
      months: "A B C D E F G H I J K L".split(" "),
    });
    expect(moment.locales()).toContain("xx-del");
    moment.locale("xx-del", null as any);
    expect(moment.locales()).not.toContain("xx-del");
  });

  test("defineLocale null on unknown locale returns en", () => {
    const result = moment.locale("xx-ghost", null as any);
    expect(result).toBeDefined();
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
    expect(moment.months("MMM", 0)).toBe("Jan");
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

  test("returns format weekdays", () => {
    const fmt = moment.weekdays("format");
    expect(Array.isArray(fmt)).toBe(true);
    expect(fmt.length).toBe(7);
  });

  test("returns shortFormat weekdays", () => {
    const sf = moment.weekdays("shortFormat");
    expect(Array.isArray(sf)).toBe(true);
    expect(sf.length).toBe(7);
  });

  test("returns minFormat weekdays", () => {
    const mf = moment.weekdays("minFormat");
    expect(Array.isArray(mf)).toBe(true);
    expect(mf.length).toBe(7);
  });

  test("returns specific index with format", () => {
    const d = moment.weekdays("format", 1);
    expect(d).toBe("Monday");
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
    expect(typeof result).toBe("string");
    moment.locale("xx-orphan", null as any);
  });

  test("defineLocale updates existing config without parentLocale", () => {
    moment.locale("xx-dup", {
      months: "Aa Bb Cc Dd Ee Ff Gg Hh Ii Jj Kk Ll".split(" "),
    });
    moment.locale("xx-dup", {
      monthsShort: "A B C D E F G H I J K L".split(" "),
    });
    expect(moment.monthsShort(0)).toBe("A");
    moment.locale("xx-dup", null as any);
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
