import { describe, test, expect } from 'bun:test'
import fc from 'fast-check'
import _moment from '../../src/index.ts'
import _originalMoment from '../../moment/moment'
const moment = _moment as unknown
const originalMoment = _originalMoment as unknown

describe('Equivalence partitioning: month', () => {
  const validMonths = fc.constantFrom(0, 1, 6, 11)
  const invalidLowMonths = fc.constantFrom(-1, -12, -100)
  const invalidHighMonths = fc.constantFrom(12, 13, 100)

  test('valid month (0-11) produces identical result', () => {
    fc.assert(
      fc.property(validMonths, (m) => {
        const m2 = moment([2024, m, 15])
        const mOrig = originalMoment([2024, m, 15])
        expect(m2.isValid()).toBe(mOrig.isValid())
        expect(m2.month()).toBe(mOrig.month())
        expect(m2.format('YYYY-MM-DD')).toBe(mOrig.format('YYYY-MM-DD'))
      }),
      { numRuns: 50 }
    )
  })

  test('invalid low month (< 0) matches moment', () => {
    fc.assert(
      fc.property(invalidLowMonths, (m) => {
        const m2 = moment([2024, m, 15])
        const mOrig = originalMoment([2024, m, 15])
        expect(m2.isValid()).toBe(mOrig.isValid())
        expect(m2.month()).toBe(mOrig.month())
      }),
      { numRuns: 50 }
    )
  })

  test('invalid high month (> 11) matches moment', () => {
    fc.assert(
      fc.property(invalidHighMonths, (m) => {
        const m2 = moment([2024, m, 15])
        const mOrig = originalMoment([2024, m, 15])
        expect(m2.isValid()).toBe(mOrig.isValid())
        expect(m2.month()).toBe(mOrig.month())
      }),
      { numRuns: 50 }
    )
  })
})

describe('Equivalence partitioning: day of month', () => {
  const safeDays = fc.constantFrom(1, 15, 28)
  const feb29Days = fc.constantFrom(29, 30, 31)

  test('safe days (1-28) produce identical result across all months', () => {
    fc.assert(
      fc.property(safeDays, fc.integer({ min: 0, max: 11 }), (d, m) => {
        const m2 = moment([2024, m, d])
        const mOrig = originalMoment([2024, m, d])
        expect(m2.isValid()).toBe(mOrig.isValid())
        if (mOrig.isValid()) {
          expect(m2.date()).toBe(mOrig.date())
        }
      }),
      { numRuns: 100 }
    )
  })

  test('month-edge days (29-31) match moment', () => {
    fc.assert(
      fc.property(feb29Days, fc.integer({ min: 0, max: 11 }), (d, m) => {
        const m2 = moment([2024, m, d])
        const mOrig = originalMoment([2024, m, d])
        expect(m2.isValid()).toBe(mOrig.isValid())
        expect(m2.format('YYYY-MM-DD')).toBe(mOrig.format('YYYY-MM-DD'))
      }),
      { numRuns: 100 }
    )
  })

  test('day 0 and negative days match moment', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(-1, 0, -31, -100),
        fc.integer({ min: 0, max: 11 }),
        (d, m) => {
          const m2 = moment([2024, m, d])
          const mOrig = originalMoment([2024, m, d])
          expect(m2.isValid()).toBe(mOrig.isValid())
          expect(m2.format('YYYY-MM-DD')).toBe(mOrig.format('YYYY-MM-DD'))
        }
      ),
      { numRuns: 50 }
    )
  })

  test('day > 31 matches moment', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(32, 45, 100, 365),
        fc.integer({ min: 0, max: 11 }),
        (d, m) => {
          const m2 = moment([2024, m, d])
          const mOrig = originalMoment([2024, m, d])
          expect(m2.isValid()).toBe(mOrig.isValid())
          expect(m2.format('YYYY-MM-DD')).toBe(mOrig.format('YYYY-MM-DD'))
        }
      ),
      { numRuns: 50 }
    )
  })
})

