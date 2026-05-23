export function addDays(d: Date, n: number): Date {
  if (!n) {
    return new Date(d.getTime());
  }
  if (Number.isInteger(n)) {
    const newT = d.getTime() + n * 86400000;
    const temp = new Date(newT);
    if (d.getTimezoneOffset() === temp.getTimezoneOffset()) {
      return temp;
    }
  }
  const out = new Date(d.getTime());
  out.setDate(out.getDate() + n);
  return out;
}
