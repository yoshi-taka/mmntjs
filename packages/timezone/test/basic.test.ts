import { describe, test, expect } from 'bun:test'
import moment from '../../../src/index.ts'
import { installTimezone } from '../src/install'

installTimezone(moment as never)

describe('moment2-timezone', () => {
  test('moment.tz.guess() returns a string', () => {
    const tz = (moment as any).tz.guess()
    expect(typeof tz).toBe('string')
    expect(tz.length).toBeGreaterThan(0)
  })

  test('moment.tz.names() returns array of timezones', () => {
    const names = (moment as any).tz.names()
    expect(Array.isArray(names)).toBe(true)
    expect(names.length).toBeGreaterThan(0)
    expect(names).toContain('UTC')
    expect(names).toContain('America/New_York')
  })

  test('moment.tz() creates moment in timezone', () => {
    const m = (moment as any).tz('2024-01-15 12:00', 'America/New_York')
    expect(m.isValid()).toBe(true)
    expect(m.format()).toBeTruthy()
  })

  test('moment().tz() converts to timezone', () => {
    const m = moment('2024-01-15T12:00:00Z')
    const m2 = (m as any).tz('Asia/Tokyo')
    expect(m2.isValid()).toBe(true)
    expect(m2.format('HH:mm')).toBe('21:00')
  })

  test('moment.tz.zone() returns zone info', () => {
    const zone = (moment as any).tz.zone('America/New_York')
    expect(zone).not.toBeNull()
    expect((zone as any).name).toBe('America/New_York')
  })

  test('moment().tz() getter returns current timezone', () => {
    const m = (moment as any).tz('America/Chicago')
    const tzName = (m as any).tz()
    expect(typeof tzName).toBe('string')
  })

  test('tz.add() is a no-op', () => {
    (moment as any).tz.add({})
  })

  test('moment.tz.zone().offset returns number', () => {
    const zone = (moment as any).tz.zone('Asia/Tokyo')
    const offset = (zone as any).offset(Date.now())
    expect(typeof offset).toBe('number')
    expect(offset).toBe(540)
  })
})
