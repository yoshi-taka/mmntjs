import { test, expect, afterAll } from "bun:test";
import type { Moment } from "../src/moment-class";
import type { Duration } from "../src/duration";
import fs from "node:fs";
import path from "node:path";
import fc from "fast-check";
import originalMoment from "../moment/moment";

const ROOT = path.resolve(__dirname, "..");

function clearCache(): void {
  for (const key of Object.keys(require.cache)) {
    delete require.cache[key];
  }
}

function mutatedMod(): { duration: (input?: unknown) => Duration } {
  return require("../src/index.ts").default as never;
}

function mutatedMoment(input: unknown): Moment {
  const mod = require("../src/index.ts").default;
  return mod(input);
}

interface Mutation {
  name: string;
  file: string;
  patterns: [RegExp, string][];
  inputs: fc.Arbitrary<unknown>;
  testFn: (input: unknown) => boolean;
}

let mutTotal = 0,
  mutKilled = 0,
  mutSurvived = 0,
  mutSkipped = 0;

function makeMutations(mutations: Mutation[]) {
  for (const mutation of mutations) {
    test(
      `mutation (oracle): ${mutation.name}`,
      () => {
        mutTotal++;
        const filePath = path.resolve(ROOT, mutation.file);
        const original = fs.readFileSync(filePath, "utf-8");
        let mutated = original;
        let applied = false;

        for (const [pattern, replacement] of mutation.patterns) {
          const before = mutated;
          mutated = mutated.replace(pattern, replacement);
          if (mutated !== before) {
            applied = true;
          }
        }

        if (!applied) {
          mutSkipped++;
          console.log(`  SKIP (no match): ${mutation.name}`);
          return;
        }

        fs.writeFileSync(filePath, mutated, "utf-8");

        let killedByOracle = false;
        let fcAssertThrew = false;

        try {
          clearCache();

          fc.assert(
            fc.property(mutation.inputs, (input) => {
              if (killedByOracle) {
                return true;
              }
              const ok = mutation.testFn(input);
              if (!ok) {
                killedByOracle = true;
              }
              return ok;
            }),
            { numRuns: 100 },
          );
        } catch {
          fcAssertThrew = true;
          killedByOracle = true;
        } finally {
          fs.writeFileSync(filePath, original, "utf-8");
          clearCache();
        }

        if (killedByOracle) {
          mutKilled++;
          console.log(`  ${fcAssertThrew ? "KILLED (fc)" : "KILLED (oracle)"}: ${mutation.name}`);
        } else {
          mutSurvived++;
          console.log(`  SURVIVED: ${mutation.name}`);
        }

        expect(killedByOracle).toBe(true);
      },
      { timeout: 60000 },
    );
  }
}

const nonZeroInt = (min: number, max: number) => fc.integer({ min, max }).filter((n) => n !== 0);
const positiveInt = (min: number, max: number) => fc.integer({ min, max }).filter((n) => n > 0);

const distinctDatePair = () =>
  fc
    .tuple(fc.date({ noInvalidDate: true }), fc.date({ noInvalidDate: true }))
    .filter(([a, b]) => a.getTime() !== b.getTime());

afterAll(() => {
  const rate = mutTotal > 0 ? ((mutKilled / mutTotal) * 100).toFixed(1) : "N/A";
  console.log(`\n--- Mutation Survival Rate ---`);
  console.log(`Killed: ${mutKilled}/${mutTotal} (${rate}%)`);
  console.log(`Survived: ${mutSurvived}`);
  console.log(`Skipped: ${mutSkipped}`);
  if (mutSurvived > 0) {
    process.exit(1);
  }
});