describe('Equivalence partitioning: time components', () => {
  test('hour equivalence: valid (0-23), boundary (24), negative', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(-1, 0, 12, 23, 24, 48, -24),
        fc.constantFrom(0, 30, 59),
        fc.constantFrom(0, 30, 59),
        (h, min, s) => {
          const m2 = moment([2024, 0, 15, h, min, s])
          const mOrig = originalMoment([2024, 0, 15, h, min, s])
          expect(m2.isValid()).toBe(mOrig.isValid())
          if (mOrig.isValid()) {
            expect(m2.format('HH:mm:ss')).toBe(mOrig.format('HH:mm:ss'))
          }
        }
      ),
      { numRuns: 100 }
    )
  })

  test('minute equivalence: valid (0-59), range boundaries', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(12),
        fc.constantFrom(-1, 0, 30, 59, 60, 120, -60),
        fc.constantFrom(0),
        (h, min, s) => {
          const m2 = moment([2024, 0, 15, h, min, s])
          const mOrig = originalMoment([2024, 0, 15, h, min, s])
          expect(m2.isValid()).toBe(mOrig.isValid())
          if (mOrig.isValid()) {
            expect(m2.format('HH:mm:ss')).toBe(mOrig.format('HH:mm:ss'))
          }
        }
      ),
      { numRuns: 100 }
    )
  })

  test('second equivalence: valid (0-59), range boundaries', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(12, 0),
        fc.constantFrom(0, 30),
        fc.constantFrom(-1, 0, 30, 59, 60, 120, -60),
        (h, min, s) => {
          const m2 = moment([2024, 0, 15, h, min, s])
          const mOrig = originalMoment([2024, 0, 15, h, min, s])
          expect(m2.isValid()).toBe(mOrig.isValid())
          if (mOrig.isValid()) {
            expect(m2.format('HH:mm:ss')).toBe(mOrig.format('HH:mm:ss'))
          }
        }
      ),
      { numRuns: 100 }
    )
  })

  test('millisecond equivalence: valid (0-999), range boundaries', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(-1, 0, 500, 999, 1000, 10000, -100),
        (ms) => {
          const d = new Date(2024, 0, 15, 12, 0, 0, ms)
          const m2 = moment(d)
          const mOrig = originalMoment(d)
          expect(m2.isValid()).toBe(mOrig.isValid())
          if (mOrig.isValid()) {
            expect(m2.millisecond()).toBe(mOrig.millisecond())
          }
        }
      ),
      { numRuns: 100 }
    )
  })
})

describe('Equivalence partitioning: year ranges', () => {
  test('negative years match moment', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(-1, -100, -1000, -5000, -9999, -100000),
        (y) => {
          const m2 = moment([y, 0, 1])
          const mOrig = originalMoment([y, 0, 1])
          expect(m2.isValid()).toBe(mOrig.isValid())
          if (mOrig.isValid()) {
            expect(m2.year()).toBe(mOrig.year())
            expect(m2.format('YYYY-MM-DD')).toBe(mOrig.format('YYYY-MM-DD'))
          }
        }
      ),
      { numRuns: 50 }
    )
  })

  test('year 0 matches moment', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(0, 1, 99, 100, 999, 1000, 9999, 10000, 100000),
        (y) => {
          const m2 = moment([y, 0, 1])
          const mOrig = originalMoment([y, 0, 1])
          expect(m2.isValid()).toBe(mOrig.isValid())
          if (mOrig.isValid()) {
            expect(m2.year()).toBe(mOrig.year())
            expect(m2.format('YYYY-MM-DD')).toBe(mOrig.format('YYYY-MM-DD'))
          }
        }
      ),
      { numRuns: 50 }
    )
  })
})

