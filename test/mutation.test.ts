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

  // === Phase 2: parse.ts ===
  {
    name: "parse: dayOfYear lower bound off-by-one",
    file: "src/parse.ts",
    patterns: [[/dayOfYear >= 0 && dayOfYear <= 366/g, "dayOfYear >= -1 && dayOfYear <= 366"]],
    inputs: fc.constantFrom("2024000", "2024-000", "2025000", "2025-000"),
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
]);
