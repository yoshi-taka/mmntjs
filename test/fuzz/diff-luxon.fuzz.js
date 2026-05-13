import _moment from '../../dist/index.js'
import { DateTime } from 'luxon'
import { applyRandomTZ } from './tz-helper.js'

const moment = _moment

export function fuzz(buf) {
  applyRandomTZ(buf)
  if (buf.length < 4) return
  const ts = buf.readInt32LE(0)
  try {
    const m2 = moment(ts)
    const dt = DateTime.fromMillis(ts)
    if (!dt.isValid) return

    const m2Val = m2.valueOf()
    const dtVal = dt.toMillis()
    if (m2Val !== dtVal) {
      throw new Error(`valueOf mismatch for ts=${ts}: moment2=${m2Val}, luxon=${dtVal}`)
    }

    const m2Fmt = m2.format('YYYY-MM-DD')
    const dtFmt = dt.toFormat('yyyy-MM-dd')
    if (m2Fmt !== dtFmt) {
      throw new Error(`format mismatch for ts=${ts}: moment2="${m2Fmt}", luxon="${dtFmt}"`)
    }

    if (buf.length >= 8) {
      const amount = buf.readInt32LE(4) % 1000
      const units = ['day', 'month', 'year', 'hour', 'minute', 'second', 'week']
      const unit = units[buf.length >= 9 ? buf[8] % units.length : 0]
      const luxonUnit = { day: 'days', month: 'months', year: 'years', hour: 'hours', minute: 'minutes', second: 'seconds', week: 'weeks' }[unit]
      if (luxonUnit) {
        const m2Add = m2.clone().add(amount, unit)
        const dtAdd = dt.plus({ [luxonUnit]: amount })
        if (!dtAdd.isValid) return
        if (m2Add.valueOf() !== dtAdd.toMillis()) {
          throw new Error(`add(${amount}, ${unit}) mismatch for ts=${ts}: moment2=${m2Add.valueOf()}, luxon=${dtAdd.toMillis()}`)
        }
      }
    }
  } catch (error) {
    if (error instanceof Error &&
        (error.message.startsWith('valueOf mismatch') ||
         error.message.startsWith('format mismatch') ||
         error.message.startsWith('add('))) {
      throw error
    }
  }
}
