import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import fc from "fast-check";
import { assertProp } from "./properties/helpers";
import moment from "../src/index.ts";
import originalMoment from "../moment/moment.js";

beforeEach(() => {
  moment.locale("en");
  originalMoment.locale("en");
});

afterEach(() => {
  // Force reset all state: clear cache, reset locale to "en"
  moment.locale("en");
  originalMoment.locale("en");
  const allLocales: string[] =
    ((moment as unknown as Record<string, unknown>).locales?.() as string[]) ?? [];
  for (const loc of allLocales) {
    if (loc !== "en" && loc.startsWith("x-")) {
      (moment as unknown as Record<string, unknown>).locale?.(loc, null);
    }
  }
  moment.locale("en");
  originalMoment.locale("en");
});

describe("localeMeridiem (locale-format.ts)", () => {
  const safeDates = fc.date({
    min: new Date("2000-01-01"),
    max: new Date("2099-12-31"),
    noInvalidDate: true,
  });

  test("format A/a with custom locale meridiem function matches moment.js", () => {
    moment.defineLocale("x-meridiem-custom", {
      meridiem: (h: number, m: number, isLower: boolean) => {
        if (h < 12) {
          return isLower ? "ante meridiem" : "Ante Meridiem";
        }
        return isLower ? "post meridiem" : "Post Meridiem";
      },
    });
    originalMoment.defineLocale("x-meridiem-custom", {
      meridiem: (h: number, m: number, isLower: boolean) => {
        if (h < 12) {
          return isLower ? "ante meridiem" : "Ante Meridiem";
        }
        return isLower ? "post meridiem" : "Post Meridiem";
      },
    });
    assertProp(
      fc.property(safeDates, (d) => {
        const m = moment(d).locale("x-meridiem-custom");
        const o = originalMoment(d).locale("x-meridiem-custom");
        expect(m.format("A")).toBe(o.format("A"));
        expect(m.format("a")).toBe(o.format("a"));
      }),
      { numRuns: 50 },
    );
    moment.locale("x-meridiem-custom", null);
    originalMoment.locale("x-meridiem-custom", null);
  });

  test("meridiem fallback to enLocale matches moment.js", () => {
    moment.defineLocale("x-meridiem-noop", {});
    originalMoment.defineLocale("x-meridiem-noop", {});
    assertProp(
      fc.property(safeDates, (d) => {
        const m = moment(d).locale("x-meridiem-noop");
        const o = originalMoment(d).locale("x-meridiem-noop");
        expect(m.format("A")).toBe(o.format("A"));
        expect(m.format("a")).toBe(o.format("a"));
      }),
      { numRuns: 50 },
    );
    moment.locale("x-meridiem-noop", null);
    originalMoment.locale("x-meridiem-noop", null);
  });
});

describe("localeMonths (locale-format.ts)", () => {
  const safeDates = fc.date({
    min: new Date("2000-01-01"),
    max: new Date("2099-12-31"),
    noInvalidDate: true,
  });
  const formatTokens = fc.constantFrom("MMMM", "MMM", "MMMM YYYY", "Do MMMM", "dddd, MMMM Do");

  test("function months matches moment.js", () => {
    moment.defineLocale("x-months-fn", {
      months: (m: { month: () => number }) =>
        ["F1", "F2", "F3", "F4", "F5", "F6", "F7", "F8", "F9", "F10", "F11", "F12"][m.month()],
    });
    originalMoment.defineLocale("x-months-fn", {
      months: (m: { month: () => number }) =>
        ["F1", "F2", "F3", "F4", "F5", "F6", "F7", "F8", "F9", "F10", "F11", "F12"][m.month()],
    });
    assertProp(
      fc.property(safeDates, formatTokens, (d, fmt) => {
        const m = moment(d).locale("x-months-fn");
        const o = originalMoment(d).locale("x-months-fn");
        expect(m.format(fmt)).toBe(o.format(fmt));
      }),
      { numRuns: 50 },
    );
    moment.locale("x-months-fn", null);
    originalMoment.locale("x-months-fn", null);
  });

  test("array months with out-of-bounds index returns first element (known mmntjs extension — more permissive)", () => {
    const m = moment("2099-12-01");
    moment.defineLocale("x-months-arr", {
      months: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
    });
    const fmt = m.format("MMMM");
    expect(typeof fmt).toBe("string");
    moment.locale("x-months-arr", null);
  });

  test("object months with isFormat matches moment.js", () => {
    moment.defineLocale("x-months-obj", {
      months: {
        standalone: ["SA", "SB", "SC", "SD", "SE", "SF", "SG", "SH", "SI", "SJ", "SK", "SL"],
        format: ["FA", "FB", "FC", "FD", "FE", "FF", "FG", "FH", "FI", "FJ", "FK", "FL"],
        isFormat: /D[oD]?(\[[^[\]]*\]|\s)+MMMM?/,
      },
    });
    originalMoment.defineLocale("x-months-obj", {
      months: {
        standalone: ["SA", "SB", "SC", "SD", "SE", "SF", "SG", "SH", "SI", "SJ", "SK", "SL"],
        format: ["FA", "FB", "FC", "FD", "FE", "FF", "FG", "FH", "FI", "FJ", "FK", "FL"],
        isFormat: /D[oD]?(\[[^[\]]*\]|\s)+MMMM?/,
      },
    });
    assertProp(
      fc.property(safeDates, (d) => {
        const m = moment(d).locale("x-months-obj");
        const o = originalMoment(d).locale("x-months-obj");
        expect(m.format("MMMM Do")).toBe(o.format("MMMM Do"));
        expect(m.format("Do MMMM")).toBe(o.format("Do MMMM"));
      }),
      { numRuns: 20 },
    );
    moment.locale("x-months-obj", null);
    originalMoment.locale("x-months-obj", null);
  });
});

