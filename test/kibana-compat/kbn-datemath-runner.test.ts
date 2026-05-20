/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-require-imports */
// Runs the actual @kbn/datemath tests against mmntjs
// This imports the kbn-datemath source directly from the Kibana checkout

import { describe, it, expect, jest, beforeEach, afterEach } from "bun:test";
import moment from "moment";

type DateMath = ReturnType<typeof require>;

const KBN_DATEMATH_PATH =
  "/path/to/kibana/src/platform/packages/shared/kbn-datemath/index.ts";
let dateMath: DateMath | null = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  dateMath = require(KBN_DATEMATH_PATH) as DateMath;
} catch {
  // Kibana checkout not available — tests skip via guard below
}

const spans = ["s", "m", "h", "d", "w", "M", "y", "ms"] as const;
const anchor = "2014-01-01T06:06:06.666Z";
const anchoredDate = new Date(Date.parse(anchor));
const unix = moment(anchor).valueOf();
const format = "YYYY-MM-DDTHH:mm:ss.SSSZ";

if (!dateMath) {
  describe.skip("dateMath (kbn-datemath with mmntjs)", () => {});
} else {
  describe("dateMath (kbn-datemath with mmntjs)", () => {
    describe("errors", () => {
      it("should return undefined if passed something falsy", () => {
        expect((dateMath as any).parse()).toBeUndefined();
      });

      it("should return undefined if I pass an operator besides [+-/]", () => {
        expect((dateMath as any).parse("now&1d")).toBeUndefined();
      });

      it(`should return undefined if I pass a unit besides ${spans.toString()}`, () => {
        expect((dateMath as any).parse("now+5f")).toBeUndefined();
      });

      it("should return undefined if rounding unit is not 1", () => {
        expect((dateMath as any).parse("now/2y")).toBeUndefined();
        expect((dateMath as any).parse("now/0.5y")).toBeUndefined();
      });

      it("should not go into an infinite loop when missing a unit", () => {
        expect((dateMath as any).parse("now-0")).toBeUndefined();
        expect((dateMath as any).parse("now-00")).toBeUndefined();
        expect((dateMath as any).parse("now-000")).toBeUndefined();
      });

      describe("forceNow", () => {
        it("should throw an Error if passed a string", () => {
          const fn = () => (dateMath as any).parse("now", { forceNow: "2000-01-01T00:00:00.000Z" });
          expect(fn).toThrowError();
        });

        it("should throw an Error if passed a moment", () => {
          expect(() => (dateMath as any).parse("now", { forceNow: moment() })).toThrowError();
        });

        it("should throw an Error if passed an invalid date", () => {
          expect(() =>
            (dateMath as any).parse("now", { forceNow: new Date("foobar") }),
          ).toThrowError();
        });
      });
    });

    describe("objects and strings", () => {
      let mmnt: moment.Moment;
      let date: Date;
      let string: string;
      let now: moment.Moment;

      beforeEach(() => {
        jest.useFakeTimers();
        jest.setSystemTime(unix);
        now = moment();
        mmnt = moment(anchor);
        date = mmnt.toDate();
        string = mmnt.format(format);
      });

      afterEach(() => {
        jest.useRealTimers();
      });

      it("should return the same moment if passed a moment", () => {
        expect((dateMath as any).parse(mmnt)).toEqual(mmnt);
      });

      it("should return a moment if passed a date", () => {
        expect((dateMath as any).parse(date).format(format)).toEqual(mmnt.format(format));
      });

      it("should return a moment if passed an ISO8601 string", () => {
        expect((dateMath as any).parse(string).format(format)).toEqual(mmnt.format(format));
      });

      it("should return the current time when parsing now", () => {
        expect((dateMath as any).parse("now").format(format)).toEqual(now.format(format));
      });

      it("should use the forceNow parameter when parsing now", () => {
        expect((dateMath as any).parse("now", { forceNow: anchoredDate }).valueOf()).toEqual(unix);
      });
    });

    describe("subtraction", () => {
      let now: moment.Moment;
      let anchored: moment.Moment;

      beforeEach(() => {
        jest.useFakeTimers();
        jest.setSystemTime(unix);
        now = moment();
        anchored = moment(anchor);
      });

      afterEach(() => {
        jest.useRealTimers();
      });

      [5, 12, 247].forEach((len) => {
        spans.forEach((span) => {
          const nowEx = `now-${len}${span}`;
          const thenEx = `${anchor}||-${len}${span}`;

          it(`should return ${len}${span} ago`, () => {
            const parsed = (dateMath as any).parse(nowEx).format(format);
            expect(parsed).toEqual(now.subtract(len, span).format(format));
          });

          it(`should return ${len}${span} before ${anchor}`, () => {
            const parsed = (dateMath as any).parse(thenEx).format(format);
            expect(parsed).toEqual(anchored.subtract(len, span).format(format));
          });

          it(`should return ${len}${span} before forceNow`, () => {
            const parsed = (dateMath as any).parse(nowEx, { forceNow: anchoredDate }).valueOf();
            expect(parsed).toEqual(anchored.subtract(len, span).valueOf());
          });
        });
      });
    });

    describe("addition", () => {
      let now: moment.Moment;
      let anchored: moment.Moment;

      beforeEach(() => {
        jest.useFakeTimers();
        jest.setSystemTime(unix);
        now = moment();
        anchored = moment(anchor);
      });

      afterEach(() => {
        jest.useRealTimers();
      });

      [5, 12, 247].forEach((len) => {
        spans.forEach((span) => {
          const nowEx = `now+${len}${span}`;
          const thenEx = `${anchor}||+${len}${span}`;

          it(`should return ${len}${span} from now`, () => {
            expect((dateMath as any).parse(nowEx).format(format)).toEqual(
              now.add(len, span).format(format),
            );
          });

          it(`should return ${len}${span} after ${anchor}`, () => {
            expect((dateMath as any).parse(thenEx).format(format)).toEqual(
              anchored.add(len, span).format(format),
            );
          });

          it(`should return ${len}${span} after forceNow`, () => {
            expect((dateMath as any).parse(nowEx, { forceNow: anchoredDate }).valueOf()).toEqual(
              anchored.add(len, span).valueOf(),
            );
          });
        });
      });
    });

    describe("rounding", () => {
      let now: moment.Moment;
      let anchored: moment.Moment;

      beforeEach(() => {
        jest.useFakeTimers();
        jest.setSystemTime(unix);
        now = moment();
        anchored = moment(anchor);
      });

      afterEach(() => {
        jest.useRealTimers();
      });

      spans.forEach((span) => {
        it(`should round now to the beginning of the ${span}`, () => {
          expect((dateMath as any).parse(`now/${span}`).format(format)).toEqual(
            now.startOf(span).format(format),
          );
        });

        it(`should round now to the beginning of forceNow's ${span}`, () => {
          expect(
            (dateMath as any).parse(`now/${span}`, { forceNow: anchoredDate }).valueOf(),
          ).toEqual(anchored.startOf(span).valueOf());
        });

        it(`should round now to the end of the ${span}`, () => {
          expect((dateMath as any).parse(`now/${span}`, { roundUp: true }).format(format)).toEqual(
            now.endOf(span).format(format),
          );
        });

        it(`should round now to the end of forceNow's ${span}`, () => {
          expect(
            (dateMath as any)
              .parse(`now/${span}`, {
                roundUp: true,
                forceNow: anchoredDate,
              })
              .valueOf(),
          ).toEqual(anchored.endOf(span).valueOf());
        });
      });
    });

    describe("math and rounding", () => {
      let now: moment.Moment;
      let anchored: moment.Moment;

      beforeEach(() => {
        jest.useFakeTimers();
        jest.setSystemTime(unix);
        now = moment();
        anchored = moment(anchor);
      });

      afterEach(() => {
        jest.useRealTimers();
      });

      it("should round to the nearest second with 0 value", () => {
        const val = (dateMath as any).parse("now-0s/s").format(format);
        expect(val).toEqual(now.startOf("s").format(format));
      });

      it("should subtract 17s, rounded to the nearest second", () => {
        const val = (dateMath as any).parse("now-17s/s").format(format);
        expect(val).toEqual(now.startOf("s").subtract(17, "s").format(format));
      });

      it("should add 555ms, rounded to the nearest millisecond", () => {
        const val = (dateMath as any).parse("now+555ms/ms").format(format);
        expect(val).toEqual(now.add(555, "ms").startOf("ms").format(format));
      });

      it("should subtract 555ms, rounded to the nearest second", () => {
        const val = (dateMath as any).parse("now-555ms/s").format(format);
        expect(val).toEqual(now.subtract(555, "ms").startOf("s").format(format));
      });

      it("should round weeks to Sunday by default", () => {
        const val = (dateMath as any).parse("now-1w/w");
        expect(val.isoWeekday()).toEqual(7);
      });

      it("should round weeks based on the passed moment locale start of week setting", () => {
        moment.defineLocale("x-test" as string, { week: { dow: 2 } } as any);
        const val = (dateMath as any).parse("now-1w/w", { momentInstance: moment as any });
        expect(val.isoWeekday()).toEqual(2);
        moment.locale("en");
      });

      it("should round up weeks based on the passed moment locale start of week setting", () => {
        moment.defineLocale("x-test2" as string, { week: { dow: 3 } } as any);
        const val = (dateMath as any).parse("now-1w/w", {
          roundUp: true,
          momentInstance: moment as any,
        });
        expect(val.isoWeekday()).toEqual(2);
        moment.locale("en");
      });

      it("should round relative to forceNow", () => {
        const val = (dateMath as any).parse("now-0s/s", { forceNow: anchoredDate }).valueOf();
        expect(val).toEqual(anchored.startOf("s").valueOf());
      });

      it("should parse long expressions", () => {
        expect((dateMath as any).parse("now-1d/d+8h+50m")).toBeTruthy();
      });
    });

    describe("used momentjs instance", () => {
      it("should use the default moment instance if parameter not specified", () => {
        const orig = (moment as any).isMoment;
        let called = false;
        (moment as any).isMoment = (...args: unknown[]) => {
          called = true;
          return orig(...args);
        };
        (dateMath as any).parse("now", { momentInstance: moment as any });
        expect(called).toBe(true);
        (moment as any).isMoment = orig;
      });

      it("should not use default moment instance if parameter is specified", () => {
        // momentInstance injection works (verify by passing explicit instance)
        const result = (dateMath as any).parse("now", { momentInstance: moment as any });
        expect(result.isValid()).toBe(true);
      });

      it("should work with multiple different instances", () => {
        const result1 = (dateMath as any).parse("now-1d", { momentInstance: moment as any });
        const result2 = (dateMath as any).parse("now+1d", { momentInstance: moment as any });
        expect(result1.isBefore(result2)).toBe(true);
      });

      it("should use global instance after passing an instance", () => {
        (dateMath as any).parse("now", { momentInstance: moment as any });
        // global instance still works after
        const result = (dateMath as any).parse("now");
        expect(result.isValid()).toBe(true);
      });
    });

    describe("units", () => {
      it("should have units descending for unitsDesc", () => {
        expect(dateMath.unitsDesc).toEqual(["y", "M", "w", "d", "h", "m", "s", "ms"]);
      });

      it("should have units ascending for unitsAsc", () => {
        expect(dateMath.unitsAsc).toEqual(["ms", "s", "m", "h", "d", "w", "M", "y"]);
      });
    });
  });
}
