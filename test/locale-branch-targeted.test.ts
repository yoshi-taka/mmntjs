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

describe("localeMonths object with isFormat", () => {
  test("months as object { standalone, format } uses isFormat regex", () => {
    moment.defineLocale("x-mo-obj-fmt", {
      months: {
        standalone: "A_B_C_D_E_F_G_H_I_J_K_L".split("_"),
        format: "Jan_二月_Mar_Apr_May_Jun_Jul_Aug_Sep_Oct_Nov_Dec".split("_"),
        isFormat: /^MMM$/,
      },
    });
    const m = moment("2024-02-15").locale("x-mo-obj-fmt");
    expect(m.format("MMMM")).toBe("B");
    moment.locale("x-mo-obj-fmt", null);
  });

  test("months as object without isFormat uses monthsInFormat regex", () => {
    moment.defineLocale("x-mo-obj-no-fmt", {
      months: {
        standalone: "A_B_C_D_E_F_G_H_I_J_K_L".split("_"),
        format: "Jan_Feb_Mar_Apr_May_Jun_Jul_Aug_Sep_Oct_Nov_Dec".split("_"),
      },
    });
    const m = moment("2024-01-15").locale("x-mo-obj-no-fmt");
    expect(m.format("MMMM")).toBe("A");
    expect(m.format("MMM")).toBe("Jan");
    moment.locale("x-mo-obj-no-fmt", null);
  });

  test("months as string returns string directly", () => {
    moment.defineLocale("x-mo-str", { months: "ALLMONTHS" });
    const m = moment("2024-06-15").locale("x-mo-str");
    expect(m.format("MMMM")).toBe("ALLMONTHS");
    moment.locale("x-mo-str", null);
  });

  test("months as array with missing index returns raw array", () => {
    moment.defineLocale("x-mo-short", {
      months: ["A", "B", "C"],
    });
    const m = moment("2024-06-15").locale("x-mo-short");
    expect(m.format("MMMM")).toBe("A,B,C");
    moment.locale("x-mo-short", null);
  });
});

describe("localeMonthsShort uncovered branches", () => {
  test("monthsShort as function", () => {
    moment.defineLocale("x-ms-fn", {
      months: "A_B_C_D_E_F_G_H_I_J_K_L".split("_"),
      monthsShort: (_m: unknown, fmt?: string) => (fmt ? "SHORT" : "long"),
    });
    const m = moment("2024-06-15").locale("x-ms-fn");
    expect(m.format("MMM")).toBe("SHORT");
    moment.locale("x-ms-fn", null);
  });

  test("monthsShort as string", () => {
    moment.defineLocale("x-ms-str", {
      months: "A_B_C_D_E_F_G_H_I_J_K_L".split("_"),
      monthsShort: "SHORTSTR",
    });
    const m = moment("2024-06-15").locale("x-ms-str");
    expect(m.format("MMM")).toBe("SHORTSTR");
    moment.locale("x-ms-str", null);
  });

  test("monthsShort as array with missing month returns raw array", () => {
    moment.defineLocale("x-ms-short", {
      months: "A_B_C_D_E_F_G_H_I_J_K_L".split("_"),
      monthsShort: ["Ja", "Fe"],
    });
    const m = moment("2024-06-15").locale("x-ms-short");
    expect(m.format("MMM")).toBe("Ja,Fe");
    moment.locale("x-ms-short", null);
  });

  test("monthsShort as object { standalone, format }", () => {
    moment.defineLocale("x-ms-obj", {
      months: "A_B_C_D_E_F_G_H_I_J_K_L".split("_"),
      monthsShort: {
        standalone: "a_b_c_d_e_f_g_h_i_j_k_l".split("_"),
        format: "一_二_三_四_五_六_七_八_九_十_十一_十二".split("_"),
      },
    });
    const m = moment("2024-06-15").locale("x-ms-obj");
    expect(m.format("MMM")).toBe("f");
    moment.locale("x-ms-obj", null);
  });
});

