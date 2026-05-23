export function setDate(d: Date, date: number): Date {
  return new Date(
    d.getFullYear(),
    d.getMonth(),
    date,
    d.getHours(),
    d.getMinutes(),
    d.getSeconds(),
    d.getMilliseconds(),
  );
}
