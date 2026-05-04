import _moment from '../../dist/index.js'
import _originalMoment from '../../moment/moment.js'

const moment = _moment
const originalMoment = _originalMoment

function randomFormat(buf) {
  const chars = []
  const validTokens = 'Y M D d H h m s S A Z z X x'.split(' ')
  for (let i = 0; i < buf.length; i++) {
    if (buf[i] < 32) {
      chars.push(String.fromCharCode(32 + (buf[i] % 16)))
    } else if (buf[i] < 64) {
      chars.push(validTokens[buf[i] % validTokens.length])
    } else if (buf[i] < 128) {
      chars.push(String.fromCharCode(buf[i] % 127))
      if (chars.at(-1) === '[' || chars.at(-1) === ']') {
        chars.pop()
      }
    } else {
      chars.push(String.fromCharCode(buf[i] % 127))
    }
  }
  let fmt = chars.join('').slice(0, 40)
  if (fmt.length === 0) fmt = 'YYYY-MM-DD'
  return fmt
}

export function fuzz(buf) {
  if (buf.length < 4) return
  const str = buf.slice(0, Math.min(buf.length, 8)).toString('utf-8')
  const fmtBytes = buf.slice(Math.min(buf.length, 8))
  const fmt = randomFormat(fmtBytes)
  try {
    const m2 = moment(str)
    const mOrig = originalMoment(str)
    if (!m2.isValid() && !mOrig.isValid()) return
    if (m2.isValid() !== mOrig.isValid()) {
      throw new Error(`Validity mismatch for "${str}": moment2=${m2.isValid()}, original=${mOrig.isValid()}`)
    }
    const fmt2 = m2.format(fmt)
    const fmtOrig = mOrig.format(fmt)
    if (fmt2 !== fmtOrig) {
      throw new Error(`Format("${fmt}") mismatch for "${str}": moment2="${fmt2}", original="${fmtOrig}"`)
    }
  } catch (error) {
    if (error instanceof Error &&
        (error.message.startsWith('Validity mismatch') ||
         error.message.startsWith('Format('))) {
      throw error
    }
  }
}