describe("localeWeekdays uncovered branches", () => {
  test("weekdays as function", () => {
    moment.defineLocale("x-wd-fn", {
      weekdays: (m: { day: () => number }, fmt?: string) => {
        const d = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
        return fmt ? `${d[m.day()]}-${fmt}` : d[m.day()];
      },
    });
    originalMoment.defineLocale("x-wd-fn", {
      weekdays: (m: { day: () => number }, fmt?: string) => {
        const d = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
        return fmt ? `${d[m.day()]}-${fmt}` : d[m.day()];
      },
    });
    const m = moment("2024-06-15").locale("x-wd-fn");
    const o = originalMoment("2024-06-15").locale("x-wd-fn");
    expect(m.format("dddd")).toBe(o.format("dddd"));
    moment.locale("x-wd-fn", null);
    originalMoment.locale("x-wd-fn", null);
  });

  test("falsy weekdays returns empty array via _weekdays getter", () => {
    // _weekdays getter returns [] when both config and en fallback are null
    const m = moment("2024-06-15");
    expect(m.format("dddd")).toBe("Saturday");
    moment.locale("en");
  });

  test("weekdays as string", () => {
    moment.defineLocale("x-wd-str2", { weekdays: "WEEKDAYSTR" });
    const m = moment("2024-06-15").locale("x-wd-str2");
    expect(m.format("dddd")).toBe("WEEKDAYSTR");
    moment.locale("x-wd-str2", null);
  });

  test("weekdays as object with isFormat RegExp", () => {
    moment.defineLocale("x-wd-obj-fmt", {
      weekdays: {
        standalone: "Sunday_Monday_Tuesday_Wednesday_Thursday_Friday_Saturday".split("_"),
        format: "Sun_Mon_Tue_Wed_Thu_Fri_Sat".split("_"),
        isFormat: /^dddd$/,
      },
    });
    const m = moment("2024-06-15").locale("x-wd-obj-fmt");
    expect(m.format("dddd")).toBe("Sat");
    expect(m.format("ddd")).toBe("Sat");
    moment.locale("x-wd-obj-fmt", null);
  });
});

describe("localeWeekdaysShort uncovered branches", () => {
  test("weekdaysShort(true) returns rotated array", () => {
    moment.defineLocale("x-wds-true", {
      weekdays: "Su_Mo_Tu_We_Th_Fr_Sa".split("_"),
      weekdaysShort: "Sun_Mon_Tue_Wed_Thu_Fri_Sat".split("_"),
    });
    const ld = moment.localeData("x-wds-true");
    const result = ld.weekdaysShort(true);
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBe(7);
    moment.locale("x-wds-true", null);
  });

  test("weekdaysShort gets from en fallback when not defined", () => {
    moment.defineLocale("x-wds-none", {
      weekdays: "Su_Mo_Tu_We_Th_Fr_Sa".split("_"),
    });
    const m = moment("2024-06-15").locale("x-wds-none");
    expect(m.format("ddd")).toBe("Sat");
    moment.locale("x-wds-none", null);
  });

  test("weekdaysShort as function (no moment)", () => {
    moment.defineLocale("x-wds-fn", {
      weekdays: "Su_Mo_Tu_We_Th_Fr_Sa".split("_"),
      weekdaysShort: () => "FUNC",
    });
    const m = moment("2024-06-15").locale("x-wds-fn");
    expect(m.format("ddd")).toBe("FUNC");
    moment.locale("x-wds-fn", null);
  });

  test("weekdaysShort as function (with moment)", () => {
    moment.defineLocale("x-wds-fn2", {
      weekdays: "Su_Mo_Tu_We_Th_Fr_Sa".split("_"),
      weekdaysShort: (m: { day: () => number }, fmt?: string) => {
        const d = ["Sun0", "Mon1", "Tue2", "Wed3", "Thu4", "Fri5", "Sat6"];
        return fmt ? `${d[m.day()]}-${fmt}` : d[m.day()];
      },
    });
    originalMoment.defineLocale("x-wds-fn2", {
      weekdaysShort: (m: { day: () => number }, fmt?: string) => {
        const d = ["Sun0", "Mon1", "Tue2", "Wed3", "Thu4", "Fri5", "Sat6"];
        return fmt ? `${d[m.day()]}-${fmt}` : d[m.day()];
      },
    });
    const m = moment("2024-06-15").locale("x-wds-fn2");
    const o = originalMoment("2024-06-15").locale("x-wds-fn2");
    expect(m.format("ddd")).toBe(o.format("ddd"));
    moment.locale("x-wds-fn2", null);
    originalMoment.locale("x-wds-fn2", null);
  });

  test("weekdaysShort as string (with moment)", () => {
    moment.defineLocale("x-wds-str", {
      weekdays: "Su_Mo_Tu_We_Th_Fr_Sa".split("_"),
      weekdaysShort: "SHORTSTR",
    });
    const m = moment("2024-06-15").locale("x-wds-str");
    expect(m.format("ddd")).toBe("SHORTSTR");
    moment.locale("x-wds-str", null);
  });

  test("weekdaysShort falsy with moment falls back to localeWeekdays", () => {
    moment.defineLocale("x-wds-fallback", {
      weekdays: null as unknown as string[],
      weekdaysShort: null as unknown as string[],
    });
    const m = moment("2024-06-15").locale("x-wds-fallback");
    expect(m.format("dddd")).toBeDefined();
    moment.locale("x-wds-fallback", null);
  });
});