describe('Equivalence partitioning: 2-digit year', () => {
  test('2-digit year default split (68/69) matches moment', () => {
    fc.assert(
      fc.property(
        fc.constantFrom('68', '69', '00', '01', '99', '50'),
        (yy) => {
          const m2 = moment(yy, 'YY')
          const mOrig = originalMoment(yy, 'YY')
          expect(m2.isValid()).toBe(mOrig.isValid())
          if (mOrig.isValid()) {
            expect(m2.year()).toBe(mOrig.year())
          }
        }
      ),
      { numRuns: 50 }
    )
  })

  test('2-digit year full range (0-99) matches moment', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 99 }),
        (yy) => {
          const str = String(yy).padStart(2, '0')
          const m2 = moment(str, 'YY')
          const mOrig = originalMoment(str, 'YY')
          expect(m2.isValid()).toBe(mOrig.isValid())
          if (mOrig.isValid()) {
            expect(m2.year()).toBe(mOrig.year())
          }
        }
      ),
      { numRuns: 100 }
    )
  })
})

describe('Equivalence partitioning: leap year', () => {
  const leapYearClasses = {
    divisibleBy400: fc.constantFrom(1600, 2000, 2400, 4000),
    divisibleBy100Not400: fc.constantFrom(1700, 1900, 2100, 2500),
    divisibleBy4Not100: fc.constantFrom(2024, 2020, 1984, 2004),
    notDivisibleBy4: fc.constantFrom(2023, 2025, 2021, 2022),
  }

  test('divisible by 400 → leap year', () => {
    fc.assert(
      fc.property(leapYearClasses.divisibleBy400, (y) => {
        const m2 = moment([y, 0, 1])
        const mOrig = originalMoment([y, 0, 1])
        expect(m2.isLeapYear()).toBe(mOrig.isLeapYear())
        expect(m2.isLeapYear()).toBe(true)
      }),
      { numRuns: 50 }
    )
  })

  test('divisible by 100 but not 400 → not leap year', () => {
    fc.assert(
      fc.property(leapYearClasses.divisibleBy100Not400, (y) => {
        const m2 = moment([y, 0, 1])
        const mOrig = originalMoment([y, 0, 1])
        expect(m2.isLeapYear()).toBe(mOrig.isLeapYear())
        expect(m2.isLeapYear()).toBe(false)
      }),
      { numRuns: 50 }
    )
  })

  test('divisible by 4 but not 100 → leap year', () => {
    fc.assert(
      fc.property(leapYearClasses.divisibleBy4Not100, (y) => {
        const m2 = moment([y, 0, 1])
        const mOrig = originalMoment([y, 0, 1])
        expect(m2.isLeapYear()).toBe(mOrig.isLeapYear())
        expect(m2.isLeapYear()).toBe(true)
      }),
      { numRuns: 50 }
    )
  })

  test('not divisible by 4 → not leap year', () => {
    fc.assert(
      fc.property(leapYearClasses.notDivisibleBy4, (y) => {
        const m2 = moment([y, 0, 1])
        const mOrig = originalMoment([y, 0, 1])
        expect(m2.isLeapYear()).toBe(mOrig.isLeapYear())
        expect(m2.isLeapYear()).toBe(false)
      }),
      { numRuns: 50 }
    )
  })
})

describe('Equivalence partitioning: string parsing', () => {
  const iso8601Strings = fc.constantFrom(
    '2024-01-01',
    '2024-01-01T00:00:00',
    '2024-01-01T12:30:45Z',
    '2024-01-01T12:30:45.123Z',
    '2024-01-01T00:00:00+05:30',
    '2024-01-01T12:30:45.123+00:00',
    '2024-06-15',
    '2024-12-31',
  )

  const rfc2822Strings = fc.constantFrom(
    'Mon, 01 Jan 2024 00:00:00 GMT',
    'Wed, 31 Dec 2024 23:59:59 UTC',
    '01 Jan 2024 00:00:00 GMT',
  )

  const invalidStrings = fc.constantFrom(
    '',
    ' ',
    '\t',
    'not a date',
    'Invalid date',
    'abcdefg',
    '2024-13-01',
    '2024-00-01',
    '2024-01-32',
  )

  test('ISO 8601 strings match moment', () => {
    fc.assert(
      fc.property(iso8601Strings, (s) => {
        const m2 = moment(s)
        const mOrig = originalMoment(s)
        expect(m2.isValid()).toBe(mOrig.isValid())
        if (mOrig.isValid()) {
          expect(m2.valueOf()).toBe(mOrig.valueOf())
        }
      }),
      { numRuns: 50 }
    )
  })

  test('RFC 2822 strings match moment', () => {
    fc.assert(
      fc.property(rfc2822Strings, (s) => {
        const m2 = moment(s)
        const mOrig = originalMoment(s)
        expect(m2.isValid()).toBe(mOrig.isValid())
        if (mOrig.isValid()) {
          expect(m2.valueOf()).toBe(mOrig.valueOf())
        }
      }),
      { numRuns: 50 }
    )
  })

  test('invalid strings match moment', () => {
    fc.assert(
      fc.property(invalidStrings, (s) => {
        const m2 = moment(s)
        const mOrig = originalMoment(s)
        expect(m2.isValid()).toBe(mOrig.isValid())
      }),
      { numRuns: 50 }
    )
  })
})

