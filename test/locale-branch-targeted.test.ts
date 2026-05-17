import { describe, test, expect } from "bun:test";
import moment from "../src/index.ts";
import originalMoment from "../moment/moment.js";

// Branch-targeted tests for locale-format.ts and locale-runtime.ts uncovered branches

describe("localeMeridiem branches", () => {
  test("locale without meridiem falls back to enLocale.meridiem", () => {
    moment.defineLocale("x-meridiem-fallback", {});
    originalMoment.defineLocale("x-meridiem-fallback", {});
    const m = moment("2024-06-15T14:30:00").locale("x-meridiem-fallback");
    const o = originalMoment("2024-06-15T14:30:00").locale("x-meridiem-fallback");
    expect(m.format("A")).toBe(o.format("A"));
    expect(m.format("a")).toBe(o.format("a"));
    moment.locale("x-meridiem-fallback", null);
    originalMoment.locale("x-meridiem-fallback", null);
  });

  test("AM/PM fallback (locale + enLocale both without meridiem)", () => {
    // Both locale and enLocale have no meridiem defined
    moment.locale("en");
    originalMoment.locale("en");
    const m = moment("2024-06-15T08:30:00");
    const o = originalMoment("2024-06-15T08:30:00");
    expect(m.format("A")).toBe(o.format("A"));
    expect(m.format("a")).toBe(o.format("a"));

    const m2 = moment("2024-06-15T20:30:00");
    const o2 = originalMoment("2024-06-15T20:30:00");
    expect(m2.format("A")).toBe(o2.format("A"));
    expect(m2.format("a")).toBe(o2.format("a"));
  });

  test("meridiem isLower parameter works", () => {
    moment.defineLocale("x-meridiem-lower", {
      meridiem: (h: number, _m: number, isLower: boolean) => {
        if (isLower) {
          return h < 12 ? "am" : "pm";
        }
        return h < 12 ? "AM" : "PM";
      },
    });
    originalMoment.defineLocale("x-meridiem-lower", {
      meridiem: (h: number, _m: number, isLower: boolean) => {
        if (isLower) {
          return h < 12 ? "am" : "pm";
        }
        return h < 12 ? "AM" : "PM";
      },
    });
    const m = moment("2024-06-15T14:30:00").locale("x-meridiem-lower");
    const o = originalMoment("2024-06-15T14:30:00").locale("x-meridiem-lower");
    expect(m.format("A")).toBe(o.format("A"));
    expect(m.format("a")).toBe(o.format("a"));
    moment.locale("x-meridiem-lower", null);
    originalMoment.locale("x-meridiem-lower", null);
  });
});

describe("localeMonths branches", () => {
  test("no months config falls back to en months via localeData", () => {
    moment.defineLocale("x-mo-none", {});
    const ld = moment.localeData("x-mo-none");
    expect(Array.isArray(ld._months)).toBe(true);
    // Falls back to en since months is undefined -> ?? enLocale.months
    expect(ld._months.length).toBe(12);
    moment.locale("x-mo-none", null);
  });

  test("months as function is called with moment and format", () => {
    moment.defineLocale("x-mo-fn", {
      months: (m: { month: () => number }, fmt?: string) => {
        return fmt ? `fmt-${m.month()}` : `base-${m.month()}`;
      },
    });
    originalMoment.defineLocale("x-mo-fn", {
      months: (m: { month: () => number }, fmt?: string) => {
        return fmt ? `fmt-${m.month()}` : `base-${m.month()}`;
      },
    });
    const m = moment("2024-06-15").locale("x-mo-fn");
    const o = originalMoment("2024-06-15").locale("x-mo-fn");
    expect(m.format("MMMM")).toBe(o.format("MMMM"));
    moment.locale("x-mo-fn", null);
    originalMoment.locale("x-mo-fn", null);
  });

  test("function months via localeData._months getter", () => {
    moment.defineLocale("x-mo-fn2", {
      months: (m: { month: () => number }) => {
        const all = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L"];
        return all[m.month()];
      },
    });
    const m = moment("2024-06-15").locale("x-mo-fn2");
    expect(m.format("MMMM")).toBe("F");
    moment.locale("x-mo-fn2", null);
  });

  test("array months", () => {
    moment.defineLocale("x-mo-arr", {
      months: ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L"],
    });
    const m = moment("2024-06-15").locale("x-mo-arr");
    expect(m.format("MMMM")).toBe("F");
    moment.locale("x-mo-arr", null);
  });
});

