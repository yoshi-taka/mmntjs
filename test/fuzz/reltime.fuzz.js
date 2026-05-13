import _moment from '../../dist/index.js'
import _originalMoment from '../../moment/moment.js'
import { applyRandomTZ } from './tz-helper.js'

const moment = _moment
const originalMoment = _originalMoment

export function fuzz(buf) {
  applyRandomTZ(buf)
  if (buf.length < 4) {return}
  const baseTs = Date.now()
  const offset = buf.readInt32LE(0)
  if (!Number.isFinite(offset)) {return}
  try {
    const d = new Date(baseTs + offset)
    const m2 = moment(d)
    const mOrig = originalMoment(d)
    if (!m2.isValid() || !mOrig.isValid()) {return}
    const cal2 = m2.calendar()
    const calOrig = mOrig.calendar()
    if (cal2 !== calOrig) {
      throw new Error(`calendar() mismatch: moment2="${cal2}", original="${calOrig}"`)
    }
    if (buf.length >= 8) {
      const refOffset = buf.readInt32LE(4)
      if (Number.isFinite(refOffset)) {
        const refD = new Date(baseTs + refOffset)
        const ref2 = moment(refD)
        const refOrig = originalMoment(refD)
        if (ref2.isValid() && refOrig.isValid()) {
          const from2 = m2.from(ref2)
          const fromOrig = mOrig.from(refOrig)
          if (from2 !== fromOrig) {
            throw new Error(`from() mismatch: moment2="${from2}", original="${fromOrig}"`)
          }
          const to2 = m2.to(ref2)
          const toOrig = mOrig.to(refOrig)
          if (to2 !== toOrig) {
            throw new Error(`to() mismatch: moment2="${to2}", original="${toOrig}"`)
          }
        }
      }
    }
  } catch (error) {
    if (error instanceof Error && typeof error.message === 'string' &&
        (error.message.startsWith('calendar() mismatch') ||
         error.message.startsWith('from() mismatch') ||
         error.message.startsWith('to() mismatch'))) {
      throw error
    }
  }
}