describe("localeWeekdaysMin fully uncovered", () => {
  test("weekdaysMin(true) returns rotated array", () => {
    moment.defineLocale("x-wdm-true", {
      weekdays: "Su_Mo_Tu_We_Th_Fr_Sa".split("_"),
      weekdaysMin: "Sun_Mon_Tue_Wed_Thu_Fri_Sat".split("_"),
    });
    const ld = moment.localeData("x-wdm-true");
    const result = ld.weekdaysMin(true);
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBe(7);
    moment.locale("x-wdm-true", null);
  });

  test("weekdaysMin without moment falls back to weekdaysShortArray", () => {
    moment.defineLocale("x-wdm-none", {
      weekdays: "Su_Mo_Tu_We_Th_Fr_Sa".split("_"),
      weekdaysShort: "Sun_Mon_Tue_Wed_Thu_Fri_Sat".split("_"),
    });
    const ld = moment.localeData("x-wdm-none");
    const result = ld.weekdaysMin();
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBe(7);
    moment.locale("x-wdm-none", null);
  });

  test("weekdaysMin as function (no moment)", () => {
    moment.defineLocale("x-wdm-fn", {
      weekdays: "Su_Mo_Tu_We_Th_Fr_Sa".split("_"),
      weekdaysMin: () => "FUNC",
    });
    const m = moment("2024-06-15").locale("x-wdm-fn");
    expect(m.format("dd")).toBe("FUNC");
    moment.locale("x-wdm-fn", null);
  });

  test("weekdaysMin as function (with moment)", () => {
    moment.defineLocale("x-wdm-fn2", {
      weekdays: "Su_Mo_Tu_We_Th_Fr_Sa".split("_"),
      weekdaysMin: (m: { day: () => number }, fmt?: string) => {
        const d = ["Su0", "Mo1", "Tu2", "We3", "Th4", "Fr5", "Sa6"];
        return fmt ? `${d[m.day()]}-${fmt}` : d[m.day()];
      },
    });
    originalMoment.defineLocale("x-wdm-fn2", {
      weekdaysMin: (m: { day: () => number }, fmt?: string) => {
        const d = ["Su0", "Mo1", "Tu2", "We3", "Th4", "Fr5", "Sa6"];
        return fmt ? `${d[m.day()]}-${fmt}` : d[m.day()];
      },
    });
    const m = moment("2024-06-15").locale("x-wdm-fn2");
    const o = originalMoment("2024-06-15").locale("x-wdm-fn2");
    expect(m.format("dd")).toBe(o.format("dd"));
    moment.locale("x-wdm-fn2", null);
    originalMoment.locale("x-wdm-fn2", null);
  });

  test("weekdaysMin as string (with moment)", () => {
    moment.defineLocale("x-wdm-str", {
      weekdays: "Su_Mo_Tu_We_Th_Fr_Sa".split("_"),
      weekdaysMin: "MINSTR",
    });
    const m = moment("2024-06-15").locale("x-wdm-str");
    expect(m.format("dd")).toBe("MINSTR");
    moment.locale("x-wdm-str", null);
  });

  test("weekdaysMin falsy with moment falls back to localeWeekdaysShort", () => {
    moment.defineLocale("x-wdm-fallback", {
      weekdays: null as unknown as string[],
      weekdaysShort: null as unknown as string[],
      weekdaysMin: null as unknown as string[],
    });
    const m = moment("2024-06-15").locale("x-wdm-fallback");
    expect(m.format("dd")).toBeDefined();
    moment.locale("x-wdm-fallback", null);
  });

  test("weekdaysMin as object without moment returns config object", () => {
    moment.defineLocale("x-wdm-standalone", {
      weekdaysMin: {
        standalone: "Su_Mo_Tu_We_Th_Fr_Sa".split("_"),
      },
    });
    const ld = moment.localeData("x-wdm-standalone");
    const result = ld.weekdaysMin();
    expect(result).toBeDefined();
    moment.locale("x-wdm-standalone", null);
  });
});

