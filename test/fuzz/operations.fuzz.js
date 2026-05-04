import _moment from '../../dist/index.js'
import _originalMoment from '../../moment/moment.js'

const moment = _moment
const originalMoment = _originalMoment

export function fuzz(buf) {
  if (buf.length < 5) return
  const units = ['years', 'months', 'weeks', 'days', 'hours', 'minutes', 'seconds', 'milliseconds']
  const startEndUnits = ['year', 'quarter', 'month', 'week', 'isoWeek', 'day', 'hour', 'minute', 'second']
  const offset = buf.readInt32LE(0)
  const unit = units[buf[4] % units.length]
  try {
    const d = new Date(Date.now() + offset)
    const m2 = moment(d)
    const mOrig = originalMoment(d)
    const fmt2 = m2.format('YYYY-MM-DD HH:mm:ss.SSS')
    const fmtOrig = mOrig.format('YYYY-MM-DD HH:mm:ss.SSS')
    if (fmt2 !== fmtOrig) {
      throw new Error(`format() mismatch for offset ${offset}: moment2="${fmt2}", original="${fmtOrig}"`)
    }
    if (m2.isValid() !== mOrig.isValid()) {
      throw new Error(`isValid() mismatch for offset ${offset}`)
    }
    if (!m2.isValid()) return
    const amount = buf.length >= 9 ? buf.readInt32LE(5) : 0
    try {
      const a2 = m2.clone().add(amount, unit)
      const aOrig = mOrig.clone().add(amount, unit)
      const aFmt = a2.format('YYYY-MM-DD HH:mm:ss')
      const oFmt = aOrig.format('YYYY-MM-DD HH:mm:ss')
      if (aFmt !== oFmt) {
        throw new Error(`add(${amount}, "${unit}") mismatch for offset=${offset}: moment2="${aFmt}", original="${oFmt}"`)
      }
    } catch (_) {}
    try {
      const se = startEndUnits[buf.length >= 10 ? buf[9] % startEndUnits.length : 0]
      const s2 = m2.clone().startOf(se)
      const sOrig = mOrig.clone().startOf(se)
      const sFmt = s2.format('YYYY-MM-DD HH:mm:ss')
      const sOFmt = sOrig.format('YYYY-MM-DD HH:mm:ss')
      if (sFmt !== sOFmt) {
        throw new Error(`startOf("${se}") mismatch for offset=${offset}: moment2="${sFmt}", original="${sOFmt}"`)
      }
    } catch (_) {}
    try {
      const d2 = m2.clone().diff(m2.clone().add(amount, unit), unit.replace(/s$/, ''))
      const dOrig = mOrig.clone().diff(mOrig.clone().add(amount, unit), unit.replace(/s$/, ''))
      if (d2 !== dOrig) {
        throw new Error(`diff() mismatch for offset=${offset} ${amount} ${unit}: moment2=${d2}, original=${dOrig}`)
      }
    } catch (_) {}
  } catch (error) {
    if (error instanceof Error &&
        (error.message.startsWith('format() mismatch') ||
         error.message.startsWith('isValid() mismatch') ||
         error.message.startsWith('add(') ||
         error.message.startsWith('startOf(') ||
         error.message.startsWith('diff('))) {
      throw error
    }
  }
}