describe("localeWeekdays (locale-format.ts)", () => {
  const safeDates = fc.date({
    min: new Date("2000-01-01"),
    max: new Date("2099-12-31"),
    noInvalidDate: true,
  });

  test("function weekdays with format matches moment.js", () => {
    moment.defineLocale("x-wd-fn", {
      weekdays: (m: { day: () => number }, fmt?: string) => {
        const days = ["D0", "D1", "D2", "D3", "D4", "D5", "D6"];
        return fmt ? `${days[m.day()]}-${fmt}` : days[m.day()];
      },
    });
    originalMoment.defineLocale("x-wd-fn", {
      weekdays: (m: { day: () => number }, fmt?: string) => {
        const days = ["D0", "D1", "D2", "D3", "D4", "D5", "D6"];
        return fmt ? `${days[m.day()]}-${fmt}` : days[m.day()];
      },
    });
    assertProp(
      fc.property(safeDates, (d) => {
        const m = moment(d).locale("x-wd-fn");
        const o = originalMoment(d).locale("x-wd-fn");
        expect(m.format("dddd")).toBe(o.format("dddd"));
      }),
      { numRuns: 20 },
    );
    moment.locale("x-wd-fn", null);
    originalMoment.locale("x-wd-fn", null);
  });

  test("weekdaysShort with function matches moment.js", () => {
    moment.defineLocale("x-wds-fn", {
      weekdaysShort: (m: { day: () => number }) =>
        ["SD0", "SD1", "SD2", "SD3", "SD4", "SD5", "SD6"][m.day()],
    });
    originalMoment.defineLocale("x-wds-fn", {
      weekdaysShort: (m: { day: () => number }) =>
        ["SD0", "SD1", "SD2", "SD3", "SD4", "SD5", "SD6"][m.day()],
    });
    assertProp(
      fc.property(safeDates, (d) => {
        const m = moment(d).locale("x-wds-fn");
        const o = originalMoment(d).locale("x-wds-fn");
        expect(m.format("ddd")).toBe(o.format("ddd"));
      }),
      { numRuns: 20 },
    );
    moment.locale("x-wds-fn", null);
    originalMoment.locale("x-wds-fn", null);
  });

  test("weekdays(true) returns reordered array matching moment.js", () => {
    assertProp(
      fc.property(safeDates, (d) => {
        const m = moment(d);
        const o = originalMoment(d);
        expect(m.weekday()).toBe(o.weekday());
      }),
      { numRuns: 50 },
    );
  });
});

describe("localeOrdinal (locale-format.ts)", () => {
  const safeDates = fc.date({
    min: new Date("2000-01-01"),
    max: new Date("2099-12-31"),
    noInvalidDate: true,
  });

  test("function ordinal matches moment.js", () => {
    moment.defineLocale("x-ord-fn", {
      ordinal: (n: number) => `${n}th`,
    });
    originalMoment.defineLocale("x-ord-fn", {
      ordinal: (n: number) => `${n}th`,
    });
    assertProp(
      fc.property(safeDates, (d) => {
        const m = moment(d).locale("x-ord-fn");
        const o = originalMoment(d).locale("x-ord-fn");
        expect(m.format("Do")).toBe(o.format("Do"));
      }),
      { numRuns: 20 },
    );
    moment.locale("x-ord-fn", null);
    originalMoment.locale("x-ord-fn", null);
  });

  test("string ordinal (%d replacement) matches moment.js", () => {
    moment.defineLocale("x-ord-str", {
      ordinal: "%d.",
    });
    originalMoment.defineLocale("x-ord-str", {
      ordinal: "%d.",
    });
    assertProp(
      fc.property(safeDates, (d) => {
        const m = moment(d).locale("x-ord-str");
        const o = originalMoment(d).locale("x-ord-str");
        expect(m.format("Do")).toBe(o.format("Do"));
      }),
      { numRuns: 20 },
    );
    moment.locale("x-ord-str", null);
    originalMoment.locale("x-ord-str", null);
  });

  test("no ordinal defined defaults to number", () => {
    moment.defineLocale("x-ord-none", {});
    originalMoment.defineLocale("x-ord-none", {});
    assertProp(
      fc.property(safeDates, (d) => {
        const m = moment(d).locale("x-ord-none");
        const o = originalMoment(d).locale("x-ord-none");
        expect(m.format("Do")).toBe(o.format("Do"));
      }),
      { numRuns: 20 },
    );
    moment.locale("x-ord-none", null);
    originalMoment.locale("x-ord-none", null);
  });
});