describe('Equivalence partitioning: duration', () => {
  test('duration zero matches moment', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(0, 0.0, -0),
        (n) => {
          const d2 = moment.duration(n)
          const dOrig = originalMoment.duration(n)
          expect(d2.toISOString()).toBe(dOrig.toISOString())
          expect(d2.asMilliseconds()).toBe(dOrig.asMilliseconds())
        }
      ),
      { numRuns: 10 }
    )
  })

  test('duration small positive matches moment', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(1, 100, 1000, 60000),
        (n) => {
          const d2 = moment.duration(n)
          const dOrig = originalMoment.duration(n)
          expect(d2.toISOString()).toBe(dOrig.toISOString())
          expect(d2.asMilliseconds()).toBe(dOrig.asMilliseconds())
        }
      ),
      { numRuns: 50 }
    )
  })

  test('duration small negative matches moment', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(-1, -100, -1000, -60000),
        (n) => {
          const d2 = moment.duration(n)
          const dOrig = originalMoment.duration(n)
          expect(d2.toISOString()).toBe(dOrig.toISOString())
          expect(d2.asMilliseconds()).toBe(dOrig.asMilliseconds())
        }
      ),
      { numRuns: 50 }
    )
  })

  test('duration large values match moment', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(86400000, 31536000000, -86400000, -31536000000, 1e10, -1e10),
        (n) => {
          const d2 = moment.duration(n)
          const dOrig = originalMoment.duration(n)
          expect(d2.toISOString()).toBe(dOrig.toISOString())
          expect(d2.asMilliseconds()).toBe(dOrig.asMilliseconds())
        }
      ),
      { numRuns: 50 }
    )
  })
})