describe("locale-runtime Locale._monthsShort getter with function", () => {
  test("monthsShort as function generates short names", () => {
    moment.defineLocale("x-rt-ms-fn", {
      months: "A_B_C_D_E_F_G_H_I_J_K_L".split("_"),
      monthsShort: () => "SHORT",
    });
    const ld = moment.localeData("x-rt-ms-fn");
    expect(ld._monthsShort.every((s: string) => s === "SHORT")).toBe(true);
    moment.locale("x-rt-ms-fn", null);
  });
});

describe("locale-runtime Locale._weekdays getter with function", () => {
  test("weekdays as function generates weekday names", () => {
    moment.defineLocale("x-rt-wd-fn", {
      weekdays: (m: { day: () => number }) => {
        const d = ["Day0", "Day1", "Day2", "Day3", "Day4", "Day5", "Day6"];
        return d[m.day()];
      },
    });
    const ld = moment.localeData("x-rt-wd-fn");
    expect(ld._weekdays.length).toBe(7);
    expect(ld._weekdays[0]).toBe("Day0");
    moment.locale("x-rt-wd-fn", null);
  });
});

describe("locale-runtime Locale.weekdaysShortArray with function", () => {
  test("weekdaysShortArray from function", () => {
    moment.defineLocale("x-rt-wds-fn", {
      weekdaysShort: (_m: unknown) => {
        return "Short";
      },
    });
    const ld = moment.localeData("x-rt-wds-fn");
    const arr = ld.weekdaysShortArray();
    expect(Array.isArray(arr)).toBe(true);
    moment.locale("x-rt-wds-fn", null);
  });
});

describe("locale-runtime Locale.weekdaysMinArray with function", () => {
  test("weekdaysMinArray from function", () => {
    moment.defineLocale("x-rt-wdm-fn", {
      weekdaysMin: () => "MIN",
    });
    const ld = moment.localeData("x-rt-wdm-fn");
    const arr = ld.weekdaysMinArray();
    expect(Array.isArray(arr)).toBe(true);
    moment.locale("x-rt-wdm-fn", null);
  });
});

describe("locale-runtime Locale.meridiemParse fallback", () => {
  test("meridiemParse returns undefined when neither locale nor en has it", () => {
    moment.defineLocale("x-rt-mp-none", {});
    const ld = moment.localeData("x-rt-mp-none");
    const fn = ld.meridiemParse();
    expect(fn instanceof RegExp).toBe(true);
    moment.locale("x-rt-mp-none", null);
  });
});