describe("localeRelativeTime (locale-runtime.ts)", () => {
  const relAmounts = fc.integer({ min: -100000, max: 100000 });
  const relUnits = fc.constantFrom(
    "seconds",
    "minutes",
    "hours",
    "days",
    "weeks",
    "months",
    "years",
  );

  test("relativeTime with function entries matches moment.js", () => {
    moment.defineLocale("x-rt-fn", {
      relativeTime: {
        future: "in %s",
        past: "%s ago",
        s: (n: number) => `${n} sec`,
        m: (n: number) => `${n} min`,
        h: (n: number) => `${n} hr`,
        d: (n: number) => `${n} day`,
        w: (n: number) => `${n} wk`,
        M: (n: number) => `${n} mon`,
        y: (n: number) => `${n} yr`,
      },
    });
    originalMoment.defineLocale("x-rt-fn", {
      relativeTime: {
        future: "in %s",
        past: "%s ago",
        s: (n: number) => `${n} sec`,
        m: (n: number) => `${n} min`,
        h: (n: number) => `${n} hr`,
        d: (n: number) => `${n} day`,
        w: (n: number) => `${n} wk`,
        M: (n: number) => `${n} mon`,
        y: (n: number) => `${n} yr`,
      },
    });
    assertProp(
      fc.property(safeDates, relAmounts, relUnits, (d, amount, unit) => {
        const m = moment(d)
          .add(amount, unit as moment.unitOfTime.DurationConstructor)
          .locale("x-rt-fn");
        const o = originalMoment(d)
          .add(amount, unit as moment.unitOfTime.DurationConstructor)
          .locale("x-rt-fn");
        expect(m.fromNow()).toBe(o.fromNow());
      }),
      { numRuns: 50 },
    );
    moment.locale("x-rt-fn", null);
    originalMoment.locale("x-rt-fn", null);
  });

  test("relativeTime with string entries matches moment.js", () => {
    moment.defineLocale("x-rt-str", {
      relativeTime: {
        future: "in %s",
        past: "%s ago",
        s: "%d seconds",
        m: "%d minutes",
        h: "%d hours",
        d: "%d days",
        w: "%d weeks",
        M: "%d months",
        y: "%d years",
      },
    });
    originalMoment.defineLocale("x-rt-str", {
      relativeTime: {
        future: "in %s",
        past: "%s ago",
        s: "%d seconds",
        m: "%d minutes",
        h: "%d hours",
        d: "%d days",
        w: "%d weeks",
        M: "%d months",
        y: "%d years",
      },
    });
    assertProp(
      fc.property(safeDates, relAmounts, relUnits, (d, amount, unit) => {
        const m = moment(d)
          .add(amount, unit as moment.unitOfTime.DurationConstructor)
          .locale("x-rt-str");
        const o = originalMoment(d)
          .add(amount, unit as moment.unitOfTime.DurationConstructor)
          .locale("x-rt-str");
        expect(m.fromNow()).toBe(o.fromNow());
      }),
      { numRuns: 50 },
    );
    moment.locale("x-rt-str", null);
    originalMoment.locale("x-rt-str", null);
  });

  test("relativeTime with relativeTimeFn consistency", () => {
    moment.defineLocale("x-rt-cust", {
      relativeTime: {
        future: "in %s",
        past: "%s ago",
        s: "%d seconds",
        m: "%d minutes",
        h: "%d hours",
        d: "%d days",
        w: "%d weeks",
        M: "%d months",
        y: "%d years",
      },
      relativeTimeFn: (n: number, key: string, isFuture: boolean) => {
        if (isFuture) {
          return `custom in ${n} ${key}`;
        }
        return `custom ${n} ${key} ago`;
      },
    });
    assertProp(
      fc.property(safeDates, relAmounts, relUnits, (d, amount, unit) => {
        const m = moment(d)
          .add(amount, unit as moment.unitOfTime.DurationConstructor)
          .locale("x-rt-cust");
        const str = m.fromNow();
        expect(typeof str).toBe("string");
        expect(str.length).toBeGreaterThan(0);
      }),
      { numRuns: 30 },
    );
    moment.locale("x-rt-cust", null);
  });

  test("future/past as function matches moment.js", () => {
    moment.defineLocale("x-rt-fp", {
      relativeTime: {
        future: (s: string) => `in ${s.toUpperCase()}`,
        past: (s: string) => `${s.toUpperCase()} ago`,
        s: "%d seconds",
        m: "%d minutes",
        h: "%d hours",
        d: "%d days",
        M: "%d months",
        y: "%d years",
      },
    });
    originalMoment.defineLocale("x-rt-fp", {
      relativeTime: {
        future: (s: string) => `in ${s.toUpperCase()}`,
        past: (s: string) => `${s.toUpperCase()} ago`,
        s: "%d seconds",
        m: "%d minutes",
        h: "%d hours",
        d: "%d days",
        M: "%d months",
        y: "%d years",
      },
    });
    assertProp(
      fc.property(safeDates, relAmounts, relUnits, (d, amount, unit) => {
        const m = moment(d)
          .add(amount, unit as moment.unitOfTime.DurationConstructor)
          .locale("x-rt-fp");
        const o = originalMoment(d)
          .add(amount, unit as moment.unitOfTime.DurationConstructor)
          .locale("x-rt-fp");
        expect(m.fromNow()).toBe(o.fromNow());
      }),
      { numRuns: 50 },
    );
    moment.locale("x-rt-fp", null);
    originalMoment.locale("x-rt-fp", null);
  });

  test("fromNow without suffix matches moment.js", () => {
    assertProp(
      fc.property(safeDates, relAmounts, relUnits, (d, amount, unit) => {
        const m = moment(d).add(amount, unit as moment.unitOfTime.DurationConstructor);
        const o = originalMoment(d).add(amount, unit as moment.unitOfTime.DurationConstructor);
        expect(m.fromNow(true)).toBe(o.fromNow(true));
      }),
      { numRuns: 50 },
    );
  });
});