describe('Equivalence partitioning: add/subtract by amount', () => {
  const zeroAmount = fc.constantFrom(0)
  const smallPositive = fc.constantFrom(1, 2, 5, 10)
  const smallNegative = fc.constantFrom(-1, -2, -5, -10)
  const largePositive = fc.constantFrom(100, 365, 1000, 10000)
  const largeNegative = fc.constantFrom(-100, -365, -1000, -10000)

  test('add zero matches moment', () => {
    fc.assert(
      fc.property(zeroAmount, (n) => {
        const d = new Date('2024-06-15')
        const m2 = moment(d).add(n, 'days')
        const mOrig = originalMoment(d).add(n, 'days')
        expect(m2.format('YYYY-MM-DD')).toBe(mOrig.format('YYYY-MM-DD'))
        expect(m2.valueOf()).toBe(mOrig.valueOf())
      }),
      { numRuns: 10 }
    )
  })

  test('add small positive matches moment', () => {
    fc.assert(
      fc.property(smallPositive, (n) => {
        const d = new Date('2024-01-15')
        const m2 = moment(d).add(n, 'days')
        const mOrig = originalMoment(d).add(n, 'days')
        expect(m2.format('YYYY-MM-DD')).toBe(mOrig.format('YYYY-MM-DD'))
      }),
      { numRuns: 50 }
    )
  })

  test('add small negative matches moment', () => {
    fc.assert(
      fc.property(smallNegative, (n) => {
        const d = new Date('2024-01-15')
        const m2 = moment(d).add(n, 'days')
        const mOrig = originalMoment(d).add(n, 'days')
        expect(m2.format('YYYY-MM-DD')).toBe(mOrig.format('YYYY-MM-DD'))
      }),
      { numRuns: 50 }
    )
  })

  test('add large positive matches moment', () => {
    fc.assert(
      fc.property(largePositive, (n) => {
        const d = new Date('2024-01-15')
        const m2 = moment(d).add(n, 'days')
        const mOrig = originalMoment(d).add(n, 'days')
        expect(m2.format('YYYY-MM-DD')).toBe(mOrig.format('YYYY-MM-DD'))
      }),
      { numRuns: 50 }
    )
  })

  test('add large negative matches moment', () => {
    fc.assert(
      fc.property(largeNegative, (n) => {
        const d = new Date('2024-06-15')
        const m2 = moment(d).add(n, 'days')
        const mOrig = originalMoment(d).add(n, 'days')
        expect(m2.format('YYYY-MM-DD')).toBe(mOrig.format('YYYY-MM-DD'))
      }),
      { numRuns: 50 }
    )
  })

  test('subtract zero matches moment', () => {
    fc.assert(
      fc.property(zeroAmount, (n) => {
        const d = new Date('2024-06-15')
        const m2 = moment(d).subtract(n, 'days')
        const mOrig = originalMoment(d).subtract(n, 'days')
        expect(m2.format('YYYY-MM-DD')).toBe(mOrig.format('YYYY-MM-DD'))
      }),
      { numRuns: 10 }
    )
  })

  test('subtract small positive matches moment', () => {
    fc.assert(
      fc.property(smallPositive, (n) => {
        const d = new Date('2024-06-15')
        const m2 = moment(d).subtract(n, 'days')
        const mOrig = originalMoment(d).subtract(n, 'days')
        expect(m2.format('YYYY-MM-DD')).toBe(mOrig.format('YYYY-MM-DD'))
      }),
      { numRuns: 50 }
    )
  })
})

describe('Equivalence partitioning: format tokens', () => {
  const yearTokens = fc.constantFrom('YYYY', 'YY', 'Y')
  const monthTokens = fc.constantFrom('M', 'MM', 'MMM', 'MMMM')
  const dayTokens = fc.constantFrom('D', 'DD', 'Do', 'DDD', 'DDDD')
  const timeTokens = fc.constantFrom('HH', 'H', 'hh', 'h', 'mm', 'm', 'ss', 's', 'SSS', 'A', 'a')
  const zoneTokens = fc.constantFrom('Z', 'ZZ')
  const combinedTokens = fc.constantFrom(
    'YYYY-MM-DD',
    'YYYY/MM/DD',
    'MM/DD/YYYY',
    'DD-MM-YYYY',
    'YYYY-MM-DD HH:mm:ss',
    'MMMM Do YYYY, h:mm:ss A',
    'dddd, MMMM Do YYYY',
    'GGGG-[W]WW',
    '[Q]Q',
  )
  const invalidTokens = fc.constantFrom('AAAA', 'BBBB', '', 'YYYYY', 'MMMMM')

  test('year format tokens match moment', () => {
    fc.assert(
      fc.property(
        fc.date({ min: new Date('1900-01-01'), max: new Date('2100-01-01'), noInvalidDate: true }),
        yearTokens,
        (d, token) => {
          expect(moment(d).format(token)).toBe(originalMoment(d).format(token))
        }
      ),
      { numRuns: 100 }
    )
  })

  test('month format tokens match moment', () => {
    fc.assert(
      fc.property(
        fc.date({ min: new Date('1900-01-01'), max: new Date('2100-01-01'), noInvalidDate: true }),
        monthTokens,
        (d, token) => {
          expect(moment(d).format(token)).toBe(originalMoment(d).format(token))
        }
      ),
      { numRuns: 100 }
    )
  })

  test('day format tokens match moment', () => {
    fc.assert(
      fc.property(
        fc.date({ min: new Date('1900-01-01'), max: new Date('2100-01-01'), noInvalidDate: true }),
        dayTokens,
        (d, token) => {
          expect(moment(d).format(token)).toBe(originalMoment(d).format(token))
        }
      ),
      { numRuns: 100 }
    )
  })

  test('time format tokens match moment', () => {
    fc.assert(
      fc.property(
        fc.date({ min: new Date('1900-01-01'), max: new Date('2100-01-01'), noInvalidDate: true }),
        timeTokens,
        (d, token) => {
          expect(moment(d).format(token)).toBe(originalMoment(d).format(token))
        }
      ),
      { numRuns: 200 }
    )
  })

  test('zone format tokens match moment', () => {
    fc.assert(
      fc.property(
        fc.date({ min: new Date('1900-01-01'), max: new Date('2100-01-01'), noInvalidDate: true }),
        zoneTokens,
        (d, token) => {
          expect(moment(d).format(token)).toBe(originalMoment(d).format(token))
        }
      ),
      { numRuns: 100 }
    )
  })

  test('combined format patterns match moment', () => {
    fc.assert(
      fc.property(
        fc.date({ min: new Date('1900-01-01'), max: new Date('2100-01-01'), noInvalidDate: true }),
        combinedTokens,
        (d, token) => {
          expect(moment(d).format(token)).toBe(originalMoment(d).format(token))
        }
      ),
      { numRuns: 200 }
    )
  })

  test('invalid/unknown format tokens match moment', () => {
    fc.assert(
      fc.property(
        fc.date({ min: new Date('1900-01-01'), max: new Date('2100-01-01'), noInvalidDate: true }),
        invalidTokens,
        (d, token) => {
          expect(moment(d).format(token)).toBe(originalMoment(d).format(token))
        }
      ),
      { numRuns: 100 }
    )
  })
})

