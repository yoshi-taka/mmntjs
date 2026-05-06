import { describe, test, expect } from 'bun:test'
import fc from 'fast-check'
import _moment from '../../src/index.ts'
import type { MomentStatic } from '../../src/entry/types'
import type { Moment } from '../../src/moment_fixed'
import type { Duration } from '../../src/duration_fixed'
import _originalMoment from '../../moment/moment.js'
type MomentFn = ((...args: unknown[]) => Moment) & {
  min(...args: unknown[]): Moment;
  max(...args: unknown[]): Moment;
  utc(...args: unknown[]): Moment;
  parseZone(...args: unknown[]): Moment;
  duration(...args: unknown[]): Duration;
  normalizeUnits(unit: string): string;
}
const moment = _moment as unknown as MomentStatic
const originalMoment = _originalMoment as unknown as MomentFn

function normalizeZero(value: number): number {
  return Object.is(value, -0) ? 0 : value
}

describe('Metamorphic properties', () => {
  const safeMin = new Date('1900-01-01T00:00:00.000Z')
  const safeMax = new Date('2100-01-01T00:00:00.000Z')
  const safeDates = fc.date({ min: safeMin, max: safeMax, noInvalidDate: true })

  const reversibleUnits = fc.constantFrom(
    'millisecond',
    'second',
    'minute',
    'hour',
    'day',
    'week',
  )
  const shiftUnits = fc.constantFrom('millisecond', 'second', 'minute', 'hour', 'day', 'week')
  const boundaryUnits = fc.constantFrom('year', 'quarter', 'month', 'week', 'isoWeek', 'day', 'hour', 'minute', 'second')
  const reversibleAmounts = fc.integer({ min: -500, max: 500 })
  const shiftAmounts = fc.integer({ min: -100, max: 100 })
  const offsetMinutes = fc.integer({ min: -48, max: 56 }).map((quarterHours) => quarterHours * 15)
  const zoneBoundaryUnits = fc.constantFrom('day', 'week', 'isoWeek', 'month', 'year')
  const comparisonUnits = fc.constantFrom('millisecond', 'second', 'minute', 'hour', 'day', 'week', 'isoWeek', 'month', 'year')
  const durationUnits = fc.constantFrom('milliseconds', 'seconds', 'minutes', 'hours', 'days', 'weeks')
  const durationAmounts = fc.integer({ min: -1000, max: 1000 })

  function formatOffset(minutes: number): string {
    const sign = minutes >= 0 ? '+' : '-'
    const abs = Math.abs(minutes)
    const hours = String(Math.floor(abs / 60)).padStart(2, '0')
    const mins = String(abs % 60).padStart(2, '0')
    return `${sign}${hours}:${mins}`
  }

  const offsetIsoStrings = fc.record({
    year: fc.integer({ min: 2000, max: 2030 }),
    month: fc.integer({ min: 1, max: 12 }),
    day: fc.integer({ min: 1, max: 28 }),
    hour: fc.integer({ min: 0, max: 23 }),
    minute: fc.integer({ min: 0, max: 59 }),
    second: fc.integer({ min: 0, max: 59 }),
    ms: fc.integer({ min: 0, max: 999 }),
    offset: offsetMinutes,
  }).map(({ year, month, day, hour, minute, second, ms, offset }) => ({
    text: `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:${String(second).padStart(2, '0')}.${String(ms).padStart(3, '0')}${formatOffset(offset)}`,
    offset,
  }))

  test('add/subtract roundtrip preserves the original instant for reversible units', () => {
    fc.assert(
      fc.property(safeDates, reversibleAmounts, reversibleUnits, (date, amount, unit) => {
        const original = moment(date)
        const roundtrip = moment(date).add(amount, unit).subtract(amount, unit)
        expect(roundtrip.valueOf()).toBe(original.valueOf())
      }),
      { numRuns: 200 }
    )
  })

  test('diff is antisymmetric for the same unit', () => {
    fc.assert(
      fc.property(safeDates, safeDates, reversibleUnits, (a, b, unit) => {
        const left = normalizeZero(moment(a).diff(moment(b), unit))
        const right = normalizeZero(moment(b).diff(moment(a), unit))
        expect(left).toBe(normalizeZero(-right))
      }),
      { numRuns: 200 }
    )
  })

  test('diff is invariant under shifting both operands by the same amount', () => {
    fc.assert(
      fc.property(safeDates, safeDates, shiftAmounts, shiftUnits, reversibleUnits, (a, b, shift, shiftUnit, diffUnit) => {
        const base = moment(a).diff(moment(b), diffUnit)
        const shifted = moment(a).add(shift, shiftUnit).diff(moment(b).add(shift, shiftUnit), diffUnit)
        expect(shifted).toBe(base)
      }),
      { numRuns: 200 }
    )
  })

  test('isBefore/isAfter/isSame are mutually consistent', () => {
    fc.assert(
      fc.property(safeDates, safeDates, (a, b) => {
        const left = moment(a)
        const right = moment(b)
        const before = left.isBefore(right)
        const after = left.isAfter(right)
        const same = left.isSame(right)

        expect(Number(before) + Number(after) + Number(same)).toBe(1)
        expect(before).toBe(right.isAfter(left))
        expect(after).toBe(right.isBefore(left))
        expect(same).toBe(right.isSame(left))
      }),
      { numRuns: 200 }
    )
  })

  test('comparison relations are preserved when both operands shift equally', () => {
    fc.assert(
      fc.property(safeDates, safeDates, shiftAmounts, shiftUnits, (a, b, shift, unit) => {
        const left = moment(a)
        const right = moment(b)
        const shiftedLeft = moment(a).add(shift, unit)
        const shiftedRight = moment(b).add(shift, unit)

        expect(shiftedLeft.isBefore(shiftedRight)).toBe(left.isBefore(right))
        expect(shiftedLeft.isAfter(shiftedRight)).toBe(left.isAfter(right))
        expect(shiftedLeft.isSame(shiftedRight)).toBe(left.isSame(right))
      }),
      { numRuns: 200 }
    )
  })

  test('clone remains independent after mutation', () => {
    fc.assert(
      fc.property(safeDates, reversibleAmounts, reversibleUnits, (date, amount, unit) => {
        const source = moment(date)
        const cloned = source.clone()
        cloned.add(amount, unit)
        expect(source.valueOf()).toBe(moment(date).valueOf())
      }),
      { numRuns: 200 }
    )
  })

  test('startOf is idempotent', () => {
    fc.assert(
      fc.property(safeDates, boundaryUnits, (date, unit) => {
        const once = moment(date).startOf(unit)
        const twice = once.clone().startOf(unit)
        expect(twice.valueOf()).toBe(once.valueOf())
      }),
      { numRuns: 200 }
    )
  })

  test('endOf is idempotent', () => {
    fc.assert(
      fc.property(safeDates, boundaryUnits, (date, unit) => {
        const once = moment(date).endOf(unit)
        const twice = once.clone().endOf(unit)
        expect(twice.valueOf()).toBe(once.valueOf())
      }),
      { numRuns: 200 }
    )
  })

  test('a moment stays between startOf and endOf for the same unit', () => {
    fc.assert(
      fc.property(safeDates, boundaryUnits, (date, unit) => {
        const current = moment(date)
        const start = current.clone().startOf(unit)
        const end = current.clone().endOf(unit)
        expect(start.valueOf()).toBeLessThanOrEqual(current.valueOf())
        expect(current.valueOf()).toBeLessThanOrEqual(end.valueOf())
      }),
      { numRuns: 200 }
    )
  })

  test('toDate roundtrip preserves the instant', () => {
    fc.assert(
      fc.property(safeDates, (date) => {
        const m = moment(date)
        expect(m.toDate().getTime()).toBe(m.valueOf())
        expect(moment(m.toDate()).valueOf()).toBe(m.valueOf())
      }),
      { numRuns: 200 }
    )
  })

  test('utc().local() preserves the instant', () => {
    fc.assert(
      fc.property(safeDates, (date) => {
        const original = moment(date)
        const roundtrip = original.clone().utc().local()
        expect(roundtrip.valueOf()).toBe(original.valueOf())
      }),
      { numRuns: 200 }
    )
  })

  test('utcOffset(offset, false) preserves the instant', () => {
    fc.assert(
      fc.property(safeDates, offsetMinutes, (date, offset) => {
        const original = moment(date)
        const shifted = original.clone().utcOffset(formatOffset(offset), false)
        expect(shifted.valueOf()).toBe(original.valueOf())
        expect(shifted.utcOffset()).toBe(offset)
      }),
      { numRuns: 200 }
    )
  })

  test('utcOffset(offset, true) preserves wall-clock fields', () => {
    fc.assert(
      fc.property(safeDates, offsetMinutes, (date, offset) => {
        const original = moment(date)
        const before = original.format('YYYY-MM-DD HH:mm:ss.SSS')
        const shifted = original.clone().utcOffset(formatOffset(offset), true)
        expect(shifted.format('YYYY-MM-DD HH:mm:ss.SSS')).toBe(before)
        expect(shifted.utcOffset()).toBe(offset)
      }),
      { numRuns: 200 }
    )
  })

  test('utcOffset(offset, true) changes the instant by exactly the offset delta', () => {
    fc.assert(
      fc.property(safeDates, offsetMinutes, (date, offset) => {
        const original = moment(date)
        const localOffset = original.utcOffset()
        const shifted = original.clone().utcOffset(formatOffset(offset), true)
        const actualDelta = normalizeZero(shifted.valueOf() - original.valueOf())
        const expectedDelta = normalizeZero((localOffset - offset) * 60000)
        expect(actualDelta).toBe(expectedDelta)
      }),
      { numRuns: 200 }
    )
  })

  test('utcOffset(offset, false) matches moment while preserving the instant', () => {
    fc.assert(
      fc.property(safeDates, offsetMinutes, (date, offset) => {
        const offsetText = formatOffset(offset)
        const m2 = moment(date).clone().utcOffset(offsetText, false)
        const orig = originalMoment(date).clone().utcOffset(offsetText, false)
        expect(m2.valueOf()).toBe(moment(date).valueOf())
        expect(m2.valueOf()).toBe(orig.valueOf())
        expect(m2.utcOffset()).toBe(orig.utcOffset())
        expect(m2.format('YYYY-MM-DD HH:mm:ss.SSS Z')).toBe(orig.format('YYYY-MM-DD HH:mm:ss.SSS Z'))
      }),
      { numRuns: 200 }
    )
  })

  test('utcOffset(offset, true) matches moment while preserving wall-clock fields', () => {
    fc.assert(
      fc.property(safeDates, offsetMinutes, (date, offset) => {
        const offsetText = formatOffset(offset)
        const base = moment(date).format('YYYY-MM-DD HH:mm:ss.SSS')
        const m2 = moment(date).clone().utcOffset(offsetText, true)
        const orig = originalMoment(date).clone().utcOffset(offsetText, true)
        expect(m2.format('YYYY-MM-DD HH:mm:ss.SSS')).toBe(base)
        expect(m2.valueOf()).toBe(orig.valueOf())
        expect(m2.utcOffset()).toBe(orig.utcOffset())
        expect(m2.format('YYYY-MM-DD HH:mm:ss.SSS Z')).toBe(orig.format('YYYY-MM-DD HH:mm:ss.SSS Z'))
      }),
      { numRuns: 200 }
    )
  })

  test('utc() matches moment while preserving the instant', () => {
    fc.assert(
      fc.property(safeDates, (date) => {
        const m2 = moment(date).clone().utc()
        const orig = originalMoment(date).clone().utc()
        expect(m2.valueOf()).toBe(moment(date).valueOf())
        expect(m2.valueOf()).toBe(orig.valueOf())
        expect(m2.utcOffset()).toBe(orig.utcOffset())
        expect(m2.format('YYYY-MM-DD HH:mm:ss.SSS Z')).toBe(orig.format('YYYY-MM-DD HH:mm:ss.SSS Z'))
      }),
      { numRuns: 200 }
    )
  })

  test('local() matches moment while preserving the instant', () => {
    fc.assert(
      fc.property(safeDates, offsetMinutes, (date, offset) => {
        const offsetText = formatOffset(offset)
        const m2 = moment(date).clone().utcOffset(offsetText, false).local()
        const orig = originalMoment(date).clone().utcOffset(offsetText, false).local()
        expect(m2.valueOf()).toBe(orig.valueOf())
        expect(m2.utcOffset()).toBe(orig.utcOffset())
        expect(m2.format('YYYY-MM-DD HH:mm:ss.SSS Z')).toBe(orig.format('YYYY-MM-DD HH:mm:ss.SSS Z'))
      }),
      { numRuns: 200 }
    )
  })

  test('utc(true) matches moment while preserving wall-clock fields', () => {
    fc.assert(
      fc.property(safeDates, (date) => {
        const base = moment(date).format('YYYY-MM-DD HH:mm:ss.SSS')
        const m2 = moment(date).clone().utc(true)
        const orig = originalMoment(date).clone().utc(true)
        expect(m2.format('YYYY-MM-DD HH:mm:ss.SSS')).toBe(base)
        expect(m2.valueOf()).toBe(orig.valueOf())
        expect(m2.utcOffset()).toBe(orig.utcOffset())
        expect(m2.format('YYYY-MM-DD HH:mm:ss.SSS Z')).toBe(orig.format('YYYY-MM-DD HH:mm:ss.SSS Z'))
      }),
      { numRuns: 200 }
    )
  })

  test('local(true) matches moment while preserving wall-clock fields', () => {
    fc.assert(
      fc.property(safeDates, offsetMinutes, (date, offset) => {
        const offsetText = formatOffset(offset)
        const base = moment(date).clone().utcOffset(offsetText, false).format('YYYY-MM-DD HH:mm:ss.SSS')
        const m2 = moment(date).clone().utcOffset(offsetText, false).local(true)
        const orig = originalMoment(date).clone().utcOffset(offsetText, false).local(true)
        expect(m2.format('YYYY-MM-DD HH:mm:ss.SSS')).toBe(base)
        expect(m2.valueOf()).toBe(orig.valueOf())
        expect(m2.utcOffset()).toBe(orig.utcOffset())
        expect(m2.format('YYYY-MM-DD HH:mm:ss.SSS Z')).toBe(orig.format('YYYY-MM-DD HH:mm:ss.SSS Z'))
      }),
      { numRuns: 200 }
    )
  })

  test('parseZone static matches moment for ISO strings with explicit offsets', () => {
    fc.assert(
      fc.property(offsetIsoStrings, ({ text, offset }) => {
        const m2 = moment.parseZone(text)
        const orig = originalMoment.parseZone(text)
        expect(m2.utcOffset()).toBe(offset)
        expect(m2.utcOffset()).toBe(orig.utcOffset())
        expect(m2.valueOf()).toBe(orig.valueOf())
        expect(m2.format('YYYY-MM-DD HH:mm:ss.SSS Z')).toBe(orig.format('YYYY-MM-DD HH:mm:ss.SSS Z'))
      }),
      { numRuns: 200 }
    )
  })

  test('instance parseZone matches static parseZone for ISO strings with explicit offsets', () => {
    fc.assert(
      fc.property(offsetIsoStrings, ({ text, offset }) => {
        const inst = moment(text).parseZone()
        const stat = moment.parseZone(text)
        expect(inst.utcOffset()).toBe(offset)
        expect(inst.utcOffset()).toBe(stat.utcOffset())
        expect(inst.valueOf()).toBe(stat.valueOf())
        expect(inst.format('YYYY-MM-DD HH:mm:ss.SSS Z')).toBe(stat.format('YYYY-MM-DD HH:mm:ss.SSS Z'))
      }),
      { numRuns: 200 }
    )
  })

  test('parseZone with format string matches moment', () => {
    fc.assert(
      fc.property(offsetIsoStrings, ({ text, offset }) => {
        const formatted = text.replace('T', ' ').replace(/([+-]\d{2}):(\d{2})$/, ' $1$2')
        const fmt = 'YYYY-MM-DD HH:mm:ss.SSS ZZ'
        const m2 = moment.parseZone(formatted, fmt)
        const orig = originalMoment.parseZone(formatted, fmt)
        expect(m2.utcOffset()).toBe(offset)
        expect(m2.utcOffset()).toBe(orig.utcOffset())
        expect(m2.valueOf()).toBe(orig.valueOf())
        expect(m2.format('YYYY-MM-DD HH:mm:ss.SSS Z')).toBe(orig.format('YYYY-MM-DD HH:mm:ss.SSS Z'))
      }),
      { numRuns: 200 }
    )
  })

  test('parseZone startOf(unit) matches moment and stays before the original instant', () => {
    fc.assert(
      fc.property(offsetIsoStrings, zoneBoundaryUnits, ({ text }, unit) => {
        const m2Original = moment.parseZone(text)
        const m2 = moment.parseZone(text).startOf(unit)
        const origOriginal = originalMoment.parseZone(text)
        const orig = originalMoment.parseZone(text).startOf(unit)

        expect(m2.valueOf()).toBe(orig.valueOf())
        expect(m2.utcOffset()).toBe(orig.utcOffset())
        expect(m2.format('YYYY-MM-DD HH:mm:ss.SSS Z')).toBe(orig.format('YYYY-MM-DD HH:mm:ss.SSS Z'))
        expect(m2.valueOf()).toBeLessThanOrEqual(m2Original.valueOf())
        expect(orig.valueOf()).toBeLessThanOrEqual(origOriginal.valueOf())
      }),
      { numRuns: 200 }
    )
  })

  test('parseZone endOf(unit) matches moment and stays after the original instant', () => {
    fc.assert(
      fc.property(offsetIsoStrings, zoneBoundaryUnits, ({ text }, unit) => {
        const m2Original = moment.parseZone(text)
        const m2 = moment.parseZone(text).endOf(unit)
        const origOriginal = originalMoment.parseZone(text)
        const orig = originalMoment.parseZone(text).endOf(unit)

        expect(m2.valueOf()).toBe(orig.valueOf())
        expect(m2.utcOffset()).toBe(orig.utcOffset())
        expect(m2.format('YYYY-MM-DD HH:mm:ss.SSS Z')).toBe(orig.format('YYYY-MM-DD HH:mm:ss.SSS Z'))
        expect(m2.valueOf()).toBeGreaterThanOrEqual(m2Original.valueOf())
        expect(orig.valueOf()).toBeGreaterThanOrEqual(origOriginal.valueOf())
      }),
      { numRuns: 200 }
    )
  })

  test('parseZone original instant stays between startOf(unit) and endOf(unit)', () => {
    fc.assert(
      fc.property(offsetIsoStrings, zoneBoundaryUnits, ({ text }, unit) => {
        const current = moment.parseZone(text)
        const start = moment.parseZone(text).startOf(unit)
        const end = moment.parseZone(text).endOf(unit)

        expect(start.valueOf()).toBeLessThanOrEqual(current.valueOf())
        expect(current.valueOf()).toBeLessThanOrEqual(end.valueOf())
      }),
      { numRuns: 200 }
    )
  })

  test('parseZone comparisons with unit match moment', () => {
    fc.assert(
      fc.property(offsetIsoStrings, offsetIsoStrings, comparisonUnits, (leftInput, rightInput, unit) => {
        const left = moment.parseZone(leftInput.text)
        const right = moment.parseZone(rightInput.text)
        const origLeft = originalMoment.parseZone(leftInput.text)
        const origRight = originalMoment.parseZone(rightInput.text)

        expect(left.isSame(right, unit)).toBe(origLeft.isSame(origRight, unit))
        expect(left.isBefore(right, unit)).toBe(origLeft.isBefore(origRight, unit))
        expect(left.isAfter(right, unit)).toBe(origLeft.isAfter(origRight, unit))
        expect(left.isSameOrBefore(right, unit)).toBe(origLeft.isSameOrBefore(origRight, unit))
        expect(left.isSameOrAfter(right, unit)).toBe(origLeft.isSameOrAfter(origRight, unit))
      }),
      { numRuns: 200 }
    )
  })

  test('parseZone comparisons remain mutually consistent under unit truncation', () => {
    fc.assert(
      fc.property(offsetIsoStrings, offsetIsoStrings, comparisonUnits, (leftInput, rightInput, unit) => {
        const left = moment.parseZone(leftInput.text)
        const right = moment.parseZone(rightInput.text)
        const same = left.isSame(right, unit)
        const before = left.isBefore(right, unit)
        const after = left.isAfter(right, unit)

        expect(Number(same) + Number(before) + Number(after)).toBe(1)
        expect(left.isSameOrBefore(right, unit)).toBe(same || before)
        expect(left.isSameOrAfter(right, unit)).toBe(same || after)
      }),
      { numRuns: 200 }
    )
  })

  test('duration add/subtract roundtrip preserves valueOf for reversible units', () => {
    fc.assert(
      fc.property(durationAmounts, durationUnits, durationAmounts, durationUnits, (a1, u1, a2, u2) => {
        const original = moment.duration(a1, u1).add(a2, u2)
        const roundtrip = original.clone().subtract(a2, u2)
        expect(roundtrip.valueOf()).toBe(moment.duration(a1, u1).valueOf())
      }),
      { numRuns: 200 }
    )
  })

  test('adding a duration to a moment shifts it by the duration value', () => {
    fc.assert(
      fc.property(safeDates, durationAmounts, durationUnits, (date, amount, unit) => {
        const duration = moment.duration(amount, unit)
        const shifted = moment(date).add(duration)
        expect(shifted.valueOf() - moment(date).valueOf()).toBe(duration.valueOf())
      }),
      { numRuns: 200 }
    )
  })

  test('moment plus duration matches moment.js for reversible duration units', () => {
    fc.assert(
      fc.property(safeDates, durationAmounts, durationUnits, (date, amount, unit) => {
        const duration = moment.duration(amount, unit)
        const originalDuration = originalMoment.duration(amount, unit)
        const shifted = moment(date).add(duration)
        const origShifted = originalMoment(date).add(originalDuration)
        expect(shifted.valueOf()).toBe(origShifted.valueOf())
        expect(shifted.format('YYYY-MM-DD HH:mm:ss.SSS')).toBe(origShifted.format('YYYY-MM-DD HH:mm:ss.SSS'))
      }),
      { numRuns: 200 }
    )
  })

  test('diff equals added reversible duration amount in the same unit', () => {
    fc.assert(
      fc.property(safeDates, durationAmounts, durationUnits, (date, amount, unit) => {
        const base = moment(date)
        const shifted = base.clone().add(amount, unit)
        expect(shifted.diff(base, unit)).toBe(amount)
      }),
      { numRuns: 200 }
    )
  })

  test('duration({ from, to }) matches moment.js for valueOf and unit conversions', () => {
    fc.assert(
      fc.property(safeDates, safeDates, (fromDate, toDate) => {
        const from = moment(fromDate)
        const to = moment(toDate)
        const fromOrig = originalMoment(fromDate)
        const toOrig = originalMoment(toDate)

        const duration = moment.duration({ from, to })
        const origDuration = originalMoment.duration({ from: fromOrig, to: toOrig })

        expect(duration.valueOf()).toBe(origDuration.valueOf())
        expect(duration.asMilliseconds()).toBe(origDuration.asMilliseconds())
        expect(duration.asMonths()).toBe(origDuration.asMonths())
        expect(duration.asYears()).toBe(origDuration.asYears())
      }),
      { numRuns: 200 }
    )
  })

  test('duration({ from, to }) is antisymmetric by valueOf', () => {
    fc.assert(
      fc.property(safeDates, safeDates, (aDate, bDate) => {
        const ab = moment.duration({ from: moment(aDate), to: moment(bDate) }).valueOf()
        const ba = moment.duration({ from: moment(bDate), to: moment(aDate) }).valueOf()
        expect(normalizeZero(ab)).toBe(normalizeZero(-ba))
      }),
      { numRuns: 200 }
    )
  })

  test('duration({ from, to }) sign matches the sign of the instant ordering', () => {
    fc.assert(
      fc.property(safeDates, safeDates, (fromDate, toDate) => {
        const from = moment(fromDate)
        const to = moment(toDate)
        const durationValue = moment.duration({ from, to }).valueOf()
        const instantDelta = to.valueOf() - from.valueOf()

        if (instantDelta === 0) {
          expect(durationValue).toBe(0)
        } else if (instantDelta > 0) {
          expect(durationValue).toBeGreaterThan(0)
        } else {
          expect(durationValue).toBeLessThan(0)
        }
      }),
      { numRuns: 200 }
    )
  })
})
