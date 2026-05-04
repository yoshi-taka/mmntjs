import _moment from '../../dist/index.js'
import _originalMoment from '../../moment/moment.js'

const moment = _moment
const originalMoment = _originalMoment

export function fuzz(buf) {
  if (buf.length < 4) return
  const units = ['years', 'months', 'weeks', 'days', 'hours', 'minutes', 'seconds', 'milliseconds']
  try {
    const val = buf.readInt32LE(0)
    const unit = units[buf[4] % units.length]
    const key = units[buf[5] % units.length]

    const args = {}
    args[key] = val
    const d2 = moment.duration(args)
    const dOrig = originalMoment.duration(args)

    const getVal = d2.get(unit)
    const origGetVal = dOrig.get(unit)
    if (getVal !== origGetVal) {
      throw new Error(`Duration.get("${unit}") mismatch: moment2=${getVal}, original=${origGetVal} (created with ${JSON.stringify(args)})`)
    }

    const asVal = d2.as(unit)
    const origAsVal = dOrig.as(unit)
    if (asVal !== origAsVal) {
      throw new Error(`Duration.as("${unit}") mismatch: moment2=${asVal}, original=${origAsVal} (created with ${JSON.stringify(args)})`)
    }

    if (buf.length > 6) {
      const val2 = buf.readInt32LE(6)
      const unit2 = units[buf[10] % units.length]
      const args2 = {}
      args2[unit2] = val2
      const d2b = d2.add(args2)
      const dOrgb = dOrig.add(args2)

      const addAs = d2b.as(unit)
      const origAddAs = dOrgb.as(unit)
      if (addAs !== origAddAs) {
        throw new Error(`Duration.add().as("${unit}") mismatch: moment2=${addAs}, original=${origAddAs}`)
      }
    }
  } catch (error) {
    if (error instanceof Error &&
        (error.message.startsWith('Duration.') ||
         error.message.startsWith('Duration.add'))) {
      throw error
    }
  }
}