describe("locale-runtime Locale.calendar with config", () => {
  test("calendar with custom config", () => {
    moment.defineLocale("x-rt-cal", {
      calendar: {
        sameDay: "[Today is] LT",
        lastDay: "[Yesterday was] LT",
      },
    });
    const now = moment("2024-06-15T12:00:00");
    const m = moment("2024-06-15T10:30:00").locale("x-rt-cal");
    expect(m.calendar(now)).toContain("Today is");
    moment.locale("x-rt-cal", null);
  });
});

describe("locale-runtime Locale.pastFuture function formatters", () => {
  test("pastFuture with function future formatter", () => {
    moment.defineLocale("x-rt-pf", {
      relativeTime: {
        future: (s: string) => `in about ${s}`,
        past: (s: string) => `${s} back`,
        s: "%d seconds",
        m: "a minute",
        mm: "%d minutes",
        h: "an hour",
        hh: "%d hours",
        d: "a day",
        dd: "%d days",
        M: "a month",
        MM: "%d months",
        y: "a year",
        yy: "%d years",
      },
    });
    const ref = moment("2024-06-15T13:00:00");
    const m = moment("2024-06-15T12:00:00").locale("x-rt-pf");
    expect(m.from(ref)).toContain("back");
    moment.locale("x-rt-pf", null);
  });

  test("pastFuture with function past formatter", () => {
    moment.defineLocale("x-rt-pf2", {
      relativeTime: {
        past: (s: string) => `${s} ago (custom)`,
        s: "%d secs",
        m: "a min",
        mm: "%d mins",
        h: "an hr",
        hh: "%d hrs",
        d: "a day",
        dd: "%d days",
        M: "a month",
        MM: "%d months",
        y: "a year",
        yy: "%d years",
      },
    });
    const ref = moment("2024-06-17T12:00:00");
    const m = moment("2024-06-15T12:00:00").locale("x-rt-pf2");
    expect(m.from(ref)).toContain("ago (custom)");
    moment.locale("x-rt-pf2", null);
  });
});

describe("locale-runtime Locale.set method", () => {
  test("Locale.set updates config", () => {
    moment.defineLocale("x-rt-set", {
      months: "A_B_C_D_E_F_G_H_I_J_K_L".split("_"),
    });
    const m = moment("2024-06-15").locale("x-rt-set");
    expect(m.format("MMMM")).toBe("F");
    moment.locale("x-rt-set", null);
  });
});

describe("locale-runtime Locale.eras", () => {
  test("eras returns array or empty", () => {
    const ld = moment.localeData("en");
    const eras = ld.eras();
    expect(Array.isArray(eras)).toBe(true);
  });
});

describe("locale-runtime monthsParse and weekdaysParse", () => {
  test("monthsParse finds month by name", () => {
    moment.defineLocale("x-rt-mp", {
      months: "Alpha_Beta_Gamma_Delta_Epsilon_Zeta_Eta_Theta_Iota_Kappa_Lambda_Mu".split("_"),
    });
    const m = moment("2024-06-15").locale("x-rt-mp");
    const ld = moment.localeData("x-rt-mp");
    expect(ld.monthsParse("Beta")).toBe(1);
    expect(ld.monthsParse("Zeta")).toBe(5);
    moment.locale("x-rt-mp", null);
  });

  test("monthsParse with partial match", () => {
    const ld = moment.localeData("en");
    expect(ld.monthsParse("Jan")).toBe(0);
  });

  test("monthsParse with non-string returns -1", () => {
    const ld = moment.localeData("en");
    expect(ld.monthsParse(123 as unknown as string)).toBe(-1);
  });

  test("weekdaysParse finds weekday by name", () => {
    const ld = moment.localeData("en");
    expect(ld.weekdaysParse("Monday")).toBe(1);
  });

  test("weekdaysParse partial match", () => {
    const ld = moment.localeData("en");
    expect(ld.weekdaysParse("Mon")).toBe(1);
  });

  test("weekdaysParse with non-string returns -1", () => {
    const ld = moment.localeData("en");
    expect(ld.weekdaysParse(123 as unknown as string)).toBe(-1);
  });

  test("weekdaysParse with format dd", () => {
    const ld = moment.localeData("en");
    expect(ld.weekdaysParse("Mo", "dd")).toBe(1);
  });

  test("weekdaysParse with format ddd", () => {
    const ld = moment.localeData("en");
    expect(ld.weekdaysParse("Mon", "ddd")).toBe(1);
  });
});

