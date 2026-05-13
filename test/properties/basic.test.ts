import { describe, test, expect } from 'bun:test'
import fc from 'fast-check'
import _moment from '../../src/index.ts'
import type { MomentStatic } from '../../src/entry/types'
import type { Moment } from '../../src/moment-class'
import type { Duration } from '../../src/duration'
import _originalMoment from '../../moment/moment'
type MomentFn = ((...args: unknown[]) => Moment) & {
  min(...args: unknown[]): Moment;
  max(...args: unknown[]): Moment;
  utc(...args: unknown[]): Moment;
  parseZone(...args: unknown[]): Moment;
  duration(...args: unknown[]): Duration;
  normalizeUnits(unit: string): string;
  relativeTimeThreshold(threshold: string, limit?: number): number | boolean | null | undefined;
  relativeTimeRounding(fn?: Function | boolean): Function | boolean;
}
const moment = _moment as unknown as MomentStatic
const originalMoment = _originalMoment as unknown as MomentFn

describe('Property-based: moment vs original moment', () => {
  const safeMin = new Date('1900-01-01')
  const safeMax = new Date('2100-01-01')
  const safeDates = fc.date({ min: safeMin, max: safeMax, noInvalidDate: true })
  const validDates = fc.date()
  const anyDates = fc.oneof(
    fc.date(),
    fc.constantFrom(new Date(NaN), new Date(0), new Date(8.64e15), new Date(-8.64e15))
  )

  const dayUnits = fc.constantFrom('days', 'months', 'years', 'hours', 'minutes', 'seconds')
  const dayAmounts = fc.integer({ min: -1000, max: 1000 })

  const allUnits = fc.constantFrom(
    'years', 'quarters', 'months', 'weeks', 'days', 'hours', 'minutes', 'seconds', 'milliseconds'
  )
  const durationGetUnits = fc.constantFrom(
    'years', 'months', 'weeks', 'days', 'hours', 'minutes', 'seconds', 'milliseconds'
  )
  const addAmounts = fc.integer({ min: -100, max: 100 })

  const startEndUnits = fc.constantFrom(
    'year', 'quarter', 'month', 'week', 'isoWeek', 'day', 'hour', 'minute', 'second'
  )

  const formatStrings = fc.constantFrom(
    'YYYY-MM-DD',
    'YYYY/MM/DD',
    'MM/DD/YYYY',
    'DD-MM-YYYY',
    'YYYY-MM-DD HH:mm',
    'YYYY-MM-DD HH:mm:ss',
    'MMMM Do YYYY',
    'dddd, MMMM Do YYYY',
    'h:mm A',
    'HH:mm:ss.SSS',
    'LT',
    'L',
    'LL',
    'LLL',
    'LLLL',
  )

  const compUnits = fc.constantFrom('year', 'month', 'week', 'day', 'hour', 'minute', 'second')

  const inclusivityModes = fc.constantFrom('()', '[)', '(]', '[]')

  // ============================================================
  // EXISTING TESTS (preserved)
  // ============================================================

  test('add() matches moment', () => {
    fc.assert(
      fc.property(safeDates, dayAmounts, dayUnits, (date, amount, unit) => {
        const m2 = moment(date).add(amount, unit)
        const mOrig = originalMoment(date).add(amount, unit)
        expect(m2.format('YYYY-MM-DD HH:mm:ss')).toBe(mOrig.format('YYYY-MM-DD HH:mm:ss'))
      }),
      { numRuns: 100 }
    )
  })

  test('format() matches moment', () => {
    fc.assert(
      fc.property(validDates, formatStrings, (date, fmt) => {
        const m2 = moment(date)
        const mOrig = originalMoment(date)
        expect(m2.format(fmt)).toBe(mOrig.format(fmt))
      }),
      { numRuns: 200 }
    )
  })

  test('isValid() matches moment for boundary values', () => {
    fc.assert(
      fc.property(anyDates, (date) => {
        const m2 = moment(date)
        const mOrig = originalMoment(date)
        expect(m2.isValid()).toBe(mOrig.isValid())
      }),
      { numRuns: 200 }
    )
  })

  test('diff() matches moment', () => {
    fc.assert(
      fc.property(safeDates, safeDates, dayUnits, (a, b, unit) => {
        const m2a = moment(a)
        const m2b = moment(b)
        const mOa = originalMoment(a)
        const mOb = originalMoment(b)
        expect(m2a.diff(m2b, unit)).toBe(mOa.diff(mOb, unit))
      }),
      { numRuns: 100 }
    )
  })

  // ============================================================
  // 1. COMPREHENSIVE FORMAT TESTING
  // ============================================================

  test('format with full date patterns matches moment', () => {
    fc.assert(
      fc.property(safeDates, (date) => {
        const m2 = moment(date)
        const mOrig = originalMoment(date)
        expect(m2.format('DD/MM/YYYY')).toBe(mOrig.format('DD/MM/YYYY'))
        expect(m2.format('MM/DD/YYYY')).toBe(mOrig.format('MM/DD/YYYY'))
        expect(m2.format('YYYY-MM-DDTHH:mm:ssZ')).toBe(mOrig.format('YYYY-MM-DDTHH:mm:ssZ'))
      }),
      { numRuns: 50 }
    )
  })

  test('format with locale strings matches moment', () => {
    fc.assert(
      fc.property(safeDates, (date) => {
        const m2 = moment(date)
        const mOrig = originalMoment(date)
        expect(m2.format('LT')).toBe(mOrig.format('LT'))
        expect(m2.format('LTS')).toBe(mOrig.format('LTS'))
        expect(m2.format('L')).toBe(mOrig.format('L'))
        expect(m2.format('LL')).toBe(mOrig.format('LL'))
        expect(m2.format('LLL')).toBe(mOrig.format('LLL'))
        expect(m2.format('LLLL')).toBe(mOrig.format('LLLL'))
      }),
      { numRuns: 50 }
    )
  })

  test('format with ordinal matches moment', () => {
    fc.assert(
      fc.property(safeDates, (date) => {
        const m2 = moment(date)
        const mOrig = originalMoment(date)
        expect(m2.format('MMM Do YYYY')).toBe(mOrig.format('MMM Do YYYY'))
        expect(m2.format('MMMM Do YYYY')).toBe(mOrig.format('MMMM Do YYYY'))
      }),
      { numRuns: 50 }
    )
  })

  test('format with short/ISO/12h patterns matches moment', () => {
    fc.assert(
      fc.property(safeDates, (date) => {
        const m2 = moment(date)
        const mOrig = originalMoment(date)
        expect(m2.format('MMM DD, YY')).toBe(mOrig.format('MMM DD, YY'))
        expect(m2.format('YYYY-MM-DDTHH:mm:ss.SSSZ')).toBe(mOrig.format('YYYY-MM-DDTHH:mm:ss.SSSZ'))
        expect(m2.format('h:mm A')).toBe(mOrig.format('h:mm A'))
        expect(m2.format('h:mm a')).toBe(mOrig.format('h:mm a'))
        expect(m2.format('hh:mm A')).toBe(mOrig.format('hh:mm A'))
      }),
      { numRuns: 50 }
    )
  })

  test('format with timezone patterns matches moment', () => {
    fc.assert(
      fc.property(safeDates, (date) => {
        const m2 = moment(date)
        const mOrig = originalMoment(date)
        expect(m2.format('Z')).toBe(mOrig.format('Z'))
        expect(m2.format('ZZ')).toBe(mOrig.format('ZZ'))
      }),
      { numRuns: 50 }
    )
  })

  test('format with quarter and week matches moment', () => {
    fc.assert(
      fc.property(safeDates, (date) => {
        const m2 = moment(date)
        const mOrig = originalMoment(date)
        expect(m2.format('[Q]Q')).toBe(mOrig.format('[Q]Q'))
        expect(m2.format('GGGG-[W]WW')).toBe(mOrig.format('GGGG-[W]WW'))
      }),
      { numRuns: 50 }
    )
  })

  test('format with unix timestamp matches moment', () => {
    fc.assert(
      fc.property(safeDates, (date) => {
        const m2 = moment(date)
        const mOrig = originalMoment(date)
        expect(m2.format('X')).toBe(mOrig.format('X'))
        expect(m2.format('x')).toBe(mOrig.format('x'))
      }),
      { numRuns: 50 }
    )
  })

  // ============================================================
  // 2. COMPREHENSIVE MANIPULATION TESTING
  // ============================================================

  test('add() with all unit types matches moment', () => {
    fc.assert(
      fc.property(safeDates, addAmounts, allUnits, (date, amount, unit) => {
        const m2 = moment(date).add(amount, unit)
        const mOrig = originalMoment(date).add(amount, unit)
        expect(m2.format('YYYY-MM-DD HH:mm:ss.SSS')).toBe(mOrig.format('YYYY-MM-DD HH:mm:ss.SSS'))
      }),
      { numRuns: 200 }
    )
  })

  test('subtract() with all unit types matches moment', () => {
    fc.assert(
      fc.property(safeDates, addAmounts, allUnits, (date, amount, unit) => {
        const m2 = moment(date).subtract(amount, unit)
        const mOrig = originalMoment(date).subtract(amount, unit)
        expect(m2.format('YYYY-MM-DD HH:mm:ss.SSS')).toBe(mOrig.format('YYYY-MM-DD HH:mm:ss.SSS'))
      }),
      { numRuns: 200 }
    )
  })

  test('startOf() matches moment', () => {
    fc.assert(
      fc.property(safeDates, startEndUnits, (date, unit) => {
        const m2 = moment(date).startOf(unit)
        const mOrig = originalMoment(date).startOf(unit)
        expect(m2.format('YYYY-MM-DD HH:mm:ss.SSS')).toBe(mOrig.format('YYYY-MM-DD HH:mm:ss.SSS'))
      }),
      { numRuns: 200 }
    )
  })

  test('endOf() matches moment', () => {
    fc.assert(
      fc.property(safeDates, startEndUnits, (date, unit) => {
        const m2 = moment(date).endOf(unit)
        const mOrig = originalMoment(date).endOf(unit)
        expect(m2.format('YYYY-MM-DD HH:mm:ss.SSS')).toBe(mOrig.format('YYYY-MM-DD HH:mm:ss.SSS'))
      }),
      { numRuns: 200 }
    )
  })

  test('chained add/subtract matches moment', () => {
    fc.assert(
      fc.property(safeDates, addAmounts, addAmounts, allUnits, allUnits, (date, a1, a2, u1, u2) => {
        const m2 = moment(date).add(a1, u1).subtract(a2, u2).add(1, 'day')
        const mOrig = originalMoment(date).add(a1, u1).subtract(a2, u2).add(1, 'day')
        expect(m2.format('YYYY-MM-DD HH:mm:ss.SSS')).toBe(mOrig.format('YYYY-MM-DD HH:mm:ss.SSS'))
      }),
      { numRuns: 100 }
    )
  })

  // ============================================================
  // 3. GETTER/SETTER TESTING
  // ============================================================

  test('year getter/setter matches moment', () => {
    fc.assert(
      fc.property(safeDates, fc.integer({ min: 1900, max: 2100 }), (date, newYear) => {
        const m2 = moment(date)
        const mOrig = originalMoment(date)
        expect(m2.year()).toBe(mOrig.year())
        m2.year(newYear)
        mOrig.year(newYear)
        expect(m2.year()).toBe(mOrig.year())
        expect(m2.format('YYYY-MM-DD')).toBe(mOrig.format('YYYY-MM-DD'))
      }),
      { numRuns: 100 }
    )
  })

  test('month getter/setter matches moment', () => {
    fc.assert(
      fc.property(safeDates, fc.integer({ min: 0, max: 11 }), (date, newMonth) => {
        const m2 = moment(date)
        const mOrig = originalMoment(date)
        expect(m2.month()).toBe(mOrig.month())
        m2.month(newMonth)
        mOrig.month(newMonth)
        expect(m2.month()).toBe(mOrig.month())
        expect(m2.format('YYYY-MM-DD')).toBe(mOrig.format('YYYY-MM-DD'))
      }),
      { numRuns: 100 }
    )
  })

  test('date getter/setter matches moment', () => {
    fc.assert(
      fc.property(safeDates, fc.integer({ min: 1, max: 28 }), (date, newDate) => {
        const m2 = moment(date)
        const mOrig = originalMoment(date)
        expect(m2.date()).toBe(mOrig.date())
        m2.date(newDate)
        mOrig.date(newDate)
        expect(m2.date()).toBe(mOrig.date())
      }),
      { numRuns: 100 }
    )
  })

  test('hour/minute/second/millisecond getter/setter matches moment', () => {
    fc.assert(
      fc.property(safeDates, (date) => {
        const m2 = moment(date)
        const mOrig = originalMoment(date)
        expect(m2.hour()).toBe(mOrig.hour())
        expect(m2.minute()).toBe(mOrig.minute())
        expect(m2.second()).toBe(mOrig.second())
        expect(m2.millisecond()).toBe(mOrig.millisecond())
        m2.hour(10)
        mOrig.hour(10)
        expect(m2.hour()).toBe(mOrig.hour())
        m2.minute(30)
        mOrig.minute(30)
        expect(m2.minute()).toBe(mOrig.minute())
        m2.second(45)
        mOrig.second(45)
        expect(m2.second()).toBe(mOrig.second())
        m2.millisecond(500)
        mOrig.millisecond(500)
        expect(m2.millisecond()).toBe(mOrig.millisecond())
      }),
      { numRuns: 50 }
    )
  })

  test('day getter matches moment', () => {
    fc.assert(
      fc.property(safeDates, (date) => {
        expect(moment(date).day()).toBe(originalMoment(date).day())
      }),
      { numRuns: 50 }
    )
  })

  test('weekday getter/setter matches moment', () => {
    fc.assert(
      fc.property(safeDates, fc.integer({ min: 0, max: 6 }), (date, newWday) => {
        const m2 = moment(date)
        const mOrig = originalMoment(date)
        expect(m2.weekday()).toBe(mOrig.weekday())
        m2.weekday(newWday)
        mOrig.weekday(newWday)
        expect(m2.format('YYYY-MM-DD')).toBe(mOrig.format('YYYY-MM-DD'))
      }),
      { numRuns: 100 }
    )
  })

  test('isoWeekday getter/setter matches moment', () => {
    fc.assert(
      fc.property(safeDates, fc.integer({ min: 1, max: 7 }), (date, newIsoWday) => {
        const m2 = moment(date)
        const mOrig = originalMoment(date)
        expect(m2.isoWeekday()).toBe(mOrig.isoWeekday())
        m2.isoWeekday(newIsoWday)
        mOrig.isoWeekday(newIsoWday)
        expect(m2.format('YYYY-MM-DD')).toBe(mOrig.format('YYYY-MM-DD'))
      }),
      { numRuns: 100 }
    )
  })

  test('week getter/setter matches moment', () => {
    fc.assert(
      fc.property(safeDates, fc.integer({ min: 1, max: 53 }), (date, newWeek) => {
        const m2 = moment(date)
        const mOrig = originalMoment(date)
        expect(m2.week()).toBe(mOrig.week())
        m2.week(newWeek)
        mOrig.week(newWeek)
        expect(m2.format('YYYY-MM-DD')).toBe(mOrig.format('YYYY-MM-DD'))
      }),
      { numRuns: 100 }
    )
  })

  test('isoWeek getter/setter matches moment', () => {
    fc.assert(
      fc.property(safeDates, fc.integer({ min: 1, max: 53 }), (date, newIsoWeek) => {
        const m2 = moment(date)
        const mOrig = originalMoment(date)
        expect(m2.isoWeek()).toBe(mOrig.isoWeek())
        m2.isoWeek(newIsoWeek)
        mOrig.isoWeek(newIsoWeek)
        expect(m2.format('YYYY-MM-DD')).toBe(mOrig.format('YYYY-MM-DD'))
      }),
      { numRuns: 100 }
    )
  })

  test('dayOfYear getter/setter matches moment', () => {
    fc.assert(
      fc.property(safeDates, fc.integer({ min: 1, max: 365 }), (date, newDoy) => {
        const m2 = moment(date)
        const mOrig = originalMoment(date)
        expect(m2.dayOfYear()).toBe(mOrig.dayOfYear())
        m2.dayOfYear(newDoy)
        mOrig.dayOfYear(newDoy)
        expect(m2.format('YYYY-MM-DD')).toBe(mOrig.format('YYYY-MM-DD'))
      }),
      { numRuns: 100 }
    )
  })

  test('quarter getter/setter matches moment', () => {
    fc.assert(
      fc.property(safeDates, fc.integer({ min: 1, max: 4 }), (date, newQ) => {
        const m2 = moment(date)
        const mOrig = originalMoment(date)
        expect(m2.quarter()).toBe(mOrig.quarter())
        m2.quarter(newQ)
        mOrig.quarter(newQ)
        expect(m2.quarter()).toBe(mOrig.quarter())
      }),
      { numRuns: 100 }
    )
  })

  // ============================================================
  // 4. COMPARISON TESTING
  // ============================================================

  test('isBefore matches moment', () => {
    fc.assert(
      fc.property(safeDates, safeDates, (a, b) => {
        expect(moment(a).isBefore(moment(b))).toBe(originalMoment(a).isBefore(originalMoment(b)))
      }),
      { numRuns: 100 }
    )
  })

  test('isBefore with unit matches moment', () => {
    fc.assert(
      fc.property(safeDates, safeDates, compUnits, (a, b, unit) => {
        expect(moment(a).isBefore(moment(b), unit)).toBe(originalMoment(a).isBefore(originalMoment(b), unit))
      }),
      { numRuns: 100 }
    )
  })

  test('isAfter matches moment', () => {
    fc.assert(
      fc.property(safeDates, safeDates, (a, b) => {
        expect(moment(a).isAfter(moment(b))).toBe(originalMoment(a).isAfter(originalMoment(b)))
      }),
      { numRuns: 100 }
    )
  })

  test('isAfter with unit matches moment', () => {
    fc.assert(
      fc.property(safeDates, safeDates, compUnits, (a, b, unit) => {
        expect(moment(a).isAfter(moment(b), unit)).toBe(originalMoment(a).isAfter(originalMoment(b), unit))
      }),
      { numRuns: 100 }
    )
  })

  test('isSame matches moment', () => {
    fc.assert(
      fc.property(safeDates, safeDates, (a, b) => {
        expect(moment(a).isSame(moment(b))).toBe(originalMoment(a).isSame(originalMoment(b)))
      }),
      { numRuns: 100 }
    )
  })

  test('isSame with unit matches moment', () => {
    fc.assert(
      fc.property(safeDates, safeDates, compUnits, (a, b, unit) => {
        expect(moment(a).isSame(moment(b), unit)).toBe(originalMoment(a).isSame(originalMoment(b), unit))
      }),
      { numRuns: 100 }
    )
  })

  test('isSameOrBefore matches moment', () => {
    fc.assert(
      fc.property(safeDates, safeDates, (a, b) => {
        expect(moment(a).isSameOrBefore(moment(b))).toBe(originalMoment(a).isSameOrBefore(originalMoment(b)))
      }),
      { numRuns: 100 }
    )
  })

  test('isSameOrAfter matches moment', () => {
    fc.assert(
      fc.property(safeDates, safeDates, (a, b) => {
        expect(moment(a).isSameOrAfter(moment(b))).toBe(originalMoment(a).isSameOrAfter(originalMoment(b)))
      }),
      { numRuns: 100 }
    )
  })

  test('isBetween matches moment', () => {
    fc.assert(
      fc.property(safeDates, safeDates, safeDates, compUnits, inclusivityModes, (a, b, c, unit, mode) => {
        const from = moment.min(moment(b), moment(c))
        const to = moment.max(moment(b), moment(c))
        const fromO = originalMoment.min(originalMoment(b), originalMoment(c))
        const toO = originalMoment.max(originalMoment(b), originalMoment(c))
        expect(moment(a).isBetween(from, to, unit, mode)).toBe(
          originalMoment(a).isBetween(fromO, toO, unit, mode)
        )
      }),
      { numRuns: 200 }
    )
  })

  test('diff with float matches moment', () => {
    fc.assert(
      fc.property(safeDates, safeDates, allUnits, (a, b, unit) => {
        const m2a = moment(a)
        const m2b = moment(b)
        const mOa = originalMoment(a)
        const mOb = originalMoment(b)
        const diff2 = m2a.diff(m2b, unit, true)
        const diffO = mOa.diff(mOb, unit, true)
        if (Math.abs(diff2) < 1e-6) {
          expect(Math.abs(diffO)).toBeLessThan(1e-6)
        } else if (Math.abs(diffO) < 1e-6) {
          expect(Math.abs(diff2)).toBeLessThan(1e-6)
        } else {
          expect(Math.abs(diff2 / diffO - 1)).toBeLessThan(1e-4)
        }
      }),
      { numRuns: 100 }
    )
  })

  test('diff for all unit types matches moment', () => {
    fc.assert(
      fc.property(safeDates, safeDates, allUnits, (a, b, unit) => {
        const m2a = moment(a)
        const m2b = moment(b)
        const mOa = originalMoment(a)
        const mOb = originalMoment(b)
        expect(m2a.diff(m2b, unit)).toBe(mOa.diff(mOb, unit))
      }),
      { numRuns: 100 }
    )
  })

  // ============================================================
  // 5. DISPLAY TESTING
  // ============================================================

  test('from() with reference matches moment', () => {
    fc.assert(
      fc.property(safeDates, safeDates, (date, ref) => {
        const m2 = moment(date)
        const mOrig = originalMoment(date)
        const ref2 = moment(ref)
        const refOrig = originalMoment(ref)
        expect(m2.from(ref2)).toBe(mOrig.from(refOrig))
      }),
      { numRuns: 100 }
    )
  })

  test('to() with reference matches moment', () => {
    fc.assert(
      fc.property(safeDates, safeDates, (date, ref) => {
        const m2 = moment(date)
        const mOrig = originalMoment(date)
        const ref2 = moment(ref)
        const refOrig = originalMoment(ref)
        expect(m2.to(ref2)).toBe(mOrig.to(refOrig))
      }),
      { numRuns: 100 }
    )
  })

  test('calendar() with reference matches moment', () => {
    fc.assert(
      fc.property(safeDates, safeDates, (date, ref) => {
        const m2 = moment(date)
        const mOrig = originalMoment(date)
        const ref2 = moment(ref)
        const refOrig = originalMoment(ref)
        expect(m2.calendar(ref2)).toBe(mOrig.calendar(refOrig))
      }),
      { numRuns: 100 }
    )
  })

  test('toISOString matches moment', () => {
    fc.assert(
      fc.property(safeDates, (date) => {
        expect(moment(date).toISOString()).toBe(originalMoment(date).toISOString())
      }),
      { numRuns: 100 }
    )
  })

  test('toJSON matches moment', () => {
    fc.assert(
      fc.property(safeDates, (date) => {
        expect(moment(date).toJSON()).toBe(originalMoment(date).toJSON())
      }),
      { numRuns: 100 }
    )
  })

  test('toDate matches moment', () => {
    fc.assert(
      fc.property(safeDates, (date) => {
        expect(moment(date).toDate().getTime()).toBe(originalMoment(date).toDate().getTime())
      }),
      { numRuns: 100 }
    )
  })

  test('toArray matches moment', () => {
    fc.assert(
      fc.property(safeDates, (date) => {
        expect(moment(date).toArray()).toEqual(originalMoment(date).toArray())
      }),
      { numRuns: 100 }
    )
  })

  test('toObject matches moment', () => {
    fc.assert(
      fc.property(safeDates, (date) => {
        expect(moment(date).toObject()).toEqual(originalMoment(date).toObject())
      }),
      { numRuns: 100 }
    )
  })

  test('toString matches moment', () => {
    fc.assert(
      fc.property(safeDates, (date) => {
        expect(moment(date).toString()).toBe(originalMoment(date).toString())
      }),
      { numRuns: 100 }
    )
  })

  test('valueOf matches moment', () => {
    fc.assert(
      fc.property(safeDates, (date) => {
        expect(moment(date).valueOf()).toBe(originalMoment(date).valueOf())
      }),
      { numRuns: 100 }
    )
  })

  test('unix matches moment', () => {
    fc.assert(
      fc.property(safeDates, (date) => {
        expect(moment(date).unix()).toBe(originalMoment(date).unix())
      }),
      { numRuns: 100 }
    )
  })

  test('daysInMonth matches moment', () => {
    fc.assert(
      fc.property(safeDates, (date) => {
        expect(moment(date).daysInMonth()).toBe(originalMoment(date).daysInMonth())
      }),
      { numRuns: 100 }
    )
  })

  test('isLeapYear matches moment', () => {
    fc.assert(
      fc.property(safeDates, (date) => {
        expect(moment(date).isLeapYear()).toBe(originalMoment(date).isLeapYear())
      }),
      { numRuns: 100 }
    )
  })

  test('isDST matches moment', () => {
    fc.assert(
      fc.property(safeDates, (date) => {
        expect(moment(date).isDST()).toBe(originalMoment(date).isDST())
      }),
      { numRuns: 100 }
    )
  })

  // ============================================================
  // 6. UTC/OFFSET TESTING
  // ============================================================

  test('moment.utc() vs originalMoment.utc()', () => {
    fc.assert(
      fc.property(safeDates, (date) => {
        const m2 = moment.utc(date)
        const mOrig = originalMoment.utc(date)
        expect(m2.format('YYYY-MM-DDTHH:mm:ss.SSSZ')).toBe(mOrig.format('YYYY-MM-DDTHH:mm:ss.SSSZ'))
        expect(m2.isUTC()).toBe(mOrig.isUTC())
      }),
      { numRuns: 100 }
    )
  })

  test('moment().utc() matches moment', () => {
    fc.assert(
      fc.property(safeDates, (date) => {
        const m2 = moment(date).utc()
        const mOrig = originalMoment(date).utc()
        expect(m2.format('YYYY-MM-DDTHH:mm:ss.SSSZ')).toBe(mOrig.format('YYYY-MM-DDTHH:mm:ss.SSSZ'))
        expect(m2.isUTC()).toBe(mOrig.isUTC())
      }),
      { numRuns: 100 }
    )
  })

  test('utcOffset getter matches moment', () => {
    fc.assert(
      fc.property(safeDates, (date) => {
        expect(moment(date).utcOffset()).toBe(originalMoment(date).utcOffset())
      }),
      { numRuns: 100 }
    )
  })

  test('isUTC/isLocal/isUtcOffset matches moment', () => {
    fc.assert(
      fc.property(safeDates, (date) => {
        const m2 = moment(date)
        const mOrig = originalMoment(date)
        expect(m2.isUTC()).toBe(mOrig.isUTC())
        expect(m2.isLocal()).toBe(mOrig.isLocal())
        expect(m2.isUtcOffset()).toBe(mOrig.isUtcOffset())
      }),
      { numRuns: 100 }
    )
  })

  test('format output with UTC mode matches moment', () => {
    fc.assert(
      fc.property(safeDates, (date) => {
        const m2 = moment.utc(date)
        const mOrig = originalMoment.utc(date)
        expect(m2.format('YYYY-MM-DD HH:mm:ss')).toBe(mOrig.format('YYYY-MM-DD HH:mm:ss'))
      }),
      { numRuns: 100 }
    )
  })

  // ============================================================
  // 7. DURATION TESTING
  // ============================================================

  test('moment.duration(n, unit) matches originalMoment.duration(n, unit)', () => {
    fc.assert(
      fc.property(addAmounts, allUnits, (n, unit) => {
        const d2 = moment.duration(n, unit)
        const dOrig = originalMoment.duration(n, unit)
        expect(d2.as(unit)).toBe(dOrig.as(unit))
        expect(d2.toISOString()).toBe(dOrig.toISOString())
      }),
      { numRuns: 200 }
    )
  })

  test('moment.duration() with object matches original', () => {
    fc.assert(
      fc.property(
        fc.record({
          years: fc.integer({ min: -10, max: 10 }),
          months: fc.integer({ min: -10, max: 10 }),
          days: fc.integer({ min: -100, max: 100 }),
          hours: fc.integer({ min: -100, max: 100 }),
          minutes: fc.integer({ min: -100, max: 100 }),
          seconds: fc.integer({ min: -100, max: 100 }),
        }),
        (obj) => {
          const d2 = moment.duration({ ...obj })
          const dOrig = originalMoment.duration({ ...obj })
          expect(d2.toISOString()).toBe(dOrig.toISOString())
          expect(d2.asMilliseconds()).toBe(dOrig.asMilliseconds())
        }
      ),
      { numRuns: 100 }
    )
  })

  test('duration get matches original', () => {
    fc.assert(
      fc.property(addAmounts, allUnits, durationGetUnits, (n, unit, getUnit) => {
        const d2 = moment.duration(n, unit)
        const dOrig = originalMoment.duration(n, unit)
        expect(d2.get(getUnit)).toBe(dOrig.get(getUnit))
      }),
      { numRuns: 200 }
    )
  })

  test('duration as(unit) matches original', () => {
    fc.assert(
      fc.property(addAmounts, allUnits, allUnits, (n, unit, asUnit) => {
        const d2 = moment.duration(n, unit)
        const dOrig = originalMoment.duration(n, unit)
        expect(d2.as(asUnit)).toBe(dOrig.as(asUnit))
      }),
      { numRuns: 200 }
    )
  })

  test('duration valueOf matches original', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: -100000000, max: 100000000 }),
        (n) => {
          expect(moment.duration(n).valueOf()).toBe(originalMoment.duration(n).valueOf())
        }
      ),
      { numRuns: 100 }
    )
  })

  test('duration arithmetic matches original', () => {
    fc.assert(
      fc.property(addAmounts, addAmounts, allUnits, allUnits, (a1, a2, u1, u2) => {
        const d2 = moment.duration(a1, u1).add(a2, u2)
        const dOrig = originalMoment.duration(a1, u1).add(a2, u2)
        expect(d2.toISOString()).toBe(dOrig.toISOString())
      }),
      { numRuns: 100 }
    )
  })

  test('duration subtract matches original', () => {
    fc.assert(
      fc.property(addAmounts, addAmounts, allUnits, allUnits, (a1, a2, u1, u2) => {
        const d2 = moment.duration(a1, u1).subtract(a2, u2)
        const dOrig = originalMoment.duration(a1, u1).subtract(a2, u2)
        expect(d2.toISOString()).toBe(dOrig.toISOString())
      }),
      { numRuns: 100 }
    )
  })

  // ============================================================
  // 8. PARSING FLAGS
  // ============================================================

  test('parsingFlags matches moment', () => {
    fc.assert(
      fc.property(
        fc.oneof(
          fc.constantFrom(
            '2024-01-01',
            '2024-13-01',
            '2024-01-32',
            'not a date',
            '',
            '2024-01-01T00:00:00',
          ),
        ),
        (input) => {
          const m2 = moment(input)
          const mOrig = originalMoment(input)
          const f2 = m2.parsingFlags()
          const fOrig = mOrig.parsingFlags()
          expect(f2.invalidMonth).toBe(fOrig.invalidMonth)
          expect(f2.unusedTokens).toEqual(fOrig.unusedTokens)
          expect(f2.userInvalidated).toBe(fOrig.userInvalidated)
        }
      ),
      { numRuns: 100 }
    )
  })

  test('parsingFlags with format string matches moment', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(
          '2024-01-01',
          '2024/01/01',
          '01-01-2024',
          '01/01/2024',
        ),
        fc.constantFrom('YYYY-MM-DD', 'MM/DD/YYYY'),
        (input, fmt) => {
          const m2 = moment(input, fmt)
          const mOrig = originalMoment(input, fmt)
          const f2 = m2.parsingFlags()
          const fOrig = mOrig.parsingFlags()
          expect(f2.unusedTokens).toEqual(fOrig.unusedTokens)
          expect(Math.abs((f2.charsLeftOver as number) - (fOrig.charsLeftOver as number))).toBeLessThanOrEqual(1)
        }
      ),
      { numRuns: 100 }
    )
  })

  // ============================================================
  // 9. WEEKS/YEARS
  // ============================================================

  test('weeksInYear matches moment', () => {
    fc.assert(
      fc.property(safeDates, (date) => {
        expect(moment(date).weeksInYear()).toBe(originalMoment(date).weeksInYear())
      }),
      { numRuns: 100 }
    )
  })

  test('isoWeeksInYear matches moment', () => {
    fc.assert(
      fc.property(safeDates, (date) => {
        expect(moment(date).isoWeeksInYear()).toBe(originalMoment(date).isoWeeksInYear())
      }),
      { numRuns: 100 }
    )
  })

  test('year length via daysInMonth matches moment', () => {
    fc.assert(
      fc.property(safeDates, (date) => {
        const m2 = moment(date)
        const mOrig = originalMoment(date)
        for (let month = 0; month < 12; month++) {
          expect(m2.month(month).daysInMonth()).toBe(mOrig.month(month).daysInMonth())
        }
      }),
      { numRuns: 100 }
    )
  })

  // ============================================================
  // 10. STRING & BIGINT INPUTS
  // ============================================================

  test('string inputs with various content', () => {
    fc.assert(
      fc.property(
        fc.oneof(
          fc.constantFrom(
            '2024-01-01', '2024-01-01T00:00:00',
            '2024-01-01T00:00:00Z', '2024-01-01T12:00:00.000+05:30',
            '2024-01-01T00:00:00.000Z', '2024-01-01T00:00:00.000',
            '2024-01',
          ),
        ),
        (str) => {
          const m2 = moment(str)
          const mOrig = originalMoment(str)
          expect(m2.isValid()).toBe(mOrig.isValid())
          if (mOrig.isValid()) {
            expect(m2.valueOf()).toBe(mOrig.valueOf())
          }
        }
      ),
      { numRuns: 50 }
    )
  })

  test('bigInt inputs', () => {
    fc.assert(
      fc.property(
        fc.bigInt({ min: -100000000000n, max: 100000000000n }),
        (n) => {
          const m2 = moment(Number(n))
          const mOrig = originalMoment(Number(n))
          expect(m2.isValid()).toBe(mOrig.isValid())
          if (mOrig.isValid()) {
            expect(m2.valueOf()).toBe(mOrig.valueOf())
          }
        }
      ),
      { numRuns: 100 }
    )
  })

  test('duration with bigInt milliseconds', () => {
    fc.assert(
      fc.property(
        fc.bigInt({ min: -10000000n, max: 10000000n }),
        (n) => {
          const d2 = moment.duration(Number(n))
          const dOrig = originalMoment.duration(Number(n))
          expect(d2.toISOString()).toBe(dOrig.toISOString())
        }
      ),
      { numRuns: 100 }
    )
  })

  // ============================================================
  // 11. COMPREHENSIVE FORMAT TOKENS
  // ============================================================

  const tokenFormats = fc.constantFrom(
    'YYYY', 'YY',
    'MMMM', 'MMM', 'MM', 'M',
    'DDDD', 'DDD', 'DD', 'D', 'Do',
    'dddd', 'ddd', 'dd',
    'HH', 'H', 'hh', 'h',
    'mm', 'm',
    'ss', 's',
    'SSS', 'SS', 'S',
    'A', 'a',
    'ZZ', 'Z',
    'X', 'x',
    'Q',
  )

  test('format with individual tokens matches moment', () => {
    fc.assert(
      fc.property(safeDates, tokenFormats, (date, token) => {
        const m2 = moment(date)
        const mOrig = originalMoment(date)
        expect(m2.format(token)).toBe(mOrig.format(token))
      }),
      { numRuns: 300 }
    )
  })

  test('format with combined tokens matches moment', () => {
    fc.assert(
      fc.property(safeDates, (date) => {
        const m2 = moment(date)
        const mOrig = originalMoment(date)
        expect(m2.format('YYYY-MM-DDTHH:mm:ss.SSSZ')).toBe(mOrig.format('YYYY-MM-DDTHH:mm:ss.SSSZ'))
        expect(m2.format('dddd, MMMM Do YYYY, h:mm:ss A')).toBe(mOrig.format('dddd, MMMM Do YYYY, h:mm:ss A'))
        expect(m2.format('[Year:] YYYY, [Quarter] Q, [Week] WW')).toBe(mOrig.format('[Year:] YYYY, [Quarter] Q, [Week] WW'))
        expect(m2.format('GGGG-[W]WW')).toBe(mOrig.format('GGGG-[W]WW'))
        expect(m2.format('ddd, DD MMM YYYY HH:mm:ss ZZ')).toBe(mOrig.format('ddd, DD MMM YYYY HH:mm:ss ZZ'))
      }),
      { numRuns: 50 }
    )
  })

  // ============================================================
  // 12. ZONE SWITCHING
  // ============================================================

  test('zone switching matches moment', () => {
    fc.assert(
      fc.property(safeDates, (date) => {
        const m2 = moment(date)
        const mOrig = originalMoment(date)
        expect(m2.isUTC()).toBe(mOrig.isUTC())
        expect(m2.isLocal()).toBe(mOrig.isLocal())
        const m2u = moment(date).utc()
        const mOu = originalMoment(date).utc()
        expect(m2u.utcOffset()).toBe(mOu.utcOffset())
        expect(m2u.isUTC()).toBe(mOu.isUTC())
      }),
      { numRuns: 100 }
    )
  })

  test('clone matches moment', () => {
    fc.assert(
      fc.property(safeDates, (date) => {
        const m2 = moment(date).clone()
        const mOrig = originalMoment(date).clone()
        expect(m2.format()).toBe(mOrig.format())
        expect(m2.valueOf()).toBe(mOrig.valueOf())
      }),
      { numRuns: 100 }
    )
  })

  // ============================================================
  // 13. fc.string() — ARBITRARY STRING INPUTS
  // ============================================================

  test('ISO-like string inputs match moment', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(
          '2024-01-01', '2024-01-01T00:00:00', '2024-01-01T00:00:00Z',
          '2024-01-01T12:00:00.000+05:30', '2024-01-01T00:00:00.000Z',
          '2024-06-15', '2024-12-31', '2024-02-29', '2023-02-28',
          '2024-01', '2024-01-01T00:00:00.000', '2024-01-01T00:00:00+00:00',
          '2024-01-01T12:30:45.123Z', '2024-01-01T12:30:45.123+05:30',
          '2024-01-01T00:00:00-05:00', '2024-01-01T00:00:00+0000',
        ),
        (s) => {
          const m2 = moment(s)
          const mOrig = originalMoment(s)
          expect(m2.isValid()).toBe(mOrig.isValid())
          if (mOrig.isValid()) {
            expect(m2.valueOf()).toBe(mOrig.valueOf())
          }
        }
      ),
      { numRuns: 100 }
    )
  })

  test('string inputs with format string match moment validity', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(
          '', ' ', 'abc', 'hello', '01', '99', '24', '24-01-01',
          '2024/01/01', '01-01-2024', '01/01/2024',
          '2024-13-01', '2024-01-32', 'not-a-date',
        ),
        fc.constantFrom('YYYY-MM-DD', 'MM/DD/YYYY', 'HH:mm:ss', 'YYYY-MM-DD HH:mm:ss'),
        (s, fmt) => {
          expect(moment(s, fmt).isValid()).toBe(originalMoment(s, fmt).isValid())
        }
      ),
      { numRuns: 100 }
    )
  })

  // ============================================================
  // 14. EXTENDED FORMAT TOKENS (all tokens not yet individually covered)
  // ============================================================

  const extendedTokens = fc.constantFrom(
    'Y', 'YYYYY', 'YYYYYY',
    'Mo', 'do', 'd', 'e', 'E',
    'w', 'ww', 'wo', 'W', 'WW', 'Wo',
    'k', 'kk',
    'Qo', 'DDDo',
    'GG', 'GGGG', 'GGGGG',
    'gg', 'gggg', 'ggggg',
    'N', 'NN', 'NNN', 'NNNN', 'NNNNN',
    'y',
    'hmm', 'hmmss', 'Hmm', 'Hmmss',
  )

  test('format with extended individual tokens matches moment', () => {
    fc.assert(
      fc.property(safeDates, extendedTokens, (date, token) => {
        const m2 = moment(date)
        const mOrig = originalMoment(date)
        expect(m2.format(token)).toBe(mOrig.format(token))
      }),
      { numRuns: 500 }
    )
  })

  // ============================================================
  // 15. startOf/endOf 全単位 (extra coverage)
  // ============================================================

  test('startOf for all units uses local-safe comparison', () => {
    fc.assert(
      fc.property(safeDates, startEndUnits, (date, unit) => {
        const m2 = moment(date).startOf(unit)
        const mOrig = originalMoment(date).startOf(unit)
        expect(m2.valueOf()).toBe(mOrig.valueOf())
        expect(m2.format('YYYY-MM-DD HH:mm:ss.SSS')).toBe(mOrig.format('YYYY-MM-DD HH:mm:ss.SSS'))
      }),
      { numRuns: 200 }
    )
  })

  test('endOf for all units uses local-safe comparison', () => {
    fc.assert(
      fc.property(safeDates, startEndUnits, (date, unit) => {
        const m2 = moment(date).endOf(unit)
        const mOrig = originalMoment(date).endOf(unit)
        expect(m2.valueOf()).toBe(mOrig.valueOf())
        expect(m2.format('YYYY-MM-DD HH:mm:ss.SSS')).toBe(mOrig.format('YYYY-MM-DD HH:mm:ss.SSS'))
      }),
      { numRuns: 200 }
    )
  })

  test('startOf with isoWeek matches moment', () => {
    fc.assert(
      fc.property(safeDates, (date) => {
        const m2 = moment(date).startOf('isoWeek')
        const mOrig = originalMoment(date).startOf('isoWeek')
        expect(m2.format('YYYY-MM-DD')).toBe(mOrig.format('YYYY-MM-DD'))
        expect(m2.valueOf()).toBe(mOrig.valueOf())
      }),
      { numRuns: 100 }
    )
  })

  test('endOf with isoWeek matches moment', () => {
    fc.assert(
      fc.property(safeDates, (date) => {
        const m2 = moment(date).endOf('isoWeek')
        const mOrig = originalMoment(date).endOf('isoWeek')
        expect(m2.format('YYYY-MM-DD')).toBe(mOrig.format('YYYY-MM-DD'))
        expect(m2.valueOf()).toBe(mOrig.valueOf())
      }),
      { numRuns: 100 }
    )
  })

  // ============================================================
  // 16. RELATIVE TIME THRESHOLD / ROUNDING
  // ============================================================

  const thresholdKeys = fc.constantFrom('ss', 's', 'm', 'h', 'd', 'w', 'M')
  const thresholdLimits = fc.integer({ min: 1, max: 100 })

  test('relativeTimeThreshold get/set matches moment', () => {
    fc.assert(
      fc.property(thresholdKeys, thresholdLimits, (key, limit) => {
        const saved = moment.relativeTimeThreshold(key)
        const savedOrig = originalMoment.relativeTimeThreshold(key)
        expect(saved).toBe(savedOrig)

        const setResult = moment.relativeTimeThreshold(key, limit)
        const setResultOrig = originalMoment.relativeTimeThreshold(key, limit)
        expect(setResult).toBe(setResultOrig)

        const got = moment.relativeTimeThreshold(key)
        const gotOrig = originalMoment.relativeTimeThreshold(key)
        expect(got).toBe(gotOrig)

        moment.relativeTimeThreshold(key, saved as number)
        originalMoment.relativeTimeThreshold(key, savedOrig as number)
      }),
      { numRuns: 100 }
    )
  })

  test('relativeTimeThreshold with null key matches moment', () => {
    expect(moment.relativeTimeThreshold('w')).toBe(originalMoment.relativeTimeThreshold('w'))
  })

  test('relativeTimeThreshold with unknown key returns false', () => {
    expect(moment.relativeTimeThreshold('foo')).toBe(originalMoment.relativeTimeThreshold('foo'))
  })

  test('relativeTimeRounding get/set matches moment', () => {
    fc.assert(
      fc.property(fc.integer({ min: -1000, max: 1000 }), (n) => {
        const fn = () => Math.ceil(n)
        const result = moment.relativeTimeRounding(fn)
        const resultOrig = originalMoment.relativeTimeRounding(fn)
        expect(result).toBe(resultOrig)

        expect(moment.duration(n).humanize()).toBe(originalMoment.duration(n).humanize())

        moment.relativeTimeRounding(Math.round)
        originalMoment.relativeTimeRounding(Math.round)
      }),
      { numRuns: 50 }
    )
  })

  test('relativeTimeRounding with false matches moment', () => {
    const result = moment.relativeTimeRounding(false)
    const resultOrig = originalMoment.relativeTimeRounding(false)
    expect(result).toBe(resultOrig)

    moment.relativeTimeRounding(Math.round)
    originalMoment.relativeTimeRounding(Math.round)
  })

  // ============================================================
  // 17. NORMALIZE UNITS
  // ============================================================

  const unitAliases = fc.constantFrom(
    'Y', 'y', 'years', 'year',
    'M', 'months', 'month',
    'D', 'd', 'days', 'day', 'date', 'dates',
    'h', 'hours', 'hour',
    'm', 'minutes', 'minute',
    's', 'seconds', 'second',
    'ms', 'milliseconds', 'millisecond',
    'w', 'W', 'weeks', 'week',
    'weekday', 'weekdays', 'e',
    'isoWeek', 'isoWeeks',
    'isoWeekday', 'isoWeekdays', 'E',
    'quarter', 'quarters', 'Q',
    'dayOfYear', 'dayOfYears', 'DDD',
    'gg', 'weekYear', 'weekYears',
    'GG', 'isoWeekYear', 'isoWeekYears',
  )

  test('normalizeUnits matches moment', () => {
    fc.assert(
      fc.property(unitAliases, (alias) => {
        expect(moment.normalizeUnits(alias)).toBe(originalMoment.normalizeUnits(alias))
      }),
      { numRuns: 100 }
    )
  })

  test('normalizeUnits with empty/unknown input matches moment', () => {
    fc.assert(
      fc.property(fc.constantFrom('', 'foo', 'bar', 'xyz', '123'), (input) => {
        expect(moment.normalizeUnits(input)).toBe(originalMoment.normalizeUnits(input))
      }),
      { numRuns: 50 }
    )
  })

  // ============================================================
  // 18. DAYS IN MONTH / LEAP YEAR (edge branches)
  // ============================================================

  test('daysInMonth with negative/overflow month matches moment', () => {
    fc.assert(
      fc.property(fc.integer({ min: -24, max: 24 }), (month) => {
        const d = moment({ year: 2024, month: 0 })
        const dOrig = originalMoment({ year: 2024, month: 0 })
        expect(d.month(month).daysInMonth()).toBe(dOrig.month(month).daysInMonth())
      }),
      { numRuns: 50 }
    )
  })

  test('isLeapYear with known years matches moment', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(
          0, 1, 100, 400, 1600,
          1700, 1800, 1900, 2000, 2100,
          2023, 2024, -1, -100, -400, -1600,
        ),
        (year) => {
          const m2 = moment.utc([year, 6, 1])
          const mOrig = originalMoment.utc([year, 6, 1])
          expect(m2.isLeapYear()).toBe(mOrig.isLeapYear())
        }
      ),
      { numRuns: 50 }
    )
  })
})
