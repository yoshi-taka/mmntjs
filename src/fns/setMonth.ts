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

export function setMonth(d: Date, month: number): Date {
  const out = new Date(d.getTime());
  const maxDay = _daysInMonth(out.getFullYear(), month);
  out.setMonth(month, Math.min(out.getDate(), maxDay));
  return out;
}