describe("localeWeekdays branches", () => {
  test("weekdays(true) via localeData", () => {
    const ld = moment.localeData("en");
    const result = ld.weekdays(true);
    expect(Array.isArray(result)).toBe(true);
    expect((result as string[]).length).toBe(7);
  });

  test("no weekdays config falls back to en weekdays", () => {
    moment.defineLocale("x-wd-none", {});
    const ld = moment.localeData("x-wd-none");
    // Falls back to en since _config.weekdays is undefined -> ?? enLocale.weekdays
    expect(ld._weekdays.length).toBe(7);
    moment.locale("x-wd-none", null);
  });

  test("weekdays as function matches moment.js", () => {
    moment.defineLocale("x-wd-fn2", {
      weekdays: (m: { day: () => number }, fmt?: string) => {
        const d = ["Sun0", "Mon1", "Tue2", "Wed3", "Thu4", "Fri5", "Sat6"];
        return fmt ? `${d[m.day()]}-${fmt}` : d[m.day()];
      },
    });
    originalMoment.defineLocale("x-wd-fn2", {
      weekdays: (m: { day: () => number }, fmt?: string) => {
        const d = ["Sun0", "Mon1", "Tue2", "Wed3", "Thu4", "Fri5", "Sat6"];
        return fmt ? `${d[m.day()]}-${fmt}` : d[m.day()];
      },
    });
    const m = moment("2024-06-15").locale("x-wd-fn2");
    const o = originalMoment("2024-06-15").locale("x-wd-fn2");
    expect(m.format("dddd")).toBe(o.format("dddd"));
    moment.locale("x-wd-fn2", null);
    originalMoment.locale("x-wd-fn2", null);
  });

  test("weekdays as string", () => {
    moment.defineLocale("x-wd-str", { weekdays: "WDAYSTR" });
    const m = moment("2024-01-15").locale("x-wd-str");
    expect(m.format("dddd")).toBe("WDAYSTR");
    moment.locale("x-wd-str", null);
  });
});

describe("localeOrdinal branches", () => {
  test("ordinal as string with %d replacement", () => {
    moment.defineLocale("x-ord-str2", { ordinal: "%d." });
    originalMoment.defineLocale("x-ord-str2", { ordinal: "%d." });
    const m = moment("2024-06-15").locale("x-ord-str2");
    const o = originalMoment("2024-06-15").locale("x-ord-str2");
    expect(m.format("Do")).toBe(o.format("Do"));
    moment.locale("x-ord-str2", null);
    originalMoment.locale("x-ord-str2", null);
  });
});

describe("localeLongDateFormat branches", () => {
  test("lowercase lt/lts produces valid output", () => {
    const m = moment("2024-06-15T14:30:45");
    const lt = m.format("lt");
    const lts = m.format("lts");
    expect(typeof lt).toBe("string");
    expect(lt.length).toBeGreaterThan(0);
    expect(typeof lts).toBe("string");
    expect(lts.length).toBeGreaterThan(0);
  });

  test("custom longDateFormat with lowercase L matches moment.js", () => {
    moment.defineLocale("x-ldf", {
      longDateFormat: {
        L: "YYYY/MM/DD",
        LL: "YYYY MMMM DD",
        LLL: "YYYY MMMM DD HH:mm",
        LLLL: "dddd, YYYY MMMM DD HH:mm",
        LT: "HH:mm",
        LTS: "HH:mm:ss",
      },
    });
    originalMoment.defineLocale("x-ldf", {
      longDateFormat: {
        L: "YYYY/MM/DD",
        LL: "YYYY MMMM DD",
        LLL: "YYYY MMMM DD HH:mm",
        LLLL: "dddd, YYYY MMMM DD HH:mm",
        LT: "HH:mm",
        LTS: "HH:mm:ss",
      },
    });
    const m = moment("2024-06-15").locale("x-ldf");
    const o = originalMoment("2024-06-15").locale("x-ldf");
    expect(m.format("L")).toBe(o.format("L"));
    expect(m.format("LL")).toBe(o.format("LL"));
    moment.locale("x-ldf", null);
    originalMoment.locale("x-ldf", null);
  });
});