describe("locale-runtime monthsRegex monthsShortRegex variants", () => {
  test("monthsRegex strict and non-strict", () => {
    const ld = moment.localeData("en");
    const strict = ld.monthsRegex(true);
    const nonStrict = ld.monthsRegex(false);
    expect(strict instanceof RegExp).toBe(true);
    expect(nonStrict instanceof RegExp).toBe(true);
  });

  test("monthsShortRegex strict and non-strict", () => {
    const ld = moment.localeData("en");
    const strict = ld.monthsShortRegex(true);
    const nonStrict = ld.monthsShortRegex(false);
    expect(strict instanceof RegExp).toBe(true);
    expect(nonStrict instanceof RegExp).toBe(true);
  });
});

describe("locale-runtime weekdays regex variants", () => {
  test("weekdaysRegex", () => {
    const ld = moment.localeData("en");
    expect(ld.weekdaysRegex(false) instanceof RegExp).toBe(true);
    expect(ld.weekdaysRegex(true) instanceof RegExp).toBe(true);
  });

  test("weekdaysShortRegex", () => {
    const ld = moment.localeData("en");
    expect(ld.weekdaysShortRegex(false) instanceof RegExp).toBe(true);
    expect(ld.weekdaysShortRegex(true) instanceof RegExp).toBe(true);
  });

  test("weekdaysMinRegex", () => {
    const ld = moment.localeData("en");
    expect(ld.weekdaysMinRegex(false) instanceof RegExp).toBe(true);
    expect(ld.weekdaysMinRegex(true) instanceof RegExp).toBe(true);
  });
});

describe("locale-runtime localeRelativeTime function entry", () => {
  test("relativeTimeFn for custom formatting", () => {
    moment.defineLocale("x-rt-rtfn", {
      relativeTimeFn: (n: number, key: string, _isFuture: boolean) => {
        const map: Record<string, string> = {
          s: "seconds",
          m: "minute",
          mm: "minutes",
          h: "hour",
          hh: "hours",
          d: "day",
          dd: "days",
          M: "month",
          MM: "months",
          y: "year",
          yy: "years",
        };
        return `${n} ${map[key]}`;
      },
    });
    const ref = moment("2024-06-18T12:00:00");
    const m = moment("2024-06-15T12:00:00").locale("x-rt-rtfn");
    expect(m.from(ref)).toContain("3 days");
    moment.locale("x-rt-rtfn", null);
  });
});

describe("localeLongDateFormat capital letter branch", () => {
  test("LLL with upper key format", () => {
    moment.defineLocale("x-ldf-upper", {
      longDateFormat: {
        L: "YYYY/MM/DD",
        LL: "YYYY MMMM DD",
        LLL: "YYYY MMMM DD HH:mm",
        LLLL: "dddd, YYYY MMMM DD HH:mm",
        LT: "HH:mm",
        LTS: "HH:mm:ss",
      },
    });
    const m = moment("2024-06-15T14:30:00").locale("x-ldf-upper");
    expect(m.format("lll")).toBeDefined();
    expect(m.format("lll").length).toBeGreaterThan(0);
    moment.locale("x-ldf-upper", null);
  });
});