describe('Equivalence partitioning: comparison methods', () => {
  const datesCompare = fc.constantFrom(
    [new Date('2024-01-01'), new Date('2024-06-15')],
    [new Date('2024-06-15'), new Date('2024-01-01')],
    [new Date('2024-01-01'), new Date('2024-01-01')],
    [new Date('2024-12-31'), new Date('2025-01-01')],
  )

  test('isBefore/isAfter/isSame match moment', () => {
    fc.assert(
      fc.property(datesCompare, ([a, b]) => {
        expect(moment(a).isBefore(moment(b))).toBe(originalMoment(a).isBefore(originalMoment(b)))
        expect(moment(a).isAfter(moment(b))).toBe(originalMoment(a).isAfter(originalMoment(b)))
        expect(moment(a).isSame(moment(b))).toBe(originalMoment(a).isSame(originalMoment(b)))
      }),
      { numRuns: 50 }
    )
  })

  test('isSameOrBefore/isSameOrAfter match moment', () => {
    fc.assert(
      fc.property(datesCompare, ([a, b]) => {
        expect(moment(a).isSameOrBefore(moment(b))).toBe(
          originalMoment(a).isSameOrBefore(originalMoment(b))
        )
        expect(moment(a).isSameOrAfter(moment(b))).toBe(
          originalMoment(a).isSameOrAfter(originalMoment(b))
        )
      }),
      { numRuns: 50 }
    )
  })

  test('comparison with unit matches moment', () => {
    fc.assert(
      fc.property(datesCompare, fc.constantFrom('year', 'month', 'day'), ([a, b], unit) => {
        expect(moment(a).isBefore(moment(b), unit)).toBe(
          originalMoment(a).isBefore(originalMoment(b), unit)
        )
        expect(moment(a).isSame(moment(b), unit)).toBe(
          originalMoment(a).isSame(originalMoment(b), unit)
        )
      }),
      { numRuns: 100 }
    )
  })
})

