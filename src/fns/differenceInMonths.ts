const DAYS = new Int8Array([31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]);

function _isLeapYear(y: number): boolean {
  if (!isFinite(y)) {
    return false;
  }
  if ((y & 3) !== 0) {
    return false;
  }
  if (y % 100 !== 0) {
    return true;
  }
  return (y & 15) === 0;
}

function _daysInMonth(y: number, m: number): number {
  if (!isFinite(y) || !isFinite(m)) {
    return NaN;
  }
  if (m === 1) {
    return _isLeapYear(y) ? 29 : 28;
  }
  return DAYS[m];
}

function _monthDiff(later: Date, earlier: Date): number {
  const wholeMonths =
    (earlier.getFullYear() - later.getFullYear()) * 12 + (earlier.getMonth() - later.getMonth());
  const raw = Number.isInteger(wholeMonths)
    ? wholeMonths
    : wholeMonths < 0
      ? Math.round(-wholeMonths) * -1
      : Math.round(wholeMonths);
  const total = later.getFullYear() * 12 + later.getMonth() + raw;
  const ny = Math.floor(total / 12);
  const nm = ((total % 12) + 12) % 12;
  let dd = later.getDate();
  if (dd > 28) {
    const md = _daysInMonth(ny, nm);
    if (dd > md) {
      dd = md;
    }
  }
  const anchor = new Date(
    ny,
    nm,
    dd,
    later.getHours(),
    later.getMinutes(),
    later.getSeconds(),
    later.getMilliseconds(),
  );
  const earlierTime = earlier.getTime();
  const anchorTime = anchor.getTime();
  if (wholeMonths > 0) {
    return earlierTime < anchorTime ? wholeMonths - 1 : wholeMonths || 0;
  }
  if (wholeMonths < 0) {
    return earlierTime > anchorTime ? wholeMonths + 1 : wholeMonths || 0;
  }
  return wholeMonths || 0;
}

export function differenceInMonths(a: Date, b: Date): number {
  const aDay = a.getDate(),
    bDay = b.getDate();
  const swap = aDay < bDay;
  const later = swap ? b : a,
    earlier = swap ? a : b;
  const whole = _monthDiff(later, earlier);
  const result = swap ? whole : -whole;
  return result || 0;
}