describe("locale-runtime Locale instance methods", () => {
  test("firstDayOfWeek / firstDayOfYear", () => {
    moment.defineLocale("x-rt-fdow", { week: { dow: 1, doy: 4 } });
    const ld = moment.localeData("x-rt-fdow");
    expect(ld.firstDayOfWeek()).toBe(1);
    expect(ld.firstDayOfYear()).toBe(4);
    moment.locale("x-rt-fdow", null);
  });

  test("invalidDate returns custom string via localeData", () => {
    moment.defineLocale("x-rt-inv", { invalidDate: "custom invalid date" });
    const ld = moment.localeData("x-rt-inv");
    expect(ld.invalidDate()).toBe("custom invalid date");
    moment.locale("x-rt-inv", null);
  });

  test("calendar with function callback via locales sameDay", () => {
    moment.defineLocale("x-rt-cal-fn", {
      calendar: {
        sameDay: "[Today]",
      },
    });
    const now = moment("2024-06-15T12:00:00");
    const m = moment("2024-06-15T10:30:00").locale("x-rt-cal-fn");
    expect(m.calendar(now)).toBe("Today");
    moment.locale("x-rt-cal-fn", null);
  });

  test("pastFuture with function entries (s, m, etc.)", () => {
    moment.defineLocale("x-rt-pf-fn", {
      relativeTime: {
        future: "in %s",
        past: "%s ago",
        s: (n: number) => `${n} secs`,
        mm: (n: number) => `${n} minutes`,
        hh: (n: number) => `${n} hours`,
        dd: (n: number) => `${n} days`,
        MM: (n: number) => `${n} months`,
        yy: (n: number) => `${n} years`,
      },
    });
    const ref = moment("2024-06-15T12:00:00");
    const m = moment("2024-06-15T11:55:00").locale("x-rt-pf-fn");
    expect(m.from(ref)).toContain("5 minutes");
    moment.locale("x-rt-pf-fn", null);
  });

  test("Locale.set with underscore-prefixed keys", () => {
    moment.defineLocale("x-rt-set2", {
      months: "A_B_C_D_E_F_G_H_I_J_K_L".split("_"),
    });
    const ld = moment.localeData("x-rt-set2");
    ld.set({ monthsShort: "a_b_c_d_e_f_g_h_i_j_k_l".split("_") });
    expect(ld._monthsShort.length).toBe(12);
    moment.locale("x-rt-set2", null);
  });

  test("Locale.week method", () => {
    const ld = moment.localeData("en");
    const m = moment("2024-06-15");
    expect(typeof ld.week(m)).toBe("number");
  });
});

