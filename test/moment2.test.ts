import { describe, test, expect } from 'bun:test'
import moment from '../src/index.ts'
import originalMoment from '../moment/moment.js'
import type { Moment } from '../src/moment_fixed'
import { deLocale } from '../src/locale/de'
import { defineLocale } from '../src/locale'
defineLocale('de', deLocale)

describe('moment2 specific', () => {

  test('clone should not share _d reference', () => {
    const m = moment('2024-01-15')
    const c = m.clone()

    c.year(2025)
    expect(m.year()).toBe(2024)
    expect(c.year()).toBe(2025)

    c.date(20)
    expect(m.date()).toBe(15)
    expect(c.date()).toBe(20)

    c.month(5)
    expect(m.month()).toBe(0)
    expect(c.month()).toBe(5)
  })

  test('clone should be independent after add/subtract', () => {
    const m = moment('2024-01-15')
    const c = m.clone()

    c.add(1, 'day')
    expect(m.date()).toBe(15)
    expect(c.date()).toBe(16)

    c.subtract(2, 'day')
    expect(m.date()).toBe(15)
    expect(c.date()).toBe(14)
  })

  test('constructor should not share _d reference', () => {
    const d = new Date('2024-01-15')
    const m = moment(d)
    d.setFullYear(2025)
    expect(m.year()).toBe(2024)
  })

  test('defineLocale after creation should not affect existing Moment instances', () => {
    const m = moment('2024-06-15')
    const original = m.format('MMMM')
    moment.defineLocale('_test_cow', {
      parentLocale: 'en',
      months: 'A_B_C_D_E_F_G_H_I_J_K_L'.split('_'),
    } as unknown as Record<string, unknown>)
    const after = m.format('MMMM')
    expect(after).toBe(original)
    moment.locale('en')
  })

  test('defineLocale should affect new Moment instances when locale is set', () => {
    moment.defineLocale('_test_cow', {
      parentLocale: 'en',
      months: 'A_B_C_D_E_F_G_H_I_J_K_L'.split('_'),
    } as unknown as Record<string, unknown>)
    const m = moment('2024-06-15').locale('_test_cow')
    expect(m.format('MMMM')).toBe('F')
    moment.locale('en')
  })

  test('setLocale changes default locale for new moments only', () => {
    moment.locale('en')
    const existing = moment('2024-06-15 10:30:00')
    const existingLocale = existing.locale()
    moment.locale('de')
    const created = moment('2024-06-15 10:30:00')
    expect(existing.locale()).toBe(existingLocale)
    expect(created.locale()).toBe('de')
    moment.locale('en')
  })

  test('moment.now can override Date.now for new moments', () => {
    const fixed = new Date('2025-01-01T00:00:00Z').valueOf()
    moment.now = () => fixed
    const m = moment()
    expect(m.valueOf()).toBe(fixed)
    moment.now = undefined as unknown as typeof moment.now
    const after = moment()
    expect(Math.abs(Date.now() - after.valueOf())).toBeLessThan(100)
  })

  test('updateOffset callback is called on setters', () => {
    const calls: string[] = []
    moment.updateOffset = ((m: Moment, keepTime?: boolean) => {
      calls.push(keepTime ? 'keep' : 'no-keep')
    }) as (m: Moment, keepTime?: boolean) => void
    const m = moment('2024-06-15')
    calls.length = 0
    m.year(2025)
    expect(calls.length).toBeGreaterThanOrEqual(1)
    moment.updateOffset = undefined as unknown as typeof moment.updateOffset
  })

  test('ISO string without timezone is parsed as local time (matching moment.js)', () => {
    // "2024-03-09T12:00:00" has no timezone suffix → treated as local time
    // This test must be run with a non-UTC TZ to be meaningful:
    //   TZ=America/New_York bun test ...
    const local = moment('2024-03-09T12:00:00')
    const ref = originalMoment('2024-03-09T12:00:00')
    expect(local.hour()).toBe(ref.hour())
    expect(local.valueOf()).toBe(ref.valueOf())
  })

  test('ISO string with timezone uses UTC internally', () => {
    const utc = moment('2024-03-09T12:00:00Z')
    expect(utc._isUTC).toBe(true)
    // moment2 keeps _isUTC=true for Z strings, so hour() is UTC hour
    expect(utc.hour()).toBe(12)

    const withOffset = moment('2024-03-09T12:00:00+05:00')
    expect(withOffset._isUTC).toBe(true)
    expect(withOffset._offset).toBe(300)
    expect(withOffset.valueOf()).toBe(new Date('2024-03-09T07:00:00Z').getTime())
  })

  test('moment.utc() treats ISO string without timezone as UTC', () => {
    const utc = moment.utc('2024-03-09T12:00:00')
    // moment.utc creates _isUTC=true, so hour() returns UTC hour
    expect(utc.hour()).toBe(12)
    expect(utc.valueOf()).toBe(new Date('2024-03-09T12:00:00Z').getTime())
    expect(utc.isUTC()).toBe(true)
  })

  test('ISO date-only string is parsed as local time (no hour shift)', () => {
    // "2024-03-09" has no time component → date-only, midnight local
    const local = moment('2024-03-09')
    const ref = originalMoment('2024-03-09')
    expect(local.format('YYYY-MM-DD')).toBe(ref.format('YYYY-MM-DD'))
    expect(local.valueOf()).toBe(ref.valueOf())
  })

  test('ISO date-only fast path preserves years 0-99', () => {
    const local = moment('0000-06-28')
    const ref = originalMoment('0000-06-28')
    expect(local.isValid()).toBe(ref.isValid())
    expect(local.format('YYYY-MM-DD')).toBe(ref.format('YYYY-MM-DD'))
    expect(local.valueOf()).toBe(ref.valueOf())
  })

  test('_dClone: false skips defensive clone in constructor', () => {
    const MomentCtor = Object.getPrototypeOf(moment()).constructor
    const d = new Date('2024-06-15T12:00:00Z')
    const m = new MomentCtor({ _d: d, _dClone: false }) as Moment
    expect(m._d).toBe(d) // 同じ参照 → cloneされていない
    m.add(1, 'day')
    expect(d.getDate()).toBe(16) // 外部Dateも変わってしまう
  })

  test('_dClone無指定なら防御的にcloneされる', () => {
    const MomentCtor = Object.getPrototypeOf(moment()).constructor
    const external = new Date('2024-06-15T12:00:00Z')
    const m = new MomentCtor({ _d: external }) as Moment
    expect(m._d).not.toBe(external) // cloneされた → 別参照
    m.add(1, 'day')
    expect(external.getDate()).toBe(15) // 外部は不変
    expect(m.date()).toBe(16)
  })
})