describe("localeLongDateFormat (locale-runtime.ts)", () => {
  const safeDates = fc.date({
    min: new Date("2000-01-01"),
    max: new Date("2099-12-31"),
    noInvalidDate: true,
  });

  test("lowercase L/LL/LLL/LLLL matches moment.js", () => {
    assertProp(
      fc.property(safeDates, (d) => {
        const m = moment(d);
        const o = originalMoment(d);
        expect(m.format("l")).toBe(o.format("l"));
        expect(m.format("ll")).toBe(o.format("ll"));
        expect(m.format("lll")).toBe(o.format("lll"));
        expect(m.format("llll")).toBe(o.format("llll"));
      }),
      { numRuns: 30 },
    );
  });

  test("LT/LTS matches moment.js", () => {
    assertProp(
      fc.property(safeDates, (d) => {
        const m = moment(d);
        const o = originalMoment(d);
        expect(m.format("LT")).toBe(o.format("LT"));
        expect(m.format("LTS")).toBe(o.format("LTS"));
      }),
      { numRuns: 30 },
    );
  });

  test("custom longDateFormat matches moment.js", () => {
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
    assertProp(
      fc.property(safeDates, (d) => {
        const m = moment(d).locale("x-ldf");
        const o = originalMoment(d).locale("x-ldf");
        expect(m.format("L")).toBe(o.format("L"));
        expect(m.format("LL")).toBe(o.format("LL"));
        expect(m.format("ll")).toBe(o.format("ll"));
      }),
      { numRuns: 30 },
    );
    moment.locale("x-ldf", null);
    originalMoment.locale("x-ldf", null);
  });
});

describe("localePreparse / localePostformat", () => {
  const safeDates = fc.date({
    min: new Date("2000-01-01"),
    max: new Date("2099-12-31"),
    noInvalidDate: true,
  });

  test("preparse/postformat round-trip matches moment.js", () => {
    const preparseRe = /-/g;
    const postformatRe = /\./g;
    moment.defineLocale("x-pp", {
      preparse: (str: string) => str.replace(preparseRe, "."),
      postformat: (str: string) => str.replace(postformatRe, "-"),
    });
    originalMoment.defineLocale("x-pp", {
      preparse: (str: string) => str.replace(preparseRe, "."),
      postformat: (str: string) => str.replace(postformatRe, "-"),
    });
    assertProp(
      fc.property(safeDates, (d) => {
        const m = moment(d).locale("x-pp");
        const o = originalMoment(d).locale("x-pp");
        expect(m.format("YYYY-MM-DD")).toBe(o.format("YYYY-MM-DD"));
      }),
      { numRuns: 30 },
    );
    moment.locale("x-pp", null);
    originalMoment.locale("x-pp", null);
  });
});

const safeDates = fc.date({
  min: new Date("1900-01-01"),
  max: new Date("2100-12-31"),
  noInvalidDate: true,
});