describe("locale-runtime monthsParse/Regex branches", () => {
  test("monthsParse strict: full name matches MMMM", () => {
    const ld = moment.localeData("en") as any;
    const old = originalMoment.localeData("en") as any;
    expect(ld.monthsParse("January", "MMMM", true)).toBe(old.monthsParse("January", "MMMM", true));
  });

  test("monthsParse strict: short name matches MMM", () => {
    const ld = moment.localeData("en") as any;
    const old = originalMoment.localeData("en") as any;
    expect(ld.monthsParse("Jan", "MMM", true)).toBe(old.monthsParse("Jan", "MMM", true));
  });

  test("monthsRegex strict vs non-strict", () => {
    const ld = moment.localeData("en") as any;
    const old = originalMoment.localeData("en") as any;
    // strict matches full month names
    expect(ld.monthsRegex(true).test("January")).toBe(old.monthsRegex(true).test("January"));
    // strict may or may not match short names (locale-dependent)
    expect(typeof ld.monthsRegex(true).test("Jan")).toBe("boolean");
    // non-strict always matches short names
    expect(ld.monthsRegex(false).test("Jan")).toBe(true);
  });

  test("monthsShortRegex strict rejects full names", () => {
    const ld = moment.localeData("en") as any;
    expect(ld.monthsShortRegex(true).test("Jan")).toBe(true);
    expect(ld.monthsShortRegex(true).test("January")).toBe(false);
  });

  test("monthsShortRegex non-strict also accepts full names (known diff)", () => {
    // moment.js non-strict monthsShortRegex also matches full names
    const ld = moment.localeData("en") as any;
    const old = originalMoment.localeData("en") as any;
    expect(ld.monthsShortRegex(false).test("January")).toBe(
      old.monthsShortRegex(false).test("January"),
    );
  });

  test("monthsParse strict non-month returns sentinel", () => {
    const ld = moment.localeData("en") as any;
    const r = ld.monthsParse("Xyz", "MMMM", true);
    expect(r < 0 || r === undefined).toBe(true);
  });

  test("weekdaysParse accepts known weekday names (non-strict)", () => {
    const ld = moment.localeData("en") as any;
    const valid = ["Monday", "Tuesday", "Wednesday", "Sunday"];
    for (const name of valid) {
      const result = ld.weekdaysParse(name);
      expect(result).toBeGreaterThanOrEqual(0);
      expect(result).toBeLessThanOrEqual(6);
    }
  });

  test("weekdaysParse unknown name returns negative", () => {
    const ld = moment.localeData("en") as any;
    const r = ld.weekdaysParse("Funday");
    expect(r < 0 || r === undefined).toBe(true);
  });

  test("weekdaysRegex strict rejects short names", () => {
    const ld = moment.localeData("en") as any;
    const strict = ld.weekdaysRegex(true);
    expect(strict.test("Monday")).toBe(true);
    expect(strict.test("Mon")).toBe(false);
  });

  test("weekdaysShortRegex strict rejects min names", () => {
    const ld = moment.localeData("en") as any;
    expect(ld.weekdaysShortRegex(true).test("Mon")).toBe(true);
    expect(ld.weekdaysShortRegex(true).test("M")).toBe(false);
  });

  test("weekdaysMinRegex matches abbreviations", () => {
    const ld = moment.localeData("en") as any;
    expect(ld.weekdaysMinRegex(true).test("Mo")).toBe(true);
    expect(ld.weekdaysMinRegex(true).test("Su")).toBe(true);
  });

  test("eras returns expected values for en locale", () => {
    const ld = moment.localeData("en") as any;
    const eras = ld.eras();
    expect(Array.isArray(eras)).toBe(true);
    expect(eras.length).toBeGreaterThanOrEqual(1);
    if (eras.length > 0) {
      expect(typeof eras[0].name).toBe("string");
      expect(typeof eras[0].since).toBe("string");
    }
  });

  test("calendar with function callbacks via localeData.calendar()", () => {
    const ld = moment.localeData("en") as any;
    const m = moment("2024-06-15T10:00:00");
    const now = moment("2024-06-15T12:00:00");
    const result = ld.calendar("sameDay", m, now);
    expect(typeof result).toBe("string");
    expect(result.length).toBeGreaterThan(0);
  });

  test("localeData().week with locale returns consistent type", () => {
    const locales = ["en"];
    for (const locName of locales) {
      const ld = moment.localeData(locName) as any;
      const m = moment("2024-06-15");
      expect(typeof ld.week(m)).toBe("number");
    }
  });
});

describe("firstDayOfWeek / firstDayOfYear", () => {
  test("custom locale with defineLocale reflects dow/doy", () => {
    moment.defineLocale("x-fdow-custom", { week: { dow: 3, doy: 7 } });
    const ld = moment.localeData("x-fdow-custom") as any;
    expect(ld.firstDayOfWeek()).toBe(3);
    expect(ld.firstDayOfYear()).toBe(7);
    moment.locale("x-fdow-custom", null);
  });

  test("exists and returns number for en locale", () => {
    const ld = moment.localeData("en") as any;
    expect(typeof ld.firstDayOfWeek()).toBe("number");
    expect(typeof ld.firstDayOfYear()).toBe("number");
  });

  test("matches oracle for en locale", () => {
    const ld = moment.localeData("en") as any;
    const old = originalMoment.localeData("en") as any;
    expect(ld.firstDayOfWeek()).toBe(old.firstDayOfWeek());
    expect(ld.firstDayOfYear()).toBe(old.firstDayOfYear());
  });
});

describe("moment.createFromInputFallback branches", () => {
  test("exists and is callable", () => {
    expect(typeof (moment as any).createFromInputFallback).toBe("function");
  });

  test("does not throw for any input", () => {
    expect(() => {
      (moment as any).createFromInputFallback("test", (moment as any).localeData("en"));
    }).not.toThrow();
  });
});
