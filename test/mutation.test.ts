import { test, expect } from 'bun:test'
import type { Moment } from '../src/moment-class'
import fs from 'node:fs'
import path from 'node:path'
import fc from 'fast-check'
import originalMoment from '../moment/moment'

const ROOT = path.resolve(__dirname, '..')

function clearCache(): void {
  for (const key of Object.keys(require.cache)) {
    if (key.includes('/moment-class/')) {delete require.cache[key]}
  }
}

function mutatedMoment(input: unknown): Moment {
  const mod = require('../src/index.ts').default
  return mod(input)
}

interface Mutation {
  name: string
  file: string
  patterns: [RegExp, string][]
  inputs: fc.Arbitrary<unknown>
  testFn: (input: unknown) => boolean
}

function makeMutations(mutations: Mutation[]) {
  for (const mutation of mutations) {
    test(`mutation (oracle): ${mutation.name}`, () => {
      const filePath = path.resolve(ROOT, mutation.file)
      const original = fs.readFileSync(filePath, 'utf-8')
      let mutated = original
      let applied = false

      for (const [pattern, replacement] of mutation.patterns) {
        const before = mutated
        mutated = mutated.replace(pattern, replacement)
        if (mutated !== before) {applied = true}
      }

      if (!applied) {
        console.log(`  SKIP (no match): ${mutation.name}`)
        return
      }

      fs.writeFileSync(filePath, mutated, 'utf-8')

      let killedByOracle = false
      let fcAssertThrew = false

      try {
        clearCache()

        fc.assert(
          fc.property(mutation.inputs, (input) => {
            if (killedByOracle) {return true}
            const ok = mutation.testFn(input)
            if (!ok) {
              killedByOracle = true
            }
            return ok
          }),
          { numRuns: 100 }
        )
      } catch {
        fcAssertThrew = true
        killedByOracle = true
      } finally {
        fs.writeFileSync(filePath, original, 'utf-8')
        clearCache()
      }

      if (killedByOracle) {
        console.log(`  ${fcAssertThrew ? 'KILLED (fc)' : 'KILLED (oracle)'}: ${mutation.name}`)
      } else {
        console.log(`  SURVIVED: ${mutation.name}`)
      }

      expect(killedByOracle).toBe(true)
    }, { timeout: 60000 })
  }
}

const nonZeroInt = (min: number, max: number) =>
  fc.integer({ min, max }).filter((n) => n !== 0)

const distinctDatePair = () =>
  fc
    .tuple(fc.date({ noInvalidDate: true }), fc.date({ noInvalidDate: true }))
    .filter(([a, b]) => a.getTime() !== b.getTime())