describe('Equivalence partitioning: display methods', () => {
  test('from/to/calendar match moment', () => {
    fc.assert(
      fc.property(
        fc.date({ min: new Date('2024-01-01'), max: new Date('2024-12-31'), noInvalidDate: true }),
        fc.date({ min: new Date('2024-01-01'), max: new Date('2024-12-31'), noInvalidDate: true }),
        (d, ref) => {
          expect(moment(d).from(moment(ref))).toBe(originalMoment(d).from(originalMoment(ref)))
          expect(moment(d).to(moment(ref))).toBe(originalMoment(d).to(originalMoment(ref)))
          expect(moment(d).calendar(moment(ref))).toBe(
            originalMoment(d).calendar(originalMoment(ref))
          )
        }
      ),
      { numRuns: 100 }
    )
  })

  test('toISOString/toJSON/toString match moment', () => {
    fc.assert(
      fc.property(
        fc.date({ min: new Date('1900-01-01'), max: new Date('2100-01-01'), noInvalidDate: true }),
        (d) => {
          expect(moment(d).toISOString()).toBe(originalMoment(d).toISOString())
          expect(moment(d).toJSON()).toBe(originalMoment(d).toJSON())
          expect(moment(d).toString()).toBe(originalMoment(d).toString())
        }
      ),
      { numRuns: 100 }
    )
  })
})

describe('Equivalence partitioning: units', () => {
  const validUnits = fc.constantFrom(
    'year', 'month', 'date', 'day', 'hour', 'minute', 'second', 'millisecond',
  )
  const invalidUnits = fc.constantFrom(
    'decade', 'century', 'fortnight', '', 'foo', 'years!',
  )

  test('normalizeUnits handles valid units same as moment', () => {
    fc.assert(
      fc.property(validUnits, (u) => {
        expect(moment.normalizeUnits(u)).toBe(originalMoment.normalizeUnits(u))
      }),
      { numRuns: 50 }
    )
  })

  test('normalizeUnits handles invalid units same as moment', () => {
    fc.assert(
      fc.property(invalidUnits, (u) => {
        expect(moment.normalizeUnits(u)).toBe(originalMoment.normalizeUnits(u))
      }),
      { numRuns: 50 }
    )
  })
})

describe('Equivalence partitioning: get/set', () => {
  test('get(unit) matches moment for valid units', () => {
    fc.assert(
      fc.property(
        fc.date({ min: new Date('1900-01-01'), max: new Date('2100-01-01'), noInvalidDate: true }),
        fc.constantFrom('year', 'month', 'date', 'day', 'hour', 'minute', 'second', 'millisecond'),
        (d, unit) => {
          expect(moment(d).get(unit)).toBe(originalMoment(d).get(unit))
        }
      ),
      { numRuns: 100 }
    )
  })
})

describe('Equivalence partitioning: moment() constructor with empty/undefined/null', () => {
  test('empty array matches moment', () => {
    fc.assert(
      fc.property(fc.constantFrom([] as unknown[]), (input) => {
        const m2 = moment(input)
        const mOrig = originalMoment(input)
        expect(m2.isValid()).toBe(mOrig.isValid())
        if (mOrig.isValid()) {
          expect(Math.abs(m2.valueOf() - mOrig.valueOf())).toBeLessThan(100)
        }
      }),
      { numRuns: 10 }
    )
  })

  test('empty object matches moment', () => {
    fc.assert(
      fc.property(fc.constantFrom({} as Record<string, unknown>), (input) => {
        const m2 = moment(input)
        const mOrig = originalMoment(input)
        expect(m2.isValid()).toBe(mOrig.isValid())
        if (mOrig.isValid()) {
          expect(Math.abs(m2.valueOf() - mOrig.valueOf())).toBeLessThan(100)
        }
      }),
      { numRuns: 10 }
    )
  })

  test('undefined matches moment', () => {
    fc.assert(
      fc.property(fc.constantFrom(undefined as unknown), (input) => {
        const m2 = moment(input)
        const mOrig = originalMoment(input)
        expect(m2.isValid()).toBe(mOrig.isValid())
        if (mOrig.isValid()) {
          expect(Math.abs(m2.valueOf() - mOrig.valueOf())).toBeLessThan(100)
        }
      }),
      { numRuns: 10 }
    )
  })
})
