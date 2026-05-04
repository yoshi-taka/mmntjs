import _moment from '../../dist/index.js'
import _originalMoment from '../../moment/moment.js'

const moment = _moment
const originalMoment = _originalMoment

export function fuzz(buf) {
  if (buf.length < 4) return
  const len = 2 + (buf[0] % 6)
  const arr = []
  for (let i = 0; i < len; i++) {
    const offset = i * 4 + 4
    if (offset + 4 > buf.length) break
    arr.push(buf.readInt32LE(offset))
  }
  if (arr.length < 2) return
  try {
    const m2 = moment(arr)
    const mOrig = originalMoment(arr)
    const isValid2 = m2.isValid()
    const isValidOrig = mOrig.isValid()
    if (isValid2 !== isValidOrig) {
      throw new Error(`isValid mismatch for [${arr}]: moment2=${isValid2}, original=${isValidOrig}`)
    }
    if (!isValid2) return
    const fmt2 = m2.format('YYYY-MM-DD HH:mm:ss.SSS')
    const fmtOrig = mOrig.format('YYYY-MM-DD HH:mm:ss.SSS')
    if (fmt2 !== fmtOrig) {
      throw new Error(`format mismatch for [${arr}]: moment2="${fmt2}", original="${fmtOrig}"`)
    }
    const ts2 = m2.valueOf()
    const tsOrig = mOrig.valueOf()
    if (ts2 !== tsOrig) {
      throw new Error(`valueOf mismatch for [${arr}]: moment2=${ts2}, original=${tsOrig}`)
    }
  } catch (e) {
    if (e instanceof Error && typeof e.message === 'string' &&
        (e.message.startsWith('isValid mismatch') ||
         e.message.startsWith('format mismatch') ||
         e.message.startsWith('valueOf mismatch'))) {
      throw e
    }
  }
}