makeMutations([
  {
    name: 'valueOf: off by +1ms',
    file: 'src/moment-class.ts',
    patterns: [
      [/    return this\._t;\n/g, '    return this._t + 1;\n'],
    ],
    inputs: fc.date({ noInvalidDate: true }),
    testFn: (input: unknown) => {
      return mutatedMoment(input).valueOf() === originalMoment(input as Date).valueOf()
    },
  },
  {
    name: 'add days: wrong direction',
    file: 'src/moment-class.ts',
    patterns: [
      [/d\.setUTCDate\(d\.getUTCDate\(\) \+ sign \* days\)/g, 'd.setUTCDate(d.getUTCDate() - sign * days)'],
      [/d\.setDate\(d\.getDate\(\) \+ sign \* days\)/g, 'd.setDate(d.getDate() - sign * days)'],
    ],
    inputs: fc.tuple(fc.date({ noInvalidDate: true }), nonZeroInt(-100, 100)),
    testFn: (input: unknown) => {
      const [date, n] = input as [unknown, unknown];
      return mutatedMoment(date).add({ days: n as number }).format('YYYY-MM-DD') === originalMoment(date as Date).add({ days: n as number }).format('YYYY-MM-DD')
    },
  },
  {
    name: 'add days (simple path): wrong direction',
    file: 'src/moment-class.ts',
    patterns: [
      [/        this\.\$D \+= rounded;/g, '        this.$D -= rounded;'],
    ],
    inputs: fc.tuple(fc.date({ noInvalidDate: true }), nonZeroInt(-100, 100)),
    testFn: (input: unknown) => {
      const [date, n] = input as [unknown, unknown];
      return mutatedMoment(date).add(n as number, 'days').format('YYYY-MM-DD') === originalMoment(date as Date).add(n as number, 'days').format('YYYY-MM-DD')
    },
  },
  {
    name: 'diff: sign flipped',
    file: 'src/moment-class.ts',
    patterns: [
      [/const diff = this\.valueOf\(\) - other\.valueOf\(\)/g, 'const diff = other.valueOf() - this.valueOf()'],
    ],
    inputs: distinctDatePair(),
    testFn: (input: unknown) => {
      const [a, b] = input as [unknown, unknown];
      return mutatedMoment(a).diff(mutatedMoment(b), 'days') === originalMoment(a as Date).diff(originalMoment(b as Date), 'days')
    },
  },
  {
    name: 'isBefore: comparison flipped',
    file: 'src/moment-class.ts',
    patterns: [
      [/return this\.valueOf\(\) < other\.valueOf\(\)/g, 'return this.valueOf() > other.valueOf()'],
    ],
    inputs: distinctDatePair(),
    testFn: (input: unknown) => {
      const [a, b] = input as [unknown, unknown];
      return mutatedMoment(a).isBefore(b as Date) === originalMoment(a as Date).isBefore(b as Date)
    },
  },
  {
    name: 'isAfter: comparison flipped',
    file: 'src/moment-class.ts',
    patterns: [
      [/return this\.valueOf\(\) > other\.valueOf\(\)/g, 'return this.valueOf() < other.valueOf()'],
    ],
    inputs: distinctDatePair(),
    testFn: (input: unknown) => {
      const [a, b] = input as [unknown, unknown];
      return mutatedMoment(a).isAfter(b as Date) === originalMoment(a as Date).isAfter(b as Date)
    },
  },
  {
    name: 'add months: wrong direction',
    file: 'src/moment-class.ts',
    patterns: [
      [/d\.setUTCMonth\(curMonth \+ sign \* months\)/g, 'd.setUTCMonth(curMonth - sign * months)'],
      [/d\.setMonth\(curMonth \+ sign \* months\)/g, 'd.setMonth(curMonth - sign * months)'],
    ],
    inputs: fc.tuple(fc.date({ noInvalidDate: true }), nonZeroInt(-12, 12)),
    testFn: (input: unknown) => {
      const [date, n] = input as [unknown, unknown];
      return mutatedMoment(date).add({ months: n as number }).format('YYYY-MM-DD') === originalMoment(date as Date).add({ months: n as number }).format('YYYY-MM-DD')
    },
  },
  {
    name: 'startOf: hours set to noon',
    file: 'src/moment-class.ts',
    patterns: [
      [/this\.\$H = 0; this\.\$m = 0; this\.\$s = 0; this\.\$ms = 0;/g, 'this.$H = 12; this.$m = 0; this.$s = 0; this.$ms = 0;'],
    ],
    inputs: fc.date({ noInvalidDate: true }),
    testFn: (input: unknown) => {
      return mutatedMoment(input).startOf('day').format('HH:mm:ss') === originalMoment(input as Date).startOf('day').format('HH:mm:ss')
    },
  },
  {
    name: 'isValid always returns true',
    file: 'src/moment-class.ts',
    patterns: [
      [/if \(!this\._isValid\) {return false;}\n/g, ''],
    ],
    inputs: fc.constantFrom(null, undefined, '', 'invalid', NaN, Infinity, '2024-13-01'),
    testFn: (input: unknown) => {
      return mutatedMoment(input).isValid() === (originalMoment as unknown as (x: unknown) => Moment)(input).isValid()
    },
  },
  {
    name: 'endOf: no -1ms',
    file: 'src/moment-class.ts',
    patterns: [
      [/d\.setMilliseconds\(-1\)/g, 'd.setMilliseconds(0)'],
    ],
    inputs: fc.date({ noInvalidDate: true }),
    testFn: (input: unknown) => {
      return mutatedMoment(input).endOf('day').format('HH:mm:ss.SSS') === originalMoment(input as Date).endOf('day').format('HH:mm:ss.SSS')
    },
  },
  {
    name: 'subtract: wrong direction',
    file: 'src/moment-class.ts',
    patterns: [
      [/this\._applyDuration\(parsed\.ms, parsed\.days, parsed\.months, -1\);/g, 'this._applyDuration(parsed.ms, parsed.days, parsed.months, 1);'],
    ],
    inputs: fc.tuple(fc.date({ noInvalidDate: true }), nonZeroInt(-30, 30)),
    testFn: (input: unknown) => {
      const [date, n] = input as [unknown, unknown];
      return mutatedMoment(date).subtract({ days: n as number }).format('YYYY-MM-DD') === originalMoment(date as Date).subtract({ days: n as number }).format('YYYY-MM-DD')
    },
  },
  {
    name: 'year setter: wrong year stored',
    file: 'src/moment-class.ts',
    patterns: [
      [/this\.\$y = this\._isUTC \? dt\.getUTCFullYear\(\) : dt\.getFullYear\(\);/g, 'this.$y = (this._isUTC ? dt.getUTCFullYear() : dt.getFullYear()) + 1;'],
    ],
    inputs: fc.date({ noInvalidDate: true }),
    testFn: (input: unknown) => {
      return mutatedMoment(input).year(2020).year() === originalMoment(input as Date).year(2020).year()
    },
  },
])