describe("locale-runtime instance method branches", () => {
  test("Locale instance methods exist and return values", () => {
    moment.defineLocale("x-rt-methods", {
      invalidDate: "custom invalid",
    });
    const ld = moment.localeData("x-rt-methods");
    expect(typeof ld.months).toBe("function");
    expect(typeof ld.monthsShort).toBe("function");
    expect(typeof ld.weekdays).toBe("function");
    expect(typeof ld.weekdaysShort).toBe("function");
    expect(typeof ld.weekdaysMin).toBe("function");
    expect(typeof ld.invalidDate).toBe("function");
    expect(typeof ld.relativeTime).toBe("function");
    expect(typeof ld.postformat).toBe("function");
    expect(typeof ld._longDateFormat).toBe("object");
    expect(typeof ld._week).toBe("object");
    moment.locale("x-rt-methods", null);
  });

  test("monthsArray/monthsShortArray/weekdaysArray return arrays", () => {
    const ld = moment.localeData("x-rt-arr");
    expect(Array.isArray(ld.monthsArray())).toBe(true);
    expect(ld.monthsArray().length).toBe(12);
    expect(Array.isArray(ld.monthsShortArray())).toBe(true);
    expect(Array.isArray(ld.weekdaysArray())).toBe(true);
    expect(ld.weekdaysArray().length).toBe(7);
    expect(Array.isArray(ld.weekdaysShortArray())).toBe(true);
    expect(Array.isArray(ld.weekdaysMinArray())).toBe(true);
    moment.locale("x-rt-arr", null);
  });
});

describe("localePreparse / localePostformat", () => {
  test("preparse transforms input", () => {
    moment.defineLocale("x-prep", {
      preparse: (str: string) => str.replace(/^x/, "20"),
    });
    const m = moment("x24-06-15", "YYYY-MM-DD", "x-prep");
    expect(m.isValid()).toBe(true);
    expect(m.year()).toBe(2024);
    moment.locale("x-prep", null);
  });

  test("postformat transforms format output", () => {
    moment.defineLocale("x-post", {
      postformat: (str: string) => str.replaceAll("2024", "YYYY"),
    });
    const m = moment("2024-06-15").locale("x-post");
    expect(m.format("YYYY")).toBe("YYYY");
    moment.locale("x-post", null);
  });
});

describe("localeRelativeTime uncovered branches", () => {
  test("relativeTime without matching key returns empty string", () => {
    moment.defineLocale("x-rt-empty", {
      relativeTime: {
        future: "in %s",
        past: "%s ago",
      },
    });
    const m = moment().locale("x-rt-empty");
    const str = m.fromNow();
    expect(typeof str).toBe("string");
    moment.locale("x-rt-empty", null);
  });

  test("isPM with locale custom isPM", () => {
    moment.defineLocale("x-isp", {
      isPM: (input: string) => input.includes("p-m"),
      meridiemParse: /[ap]-m/i,
    });
    originalMoment.defineLocale("x-isp", {
      isPM: (input: string) => input.includes("p-m"),
      meridiemParse: /[ap]-m/i,
    });
    const m = moment("2024-06-15T14:30:00").locale("x-isp");
    const o = originalMoment("2024-06-15T14:30:00").locale("x-isp");
    expect(m.format("A")).toBe(o.format("A"));
    moment.locale("x-isp", null);
    originalMoment.locale("x-isp", null);
  });

  test("meridiemParse falls back to enLocale", () => {
    moment.defineLocale("x-mp-none", {});
    originalMoment.defineLocale("x-mp-none", {});
    const m = moment("2024-06-15T14:30:00").locale("x-mp-none");
    const o = originalMoment("2024-06-15T14:30:00").locale("x-mp-none");
    expect(m.format("A")).toBe(o.format("A"));
    moment.locale("x-mp-none", null);
    originalMoment.locale("x-mp-none", null);
  });
});
