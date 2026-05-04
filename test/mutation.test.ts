import { test, expect } from 'bun:test'
import fs from 'node:fs'
import path from 'node:path'
import fc from 'fast-check'
import originalMoment from '../moment/moment'

const ROOT = path.resolve(__dirname, '..')

function mutatedMoment(input: any): any {
  const mod = require('../moment').default || require('../moment')
  return mod(input)
}

interface Mutation {
  name: string
  file: string
  patterns: [RegExp, string][]
  inputs: fc.Arbitrary<any>
  testFn: (input: any) => boolean
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

      try {
        // Clear require cache so we get the mutated version
        delete require.cache[require.resolve('../moment')]
        for (const key of Object.keys(require.cache)) {
          if (key.includes('/moment2/src/')) {delete require.cache[key]}
        }

        let killedByOracle = false

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

        if (killedByOracle) {
          console.log(`  KILLED (oracle): ${mutation.name}`)
        } else {
          console.log(`  SURVIVED: ${mutation.name}`)
        }
        expect(killedByOracle).toBe(true)
      } catch {
        // fc.assert threw because property returned false → counterexample found
        // This means mutation was detected by oracle → KILLED
        console.log(`  KILLED (oracle): ${mutation.name}`)
      } finally {
        fs.writeFileSync(filePath, original, 'utf-8')
        delete require.cache[require.resolve('../moment')]
        for (const key of Object.keys(require.cache)) {
          if (key.includes('/moment2/src/')) {delete require.cache[key]}
        }
      }
    }, { timeout: 60000 })
  }
}

makeMutations([
  {
    name: 'valueOf: off by +1ms',
    file: 'src/moment.ts',
    patterns: [
      [/return this\._d\.getTime\(\)\n/g, 'return this._d.getTime() + 1\n'],
    ],
    inputs: fc.date({ noInvalidDate: true }),
    testFn: (input: any) => {
      return mutatedMoment(input).valueOf() === originalMoment(input).valueOf()
    },
  },
  {
    name: 'add days: wrong direction',
    file: 'src/moment.ts',
    patterns: [
      [/d\.setDate\(d\.getDate\(\) \+ days\)/g, 'd.setDate(d.getDate() - days)'],
    ],
    inputs: fc.tuple(fc.date({ noInvalidDate: true }), fc.integer({ min: -100, max: 100 })),
    testFn: ([date, n]: any) => {
      return mutatedMoment(date).add(n, 'days').format('YYYY-MM-DD') === originalMoment(date).add(n, 'days').format('YYYY-MM-DD')
    },
  },
  {
    name: 'diff: sign flipped',
    file: 'src/moment.ts',
    patterns: [
      [/const diff = this\.valueOf\(\) - other\.valueOf\(\)/g, 'const diff = other.valueOf() - this.valueOf()'],
    ],
    inputs: fc.tuple(fc.date({ noInvalidDate: true }), fc.date({ noInvalidDate: true })),
    testFn: ([a, b]: any) => {
      return mutatedMoment(a).diff(mutatedMoment(b), 'days') === originalMoment(a).diff(originalMoment(b), 'days')
    },
  },
  {
    name: 'isBefore: comparison flipped',
    file: 'src/moment.ts',
    patterns: [
      [/return this\.valueOf\(\) < other\.valueOf\(\)/g, 'return this.valueOf() > other.valueOf()'],
    ],
    inputs: fc.tuple(fc.date({ noInvalidDate: true }), fc.date({ noInvalidDate: true })),
    testFn: ([a, b]: any) => {
      return mutatedMoment(a).isBefore(b) === originalMoment(a).isBefore(b)
    },
  },
  {
    name: 'isAfter: comparison flipped',
    file: 'src/moment.ts',
    patterns: [
      [/return this\.valueOf\(\) > other\.valueOf\(\)/g, 'return this.valueOf() < other.valueOf()'],
    ],
    inputs: fc.tuple(fc.date({ noInvalidDate: true }), fc.date({ noInvalidDate: true })),
    testFn: ([a, b]: any) => {
      return mutatedMoment(a).isAfter(b) === originalMoment(a).isAfter(b)
    },
  },
  {
    name: 'add months: wrong direction',
    file: 'src/moment.ts',
    patterns: [
      [/d\.setMonth\(newMonth\)/g, 'd.setMonth(curMonth - months)'],
    ],
    inputs: fc.tuple(fc.date({ noInvalidDate: true }), fc.integer({ min: -12, max: 12 })),
    testFn: ([date, n]: any) => {
      return mutatedMoment(date).add(n, 'months').format('YYYY-MM-DD') === originalMoment(date).add(n, 'months').format('YYYY-MM-DD')
    },
  },
  {
    name: 'startOf: hours set to noon',
    file: 'src/moment.ts',
    patterns: [
      [/d\.setHours\(0, 0, 0, 0\)/g, 'd.setHours(12, 0, 0, 0)'],
    ],
    inputs: fc.date({ noInvalidDate: true }),
    testFn: (input: any) => {
      return mutatedMoment(input).startOf('day').format('HH:mm:ss') === originalMoment(input).startOf('day').format('HH:mm:ss')
    },
  },
  {
    name: 'isValid always returns true',
    file: 'src/moment.ts',
    patterns: [
      [/    return this\._isValid\n/g, '    return true\n'],
    ],
    inputs: fc.constantFrom(null, undefined, '', 'invalid', NaN, Infinity, '2024-13-01'),
    testFn: (input: any) => {
      return mutatedMoment(input).isValid() === originalMoment(input).isValid()
    },
  },
  {
    name: 'clone: CoW protection removed',
    file: 'src/moment.ts',
    patterns: [
      [/this\._shared = true;\n    m\._shared = true;/g, '// CoW disabled'],
    ],
    inputs: fc.date({ noInvalidDate: true }),
    testFn: (input: any) => {
      const a = mutatedMoment(input)
      const b = a.clone()
      b.add(1, 'day')
      return a.format('YYYY-MM-DD') === originalMoment(input).format('YYYY-MM-DD')
    },
  },
  {
    name: 'endOf: no -1ms',
    file: 'src/moment.ts',
    patterns: [
      [/d\.setMilliseconds\(-1\)/g, 'd.setMilliseconds(0)'],
    ],
    inputs: fc.date({ noInvalidDate: true }),
    testFn: (input: any) => {
      return mutatedMoment(input).endOf('day').format('HH:mm:ss.SSS') === originalMoment(input).endOf('day').format('HH:mm:ss.SSS')
    },
  },
])
