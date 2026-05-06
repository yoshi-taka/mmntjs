import _moment from '../../dist/index.js'
import _originalMoment from '../../moment/moment.js'

const moment = _moment
const originalMoment = _originalMoment

function g(buf) {
  const b = [...buf]
  let p = 0
  const n = () => p < b.length ? b[p++] : 0
  const r = (min, max) => min + (n() % (max - min + 1))
  const pk = (a) => a[n() % a.length]
  const d = () => r(0, 9)
  const ds = (len) => { let s = ''; for (let i = 0; i < len; i++) { s += d(); } return s }
  const pad = (v, len) => String(v).padStart(len, '0')

  const signRoll = n() % 10
  let year
  if (signRoll < 1) {
    year = `+${ds(6)}`
  } else if (signRoll < 2) {
    year = `-${ds(6)}`
  } else {
    year = ds(4)
  }

  const sign = year[0] === '+' || year[0] === '-' ? year[0] : ''

  const dateType = n() % 14
  const isExt = n() % 2
  let datePart = ''

  const month = r(1, 12)
  const dayInMonth = r(1, 28)
  const dayOfYear = r(1, 365)
  const weekNum = r(1, 52)
  const weekDay = r(1, 7)

  const useExt = isExt || !!sign
  if (useExt) {
    switch (dateType) {
      case 0: datePart = `${year}-${pad(month,2)}-${pad(dayInMonth,2)}`; break
      case 1: datePart = `${year}-W${pad(weekNum,2)}-${weekDay}`; break
      case 2: datePart = `${year}-W${pad(weekNum,2)}`; break
      case 3: datePart = `${year}-${pad(dayOfYear,3)}`; break
      case 4: datePart = `${year}-${pad(month,2)}`; break
      default: datePart = `${year}-${pad(month,2)}-${pad(dayInMonth,2)}`; break
    }
  } else {
    switch (dateType) {
      case 0: datePart = `${year}${pad(month,2)}${pad(dayInMonth,2)}`; break
      case 1: datePart = `${year}W${pad(weekNum,2)}${weekDay}`; break
      case 2: datePart = `${year}W${pad(weekNum,2)}`; break
      case 3: datePart = `${year}${pad(dayOfYear,3)}`; break
      case 4: datePart = `${year}${pad(month,2)}`; break
      default: datePart = `${year}${pad(month,2)}${pad(dayInMonth,2)}`; break
    }
  }

  let result = datePart

  const timeRoll = n() % 3
  if (timeRoll !== 0) {
    const sep = pk(['T', ' '])
    const hour = r(0, 23)
    const minute = r(0, 59)
    const second = r(0, 59)
    const frac = n() % 10
    const fracDigits = r(1, 6)

    if (useExt) {
      result += `${sep}${pad(hour, 2)}:${pad(minute, 2)}`
      if (n() % 2) {
        result += `:${pad(second, 2)}`
        if (frac < 3) { result += `.${ds(fracDigits)}`; }
        else if (frac < 4) { result += `,${ds(fracDigits)}`; }
      }
    } else {
      result += `${sep}${pad(hour, 2)}${pad(minute, 2)}`
      if (n() % 2) {
        result += pad(second, 2)
        if (frac < 3) { result += `.${ds(fracDigits)}`; }
        else if (frac < 4) { result += `,${ds(fracDigits)}`; }
      }
    }
  }

  const tzRoll = n() % 4
  if (tzRoll === 0) {
    result += 'Z'
  } else if (tzRoll === 1) {
    const tzSign = n() % 2 ? '+' : '-'
    const tzHour = r(0, 23)
    const tzMin = r(0, 59)
    if (useExt) {
      result += `${tzSign}${pad(tzHour, 2)}:${pad(tzMin, 2)}`
    } else {
      result += `${tzSign}${pad(tzHour, 2)}${pad(tzMin, 2)}`
    }
  }

  return result
}

export function fuzz(buf) {
  const str = g(buf)
  try {
    const m2 = moment(str)
    const mOrig = originalMoment(str)

    const isValid = m2.isValid()
    const origIsValid = mOrig.isValid()

    if (isValid !== origIsValid) {
      throw new Error(`Validity mismatch for ${JSON.stringify(str)}: moment2=${isValid}, original=${origIsValid}`)
    }

    if (isValid) {
      const ts = m2.valueOf()
      const origTs = mOrig.valueOf()
      if (ts !== origTs) {
        throw new Error(`Timestamp mismatch for ${JSON.stringify(str)}: moment2=${ts}, original=${origTs}`)
      }

      const fmt = m2.clone().utc().format('YYYY-MM-DD HH:mm:ss')
      const origFmt = mOrig.clone().utc().format('YYYY-MM-DD HH:mm:ss')
      if (fmt !== origFmt) {
        throw new Error(`Format mismatch for ${JSON.stringify(str)}: moment2="${fmt}", original="${origFmt}"`)
      }
    }
  } catch (error) {
    if (error instanceof Error &&
        (error.message.startsWith('Validity mismatch') ||
         error.message.startsWith('Format mismatch') ||
         error.message.startsWith('Timestamp mismatch'))) {
      throw error
    }
  }
}