makeMutations([
  {
    name: "valueOf: off by +1ms",
    file: "src/moment-class.ts",
    patterns: [[/    return this\._t;\n/g, "    return this._t + 1;\n"]],
    inputs: fc.date({ noInvalidDate: true }),
    testFn: (input: unknown) => {
      return mutatedMoment(input).valueOf() === originalMoment(input as Date).valueOf();
    },
  },
  {
    name: "add days: wrong direction",
    file: "src/moment-class.ts",
    patterns: [
      [
        /d\.setUTCDate\(d\.getUTCDate\(\) \+ sign \* days\)/g,
        "d.setUTCDate(d.getUTCDate() - sign * days)",
      ],
      [/d\.setDate\(d\.getDate\(\) \+ sign \* days\)/g, "d.setDate(d.getDate() - sign * days)"],
    ],
    inputs: fc.tuple(fc.date({ noInvalidDate: true }), nonZeroInt(-100, 100)),
    testFn: (input: unknown) => {
      const [date, n] = input as [unknown, unknown];
      return (
        mutatedMoment(date)
          .add({ days: n as number })
          .format("YYYY-MM-DD") ===
        originalMoment(date as Date)
          .add({ days: n as number })
          .format("YYYY-MM-DD")
      );
    },
  },
  {
    name: "add days: _t sign flipped",
    file: "src/moment-class.ts",
    patterns: [[/this\._t \+= rounded \* 86400000;/g, "this._t -= rounded * 86400000;"]],
    inputs: fc.tuple(fc.date({ noInvalidDate: true }), nonZeroInt(-100, 100)),
    testFn: (input: unknown) => {
      const [date, n] = input as [unknown, unknown];
      return (
        (mutatedMoment as unknown as Record<string, (x: unknown) => Moment>)
          .utc(date)
          .add(n as number, "days")
          .format("YYYY-MM-DD") ===
        (originalMoment as unknown as Record<string, (x: unknown) => Moment>)
          .utc(date as Date)
          .add(n as number, "days")
          .format("YYYY-MM-DD")
      );
    },
  },
  {
    name: "diff: sign flipped",
    file: "src/moment-class.ts",
    patterns: [[/return a - b \|\| 0;/g, "return b - a || 0;"]],
    inputs: distinctDatePair(),
    testFn: (input: unknown) => {
      const [a, b] = input as [unknown, unknown];
      return (
        mutatedMoment(a).diff(mutatedMoment(b)) ===
        originalMoment(a as Date).diff(originalMoment(b as Date))
      );
    },
  },
  {
    name: "isBefore: _compareCalendarValues sign flipped",
    file: "src/moment-class.ts",
    patterns: [
      [/_compareCalendarValues\(other, unit\) < 0/g, "_compareCalendarValues(other, unit) > 0"],
    ],
    inputs: fc.date({ noInvalidDate: true }),
    testFn: (input: unknown) => {
      const d = input as Date;
      return (
        mutatedMoment(d).isBefore(new Date(d.getTime() + 86400000), "day") ===
          originalMoment(d).isBefore(new Date(d.getTime() + 86400000), "day") &&
        mutatedMoment(new Date(d.getTime() + 86400000)).isBefore(d, "day") ===
          originalMoment(new Date(d.getTime() + 86400000)).isBefore(d, "day")
      );
    },
  },
  {
    name: "isAfter: comparison flipped",
    file: "src/moment-class.ts",
    patterns: [[/return a > b;/g, "return a < b;"]],
    inputs: distinctDatePair(),
    testFn: (input: unknown) => {
      const [a, b] = input as [unknown, unknown];
      return mutatedMoment(a).isAfter(b as Date) === originalMoment(a as Date).isAfter(b as Date);
    },
  },
  {
    name: "add months: wrong direction",
    file: "src/moment-class.ts",
    patterns: [
      [/d\.setUTCMonth\(curMonth \+ sign \* months\)/g, "d.setUTCMonth(curMonth - sign * months)"],
      [/d\.setMonth\(curMonth \+ sign \* months\)/g, "d.setMonth(curMonth - sign * months)"],
    ],
    inputs: fc.tuple(fc.date({ noInvalidDate: true }), nonZeroInt(-12, 12)),
    testFn: (input: unknown) => {
      const [date, n] = input as [unknown, unknown];
      return (
        mutatedMoment(date)
          .add({ months: n as number })
          .format("YYYY-MM-DD") ===
        originalMoment(date as Date)
          .add({ months: n as number })
          .format("YYYY-MM-DD")
      );
    },
  },
  {
    name: "startOf: hours set to noon",
    file: "src/moment-class.ts",
    patterns: [
      [
        /this\.\$H = 0;\n\s*this\.\$m = 0;\n\s*this\.\$s = 0;\n\s*this\.\$ms = 0;/g,
        "this.$H = 12;\n    this.$m = 0;\n    this.$s = 0;\n    this.$ms = 0;",
      ],
    ],
    inputs: fc.date({ noInvalidDate: true }),
    testFn: (input: unknown) => {
      return (
        mutatedMoment(input).startOf("day").format("HH:mm:ss") ===
        originalMoment(input as Date)
          .startOf("day")
          .format("HH:mm:ss")
      );
    },
  },
  {
    name: "isValid always returns true",
    file: "src/moment-class.ts",
    patterns: [[/if \(!this\._isValid\) \{\n\s*return false;\n\s*\}/g, ""]],
    inputs: fc.constantFrom(null, undefined, "", "invalid", NaN, Infinity, "2024-13-01"),
    testFn: (input: unknown) => {
      return (
        mutatedMoment(input).isValid() ===
        (originalMoment as unknown as (x: unknown) => Moment)(input).isValid()
      );
    },
  },
  {
    name: "endOf: no -1ms",
    file: "src/units.ts",
    patterns: [
      [
        /return value \+ \(unitMs - 1\) - euclideanModulo\(value, unitMs\);/g,
        "return value + unitMs - euclideanModulo(value, unitMs);",
      ],
    ],
    inputs: fc.date({ noInvalidDate: true }),
    testFn: (input: unknown) => {
      return (
        (mutatedMoment as unknown as Record<string, (x: unknown) => Moment>)
          .utc(input)
          .endOf("day")
          .valueOf() ===
        (originalMoment as unknown as Record<string, (x: unknown) => Moment>)
          .utc(input as Date)
          .endOf("day")
          .valueOf()
      );
    },
  },
  {
    name: "subtract: wrong direction",
    file: "src/moment-class.ts",
    patterns: [
      [
        /this\._applyDuration\(parsed\.ms, parsed\.days, parsed\.months, -1\);/g,
        "this._applyDuration(parsed.ms, parsed.days, parsed.months, 1);",
      ],
    ],
    inputs: fc.tuple(fc.date({ noInvalidDate: true }), positiveInt(1, 30)),
    testFn: (input: unknown) => {
      const [date, n] = input as [unknown, unknown];
      return (
        mutatedMoment(date)
          .subtract({ days: n as number })
          .format("YYYY-MM-DD") ===
        originalMoment(date as Date)
          .subtract({ days: n as number })
          .format("YYYY-MM-DD")
      );
    },
  },
  {
    name: "year setter: wrong year stored",
    file: "src/moment-class.ts",
    patterns: [
      [/this\.\$y = this\._d\.getUTCFullYear\(\);/g, "this.$y = this._d.getUTCFullYear() + 1;"],
      [/this\.\$y = d\.getFullYear\(\);/g, "this.$y = d.getFullYear() + 1;"],
      [/this\.\$y = dt\.getFullYear\(\);/g, "this.$y = dt.getFullYear() + 1;"],
    ],
    inputs: fc.date({ noInvalidDate: true }),
    testFn: (input: unknown) => {
      return (
        mutatedMoment(input).year(2020).year() ===
        originalMoment(input as Date)
          .year(2020)
          .year()
      );
    },
  },

  // === Phase 2: parse.ts / factory-shared.ts ===
  {
    name: "factory: dayOfYear upper bound off-by-one (> vs >=)",
    file: "src/core/factory-shared.ts",
    patterns: [[/parsed\.dayOfYear > daysMax/g, "parsed.dayOfYear >= daysMax"]],
    inputs: fc.constantFrom(
      "2024-366", // leap year, day 366 valid → mutated rejects it
      "2024-365", // valid in both
      "2025-366", // invalid in both (2025 non-leap, max 365)
      "2025-365", // valid in both
    ),
    testFn: (input: unknown) => {
      return mutatedMoment(input as string).isValid() === originalMoment(input as string).isValid();
    },
  },
  {
    name: "parse: month index off-by-one (month1-1 -> month1)",
    file: "src/core/factory-shared.ts",
    patterns: [
      [
        /let mo = parsed\.month;/g,
        "let mo = parsed.month !== undefined ? parsed.month + 1 : parsed.month;",
      ],
    ],
    inputs: fc.date({ noInvalidDate: true }).map((d) => d.toISOString().slice(0, 10)),
    testFn: (input: unknown) => {
      const mutated = mutatedMoment(input as string);
      const original = originalMoment(input as string);
      return (
        mutated.month() === original.month() &&
        mutated.format("YYYY-MM-DD") === original.format("YYYY-MM-DD")
      );
    },
  },

  // === Phase 2: duration.ts ===
  {
    name: "duration: _bubble days direction flip",
    file: "src/duration.ts",
    patterns: [
      [
        /days -= absCeil\(monthsToDays\(monthsFromDays\)\);/g,
        "days += absCeil(monthsToDays(monthsFromDays));",
      ],
    ],
    inputs: fc.record({ months: fc.integer({ min: -24, max: 24 }).filter((n) => n !== 0) }),
    testFn: (input: unknown) => {
      const mod = mutatedMod();
      const orig = originalMoment.duration(input as Record<string, number>);
      return mod.duration(input as Record<string, number>).days() === orig.days();
    },
  },
  {
    name: "duration: valueOf rounding Math.round -> Math.floor",
    file: "src/duration.ts",
    patterns: [
      [/Math\.round\(monthsToDays\(this\._months\)\)/g, "Math.floor(monthsToDays(this._months))"],
    ],
    inputs: fc.record({ months: fc.integer({ min: -12, max: 12 }) }),
    testFn: (input: unknown) => {
      const mod = mutatedMod();
      const orig = originalMoment.duration(input as Record<string, number>);
      return mod.duration(input as Record<string, number>).valueOf() === orig.valueOf();
    },
  },
  {
    name: 'duration: as("months") uses wrong conversion',
    file: "src/duration.ts",
    patterns: [
      [
        /daysToMonths\(this\._days \+ this\._milliseconds \/ 86400000\)/g,
        "monthsToDays(this._days + this._milliseconds / 86400000)",
      ],
    ],
    inputs: fc.record({
      days: fc.integer({ min: 1, max: 365 }),
      hours: fc.integer({ min: 0, max: 23 }),
    }),
    testFn: (input: unknown) => {
      const mod = mutatedMod();
      const orig = originalMoment.duration(input as Record<string, number>);
      const actual = mod.duration(input as Record<string, number>).as("months");
      const expected = orig.as("months");
      return Math.abs(actual - expected) < 1;
    },
  },

  // === Phase 2: display/format.ts ===
  {
    name: "format: UTC+0 offset sign (> vs >=)",
    file: "src/format-tokens.ts",
    patterns: [
      [/const sign = offset >= 0 \? "\+" : "-";/g, 'const sign = offset > 0 ? "+" : "-";'],
    ],
    inputs: fc.constant(0),
    testFn: (_input: unknown) => {
      return mutatedMoment(new Date()).utcOffset(0).format("Z") === "+00:00";
    },
  },
  {
    name: "format: month display off-by-one ($M + 1 -> $M)",
    file: "src/display/format.ts",
    patterns: [[/raw\.\$M \+ 1/g, "raw.$M"]],
    inputs: fc.date({ noInvalidDate: true }),
    testFn: (input: unknown) => {
      return (
        mutatedMoment(input).format("YYYY-MM-DD") ===
        originalMoment(input as Date).format("YYYY-MM-DD")
      );
    },
  },

  // === Phase 3: boundary-extra.ts ===
  {
    name: "boundary-extra: startOf WEEK $W = 0 constant (was dow)",
    file: "src/boundary-extra.ts",
    patterns: [
      [
        /m\.\$W = utc \? d\.getUTCDay\(\) : d\.getDay\(\);\n\s*m\._t = d\.getTime\(\);\n\s*break;\n\s*\}\n\s*case ISO_WEEK:\n\s*\{/g,
        "m.$W = 0;\n    m._t = d.getTime();\n    break;\n    }\n    case ISO_WEEK:\n    {",
      ],
    ],
    inputs: fc.date({
      min: new Date("2000-01-01"),
      max: new Date("2030-12-31"),
      noInvalidDate: true,
    }),
    testFn: (input: unknown) => {
      const d = input as Date;
      const m2 = moment.utc(d).startOf("week");
      const mOrig = originalMoment.utc(d).startOf("week");
      return m2.day() === mOrig.day() && m2.valueOf() === mOrig.valueOf();
    },
  },
  {
    name: "boundary-extra: startOf ISO_WEEK $W = 0 constant (was 1)",
    file: "src/boundary-extra.ts",
    patterns: [
      [
        /m\.\$W = utc \? d\.getUTCDay\(\) : d\.getDay\(\);\n\s*m\._t = d\.getTime\(\);\n\s*break;\n\s*\}\n\s*\}\n\s*}/g,
        "m.$W = 0;\n    m._t = d.getTime();\n    break;\n    }\n    }\n}",
      ],
    ],
    inputs: fc.date({
      min: new Date("2000-01-01"),
      max: new Date("2030-12-31"),
      noInvalidDate: true,
    }),
    testFn: (input: unknown) => {
      const d = input as Date;
      const m2 = moment.utc(d).startOf("isoWeek");
      const mOrig = originalMoment.utc(d).startOf("isoWeek");
      return m2.isoWeekday() === mOrig.isoWeekday() && m2.valueOf() === mOrig.valueOf();
    },
  },
  {
    name: "boundary-extra: endOf WEEK $W = 0 constant (was d.getDay)",
    file: "src/boundary-extra.ts",
    patterns: [
      [
        /m\.\$W = utc \? d\.getUTCDay\(\) : d\.getDay\(\);\n\s*m\._t = d\.getTime\(\);\n\s*break;\n\s*\}\n\s*case ISO_WEEK:\n\s*\{/g,
        "m.$W = 0;\n    m._t = d.getTime();\n    break;\n    }\n    case ISO_WEEK:\n    {",
      ],
    ],
    inputs: fc.date({
      min: new Date("2000-01-01"),
      max: new Date("2030-12-31"),
      noInvalidDate: true,
    }),
    testFn: (input: unknown) => {
      const d = input as Date;
      const m2 = moment.utc(d).endOf("week");
      const mOrig = originalMoment.utc(d).endOf("week");
      return m2.day() === mOrig.day() && m2.valueOf() === mOrig.valueOf();
    },
  },
  {
    name: "boundary-extra: endOf ISO_WEEK $W = 0 constant (was d.getDay)",
    file: "src/boundary-extra.ts",
    patterns: [
      [
        /m\.\$W = utc \? d\.getUTCDay\(\) : d\.getDay\(\);\n\s*m\._t = d\.getTime\(\);\n\s*break;\n\s*\}\n\s*\}\n\s*}/g,
        "m.$W = 0;\n    m._t = d.getTime();\n    break;\n    }\n    }\n}",
      ],
    ],
    inputs: fc.date({
      min: new Date("2000-01-01"),
      max: new Date("2030-12-31"),
      noInvalidDate: true,
    }),
    testFn: (input: unknown) => {
      const d = input as Date;
      const m2 = moment.utc(d).endOf("isoWeek");
      const mOrig = originalMoment.utc(d).endOf("isoWeek");
      return m2.isoWeekday() === mOrig.isoWeekday() && m2.valueOf() === mOrig.valueOf();
    },
  },
  {
    name: "boundary-extra: startOf WEEK locale dow ignored (constant 0)",
    file: "src/boundary-extra.ts",
    patterns: [
      [
        /const dow = weekCfg\.dow;\n\s*const day = utc \? d\.getUTCDay\(\) : d\.getDay\(\);\n\s*const diff = \(day - dow \+ 7\) % 7;/g,
        "const dow = 0;\n    const day = utc ? d.getUTCDay() : d.getDay();\n    const diff = (day - dow + 7) % 7;",
      ],
    ],
    inputs: fc.date({
      min: new Date("2000-01-01"),
      max: new Date("2030-12-31"),
      noInvalidDate: true,
    }),
    testFn: (input: unknown) => {
      const d = input as Date;
      moment.defineLocale("x-mut-loc", { week: { dow: 3 } } as unknown as Record<string, unknown>);
      originalMoment.defineLocale("x-mut-loc", { week: { dow: 3 } } as unknown as never);
      const m2 = moment.utc(d).locale("x-mut-loc").startOf("week");
      const mOrig = originalMoment.utc(d).locale("x-mut-loc").startOf("week");
      moment.locale("en");
      originalMoment.locale("en");
      return m2.day() === mOrig.day() && m2.valueOf() === mOrig.valueOf();
    },
  },
  {
    name: "boundary-extra: endOf WEEK locale dow ignored (constant 0)",
    file: "src/boundary-extra.ts",
    patterns: [
      [
        /const dow = weekCfg\.dow;\n\s*const weekDay = utc \? d\.getUTCDay\(\) : d\.getDay\(\);\n\s*const diff = \(weekDay - dow \+ 7\) % 7;/g,
        "const dow = 0;\n    const weekDay = utc ? d.getUTCDay() : d.getDay();\n    const diff = (weekDay - dow + 7) % 7;",
      ],
    ],
    inputs: fc.date({
      min: new Date("2000-01-01"),
      max: new Date("2030-12-31"),
      noInvalidDate: true,
    }),
    testFn: (input: unknown) => {
      const d = input as Date;
      moment.defineLocale("x-mut-end", { week: { dow: 3 } } as unknown as Record<string, unknown>);
      originalMoment.defineLocale("x-mut-end", { week: { dow: 3 } } as unknown as never);
      const m2 = moment.utc(d).locale("x-mut-end").endOf("week");
      const mOrig = originalMoment.utc(d).locale("x-mut-end").endOf("week");
      moment.locale("en");
      originalMoment.locale("en");
      return m2.day() === mOrig.day() && m2.valueOf() === mOrig.valueOf();
    },
  },
  {
    name: "calendar-extra: isoWeekday setter no _refreshFields",
    file: "src/calendar-extra.ts",
    patterns: [
      [
        /m\._t = dt\.getTime\(\);\n\s*m\._refreshFields\(\);/g,
        "m._t = dt.getTime();\n    // _refreshFields removed",
      ],
    ],
    inputs: fc.tuple(
      fc.date({ min: new Date("2000-01-01"), max: new Date("2030-12-31"), noInvalidDate: true }),
      fc.integer({ min: 1, max: 7 }),
    ),
    testFn: (input: unknown) => {
      const [d, wd] = input as [Date, number];
      const m2 = moment.utc(d);
      const mOrig = originalMoment.utc(d);
      m2.isoWeekday(wd);
      mOrig.isoWeekday(wd);
      return (
        m2.valueOf() === mOrig.valueOf() &&
        m2.format("HH:mm:ss.SSS") === mOrig.format("HH:mm:ss.SSS")
      );
    },
  },
  {
    name: "calendar-extra: dayOfYear setter no _refreshFields",
    file: "src/calendar-extra.ts",
    patterns: [
      [
        /m\._ensureFields\(\);\n\s*const year = m\.\$y;\n\s*const day = Number\(d\);/g,
        "const year = m.$y;\n    const day = Number(d);",
      ],
    ],
    inputs: fc.tuple(
      fc.date({ min: new Date("2000-01-01"), max: new Date("2030-12-31"), noInvalidDate: true }),
      fc.integer({ min: 1, max: 366 }),
    ),
    testFn: (input: unknown) => {
      const [d, doy] = input as [Date, number];
      const m2 = moment.utc(d);
      const mOrig = originalMoment.utc(d);
      m2.dayOfYear(doy);
      mOrig.dayOfYear(doy);
      return (
        m2.valueOf() === mOrig.valueOf() && m2.format("YYYY-MM-DD") === mOrig.format("YYYY-MM-DD")
      );
    },
  },

  // === Phase 2: parse-format.ts ===
  {
    name: "units: isLeapYear bit check flipped (condition flip)",
    file: "src/units.ts",
    patterns: [
      [/if \(\(y & 3\) !== 0\) \{\n\s*return false;\n\s*\}/g, "if ((y & 3) !== 0) {return true;}"],
    ],
    inputs: fc.constantFrom(2023, 2024, 1900, 2000),
    testFn: (input: unknown) => {
      return (
        mutatedMoment(new Date(input as number, 0, 1)).isLeapYear() ===
        originalMoment(new Date(input as number, 0, 1)).isLeapYear()
      );
    },
  },

  // === Phase 3: new public API surface ===
  {
    name: "defaultFormat: wrong default value",
    file: "src/moment-class.ts",
    patterns: [[/return 'YYYY-MM-DDTHH:mm:ssZ'/g, "return 'YYYY/MM/DD'"]],
    inputs: fc.constantFrom("2024-06-15T12:00:00", "2025-01-01T00:00:00"),
    testFn: (input: unknown) => {
      const m2 = mutatedMoment(input as string);
      const mOrig = originalMoment(input as string);
      const origFmt = originalMoment.defaultFormat;
      originalMoment.defaultFormat = "YYYY/MM/DD";
      const ok = m2.format() === mOrig.format();
      originalMoment.defaultFormat = origFmt;
      return ok;
    },
  },
  {
    name: "localeData: monthsParse off-by-one (month index)",
    file: "src/locale-runtime.ts",
    patterns: [[/months\[monthIndex\] !== undefined/g, "months[monthIndex + 1] !== undefined"]],
    inputs: fc.constantFrom("January", "February", "December", "Jan", "Dec"),
    testFn: (input: unknown) => {
      const mod = require("../src/index.ts").default;
      const loc = mod.localeData("en");
      const oloc = originalMoment.localeData("en");
      return loc.monthsParse(input as string, "MMMM") === oloc.monthsParse(input as string, "MMMM");
    },
  },
  {
    name: "localeData: firstDayOfWeek wrong value",
    file: "src/locale-runtime.ts",
    patterns: [[/return this\._config\.week\.dow;/g, "return 99;"]],
    inputs: fc.constantFrom("en", "en-gb", "de", "fr", "ja"),
    testFn: (input: unknown) => {
      const mod = require("../src/index.ts").default;
      const loc = mod.localeData(input as string);
      const oloc = originalMoment.localeData(input as string);
      return loc.firstDayOfWeek() === oloc.firstDayOfWeek();
    },
  },
  {
    name: "localeData: weekdaysParse always returns Saturday",
    file: "src/locale-runtime.ts",
    patterns: [
      [
        /weekdays\[weekdayIndex\] !== undefined/g,
        "(weekdayIndex === 6 ? true : false) ? true : false",
      ],
    ],
    inputs: fc.constantFrom("Monday", "Tuesday", "Sunday", "Funday"),
    testFn: (input: unknown) => {
      const mod = require("../src/index.ts").default;
      const loc = mod.localeData("en");
      const oloc = originalMoment.localeData("en");
      return loc.weekdaysParse(input as string) === oloc.weekdaysParse(input as string);
    },
  },
  {
    name: "isSame: unit comparison === flipped to !==",
    file: "src/moment-class.ts",
    patterns: [
      [/_compareCalendarValues\(other, unit\) === 0/g, "_compareCalendarValues(other, unit) !== 0"],
      [/return a === b;/g, "return a !== b;"],
    ],
    inputs: fc.date({ noInvalidDate: true }),
    testFn: (input: unknown) => {
      const d = input as Date;
      return (
        mutatedMoment(d).isSame(new Date(d.getTime() + 86400000), "day") ===
          originalMoment(d as Date).isSame(new Date(d.getTime() + 86400000), "day") &&
        mutatedMoment(d).isSame(d, "day") === originalMoment(d as Date).isSame(d as Date, "day")
      );
    },
  },
  {
    name: "isSameOrBefore: <= flipped to <",
    file: "src/moment-class.ts",
    patterns: [
      [
        /_compareCalendarValues\(other, unit \?\? "millisecond"\) <= 0/g,
        '_compareCalendarValues(other, unit ?? "millisecond") < 0',
      ],
    ],
    inputs: fc.date({ noInvalidDate: true }),
    testFn: (input: unknown) => {
      const d = input as Date;
      return (
        mutatedMoment(d).isSameOrBefore(new Date(d.getTime() + 86400000)) ===
          originalMoment(d as Date).isSameOrBefore(new Date(d.getTime() + 86400000)) &&
        mutatedMoment(d).isSameOrBefore(d) === originalMoment(d as Date).isSameOrBefore(d as Date)
      );
    },
  },
  {
    name: "isSameOrAfter: >= flipped to >",
    file: "src/moment-class.ts",
    patterns: [
      [
        /_compareCalendarValues\(other, unit \?\? "millisecond"\) >= 0/g,
        '_compareCalendarValues(other, unit ?? "millisecond") > 0',
      ],
    ],
    inputs: fc.date({ noInvalidDate: true }),
    testFn: (input: unknown) => {
      const d = input as Date;
      return (
        mutatedMoment(d).isSameOrAfter(new Date(d.getTime() - 86400000)) ===
          originalMoment(d as Date).isSameOrAfter(new Date(d.getTime() - 86400000)) &&
        mutatedMoment(d).isSameOrAfter(d) === originalMoment(d as Date).isSameOrAfter(d as Date)
      );
    },
  },
  {
    name: "isBetween: startOpen === flipped",
    file: "src/moment-class.ts",
    patterns: [[/fromStr\[0\] === "\("/g, 'fromStr[0] === "["']],
    inputs: fc.constantFrom(
      // 'a' at exactly 'from' boundary: mutation makes inclusive instead of exclusive
      {
        a: new Date("2024-06-15T12:00:00Z"),
        from: new Date("2024-06-15T12:00:00Z"),
        to: new Date("2024-06-16T12:00:00Z"),
      },
      {
        a: new Date("2024-06-15T13:00:00Z"),
        from: new Date("2024-06-14T12:00:00Z"),
        to: new Date("2024-06-16T12:00:00Z"),
      },
    ),
    testFn: (input: unknown) => {
      const { a, from, to } = input as { a: Date; from: Date; to: Date };
      return (
        mutatedMoment(a).isBetween(from, to, undefined, "()") ===
        originalMoment(a).isBetween(from, to, undefined, "()")
      );
    },
  },
  {
    name: "localeData: pastFuture sign flipped",
    file: "src/locale-runtime.ts",
    patterns: [[/diff > 0/g, "diff < 0"]],
    inputs: fc.tuple(
      fc.integer({ min: -100, max: 100 }).filter((n) => n !== 0),
      fc.constantFrom("5 minutes", "1 hour", "2 days"),
    ),
    testFn: (input: unknown) => {
      const [diff, rel] = input as [number, string];
      const mod = require("../src/index.ts").default;
      const loc = mod.localeData("en");
      const oloc = originalMoment.localeData("en");
      return loc.pastFuture(diff, rel) === oloc.pastFuture(diff, rel);
    },
  },
]);
