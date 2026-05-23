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

export function addMonths(d: Date, n: number): Date {
  const out = new Date(d.getTime());
  const raw = Number.isInteger(n) ? n : n < 0 ? Math.round(-n) * -1 : Math.round(n);
  const total = out.getFullYear() * 12 + out.getMonth() + raw;
  const ny = Math.floor(total / 12);
  const nm = ((total % 12) + 12) % 12;
  let dd = out.getDate();
  if (dd > 28) {
    const md = _daysInMonth(ny, nm);
    if (dd > md) {
      dd = md;
    }
  }
  out.setFullYear(ny, nm, dd);
  return out;
}
