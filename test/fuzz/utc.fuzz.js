import _moment from '../../dist/index.js'
import _originalMoment from '../../moment/moment.js'
import { applyRandomTZ } from './tz-helper.js'

const moment = _moment
const originalMoment = _originalMoment

export function fuzz(buf) {
  applyRandomTZ(buf)
  const str = buf.toString('utf-8')
  try {
    const m2 = moment.utc(str)
    const mOrig = originalMoment.utc(str)
    const isValid2 = m2.isValid()
    const isValidOrig = mOrig.isValid()
    if (isValid2 !== isValidOrig) {
      throw new Error(`isValid mismatch for ${JSON.stringify(str)}: moment2=${isValid2}, original=${isValidOrig}`)
    }
    if (!isValid2) {return}
    const fmt2 = m2.format('YYYY-MM-DD HH:mm:ss.SSS')
    const fmtOrig = mOrig.format('YYYY-MM-DD HH:mm:ss.SSS')
    if (fmt2 !== fmtOrig) {
      throw new Error(`format mismatch for ${JSON.stringify(str)}: moment2="${fmt2}", original="${fmtOrig}"`)
    }
    const ts2 = m2.valueOf()
    const tsOrig = mOrig.valueOf()
    if (ts2 !== tsOrig) {
      throw new Error(`valueOf mismatch for ${JSON.stringify(str)}: moment2=${ts2}, original=${tsOrig}`)
    }
    const iso2 = m2.toISOString()
    const isoOrig = mOrig.toISOString()
    if (iso2 !== isoOrig) {
      throw new Error(`toISOString mismatch for ${JSON.stringify(str)}: moment2="${iso2}", original="${isoOrig}"`)
    }
  } catch (error) {
    if (error instanceof Error && typeof error.message === 'string' &&
        (error.message.startsWith('isValid mismatch') ||
         error.message.startsWith('format mismatch') ||
         error.message.startsWith('valueOf mismatch') ||
         error.message.startsWith('toISOString mismatch'))) {
      throw error
    }
  }
}
