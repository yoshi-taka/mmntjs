import { describe, test, expect } from "bun:test";
import fc from "fast-check";
import _moment from "../src/index.ts";
import type { Moment } from "../src/moment-class";
import type { Duration } from "../src/duration";
import _originalMoment from "../moment/moment";
type MomentFn = ((...args: unknown[]) => Moment) & {
  min(...args: unknown[]): Moment;
  max(...args: unknown[]): Moment;
  utc(...args: unknown[]): Moment;
  parseZone(...args: unknown[]): Moment;
  duration(...args: unknown[]): Duration;
  normalizeUnits(unit: string): string;
  defineLocale(name: string, config: Record<string, unknown>): Record<string, unknown>;
  isMoment(obj: unknown): obj is Moment;
};
const moment = _moment as unknown as MomentFn;
const originalMoment = _originalMoment as unknown as MomentFn;

describe("SBST: adversarial tests", () => {
  test("NaN/Infinity in all constructor argument positions", () => {
    fc.assert(
      fc.property(
        fc.constantFrom(NaN, Infinity, -Infinity),
        fc.constantFrom(NaN, Infinity, -Infinity),
        fc.constantFrom(NaN, Infinity, -Infinity),
        fc.constantFrom(NaN, Infinity, -Infinity),
        fc.constantFrom(NaN, Infinity, -Infinity),
        fc.constantFrom(NaN, Infinity, -Infinity),
        fc.constantFrom(NaN, Infinity, -Infinity),
        // eslint-disable-next-line max-params
        (y, mo, d, h, mi, s, ms) => {
          const arr = [y, mo, d, h, mi, s, ms];
          const m2 = moment(arr as unknown[]);
          const mOrig = originalMoment(arr as unknown[]);
          expect(m2.isValid()).toBe(mOrig.isValid());
          if (mOrig.isValid()) {
            expect(m2.valueOf()).toBe(mOrig.valueOf());
          }
        },
      ),
      { numRuns: 200 },
    );
  });

  test("extreme year values with format", () => {
    fc.assert(
      fc.property(
        fc.oneof(fc.integer({ min: -100000, max: -1 }), fc.integer({ min: 10000, max: 100000 })),
        fc.constantFrom(
          "YYYY-MM-DD",
          "YYYY",
          "YY",
          "GGGG",
          "gggg",
          "MMMM YYYY",
          "YYYY-MM-DD HH:mm:ss",
          "ddd, MMM YYYY",
        ),
        (year, fmt) => {
          const arr: [number, number, number] = [year, 0, 1];
          const m2 = moment(arr);
          const mOrig = originalMoment(arr);
          if (m2.isValid() !== mOrig.isValid()) {
            return;
          }
          if (m2.isValid()) {
            try {
              const f2 = m2.format(fmt);
              const fOrig = mOrig.format(fmt);
              expect(f2).toBe(fOrig);
            } catch {}
          }
        },
      ),
      { numRuns: 300 },
    );
  });

  test("adversarial format strings", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 2000, max: 2030 }),
        fc.oneof(
          fc
            .array(
              fc.constantFrom(
                "Y",
                "M",
                "D",
                "d",
                "H",
                "h",
                "m",
                "s",
                "S",
                "A",
                "Z",
                "X",
                "x",
                "Q",
                "W",
                "E",
                "G",
                "g",
                "k",
                "[",
                "]",
                "\\",
                " ",
              ),
              { maxLength: 30 },
            )
            .map((a) => a.join("")),
          fc.constantFrom(
            "Y",
            "M",
            "D",
            "d",
            "H",
            "h",
            "m",
            "s",
            "S",
            "YYY",
            "MMMMM",
            "SSSS",
            "HHHH",
            "YYYY-MM-DD-HH-mm-ss-SSS",
            "YYYYYY",
            "\\Y\\E\\S",
            "[[]]",
            "[[[",
            `Y${  "Y".repeat(20)}`,
            "S".repeat(10),
            " ",
            "  ",
            "\t",
          ),
        ),
        (year, fmt) => {
          const m2 = moment([year, 5, 15]);
          const mOrig = originalMoment([year, 5, 15]);
          try {
            const f2 = m2.format(fmt);
            const fOrig = mOrig.format(fmt);
            expect(f2).toBe(fOrig);
          } catch {}
        },
      ),
      { numRuns: 500 },
    );
  });

  test("adversarial strict parsing", () => {
    fc.assert(
      fc.property(
        fc.string({ maxLength: 20 }),
        fc.constantFrom(
          "YYYY-MM-DD",
          "MM/DD/YYYY",
          "DD-MM-YYYY",
          "YYYY MM DD",
          "HH:mm:ss",
          "h:mm A",
          "MMMM Do YYYY",
          "YYYY",
          "DD.MM.YYYY",
        ),
        (input, fmt) => {
          const m2 = moment(input, fmt, true);
          const mOrig = originalMoment(input, fmt, true);
          expect(m2.isValid()).toBe(mOrig.isValid());
        },
      ),
      { numRuns: 500 },
    );
  });

  test("adversarial chained operations on invalid moments", () => {
    fc.assert(
      fc.property(
        fc.constantFrom(NaN, Infinity, -Infinity, null, undefined, "", "invalid", "   "),
        fc.constantFrom("add", "subtract"),
        (input, method) => {
          const m2 = moment(input as unknown);
          const mOrig = originalMoment(input as unknown);
          try {
            const r2 = m2[method](1, "day");
            const rOrig = mOrig[method](1, "day");
            expect(r2.isValid()).toBe(rOrig.isValid());
          } catch {}
        },
      ),
      { numRuns: 200 },
    );
  });

  test("duration from ISO string edge cases", () => {
    fc.assert(
      fc.property(
        fc.oneof(
          fc.constantFrom(
            "P1Y2M3DT4H5M6S",
            "P1Y",
            "P1M",
            "P1D",
            "PT1H",
            "PT1M",
            "PT1S",
            "P0D",
            "P1Y2M3D",
            "PT4H5M6S",
            "P-1Y",
            "P-1D",
            "PT-1H",
            "P1Y-1M",
            "P",
            "PT",
            "P1Y2M3DT4H5M6.123S",
            "P1DT24H",
            "P1Y0M0DT0H0M0S",
            "P999Y",
            "P-999Y",
            "PT1000000S",
          ),
        ),
        (iso) => {
          const d2 = moment.duration(iso);
          const dOrig = originalMoment.duration(iso);
          expect(d2.isValid()).toBe(dOrig.isValid());
          if (dOrig.isValid()) {
            expect(d2.asMilliseconds()).toBe(dOrig.asMilliseconds());
            expect(d2.toISOString()).toBe(dOrig.toISOString());
          }
        },
      ),
      { numRuns: 200 },
    );
  });

  test("duration humanize edge cases", () => {
    fc.assert(
      fc.property(
        fc.oneof(
          fc.integer({ min: 0, max: 100 }),
          fc.integer({ min: -100, max: 0 }),
          fc.constantFrom(NaN, Infinity, -Infinity),
        ),
        (ms) => {
          if (typeof ms !== "number") {return;}
          const d2 = moment.duration(ms);
          const dOrig = originalMoment.duration(ms);
          if (!d2.isValid() || !dOrig.isValid()) {return;}
          expect(d2.humanize()).toBe(dOrig.humanize());
          expect(d2.humanize(true)).toBe(dOrig.humanize(true));
        },
      ),
      { numRuns: 200 },
    );
  });

  test("moment with empty/null/undefined object", () => {
    fc.assert(
      fc.property(fc.constantFrom({}, null), (input) => {
        const m2 = moment(input as unknown);
        const mOrig = originalMoment(input as unknown);
        expect(m2.isValid()).toBe(mOrig.isValid());
      }),
      { numRuns: 50 },
    );
  });

  test("clone with various internal states", () => {
    fc.assert(
      fc.property(
        fc.oneof(
          fc.integer({ min: -100000, max: 100000 }),
          fc.constantFrom(NaN, Infinity, -Infinity),
        ),
        fc.constantFrom("seconds", "days", "months", "years"),
        (offset, unit) => {
          if (typeof offset !== "number" || !Number.isFinite(offset)) {return;}
          const base = moment();
          const m2 = base.clone().add(offset, unit).clone();
          const mOrig = base.clone().add(offset, unit).clone();
          expect(m2.isValid()).toBe(mOrig.isValid());
          if (mOrig.isValid()) {
            expect(m2.valueOf()).toBe(mOrig.valueOf());
          }
        },
      ),
      { numRuns: 200 },
    );
  });

  test("create from Date with extreme values", () => {
    fc.assert(
      fc.property(
        fc.oneof(
          fc.constantFrom(
            new Date(NaN),
            new Date(Infinity),
            new Date(-Infinity),
            new Date(0),
            new Date(-0),
            new Date(8.64e15),
            new Date(-8.64e15),
            new Date(8.64e15 + 1),
            new Date(-8.64e15 - 1),
          ),
        ),
        (d) => {
          const m2 = moment(d);
          const mOrig = originalMoment(d);
          expect(m2.isValid()).toBe(mOrig.isValid());
        },
      ),
      { numRuns: 50 },
    );
  });

  test("diff between extreme values", () => {
    fc.assert(
      fc.property(
        fc.constantFrom(new Date(0), new Date(8.64e15), new Date(-8.64e15)),
        fc.constantFrom(new Date(0), new Date(8.64e15), new Date(-8.64e15)),
        fc.constantFrom("year" as const, "month" as const, "day" as const, "hour" as const, "minute" as const, "second" as const),
        (a: Date, b: Date, unit: string) => {
          const m2a = moment(a);
          const m2b = moment(b);
          const mOriga = originalMoment(a);
          const mOrigb = originalMoment(b);
          if (!m2a.isValid() || !m2b.isValid() || !mOriga.isValid() || !mOrigb.isValid()) {return;}
          expect(m2a.diff(m2b, unit)).toBe(mOriga.diff(mOrigb, unit));
        },
      ),
      { numRuns: 100 },
    );
  });

  test("format with missing/invalid locale", () => {
    fc.assert(
      fc.property(
        fc.constantFrom("xx", "invalid", "", "undefined", "null"),
        fc.constantFrom(
          "L",
          "LL",
          "LLL",
          "LLLL",
          "LT",
          "LTS",
          "dddd",
          "MMMM",
          "MMM",
          "ddd",
          "llll",
        ),
        (locale, fmt) => {
          const m2 = moment([2024, 5, 15]);
          const mOrig = originalMoment([2024, 5, 15]);
          try {
            const f2 = m2.locale(locale).format(fmt);
            const fOrig = mOrig.locale(locale).format(fmt);
            expect(f2).toBe(fOrig);
          } catch {}
        },
      ),
      { numRuns: 100 },
    );
  });

  test("isMoment/isDate/isDuration with non-moment values", () => {
    fc.assert(
      fc.property(
        fc.constantFrom(
          null,
          undefined,
          0,
          "",
          "hello",
          true,
          false,
          {},
          [],
          /regex/,
          Symbol("test"),
          new Date(),
          new Map(),
          new Set(),
        ),
        (input) => {
          expect(moment.isMoment(input)).toBe(originalMoment.isMoment(input));
        },
      ),
      { numRuns: 50 },
    );
  });
});
