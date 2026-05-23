export function setYear(d: Date, year: number): Date {
  return new Date(
    year,
    d.getMonth(),
    d.getDate(),
    d.getHours(),
    d.getMinutes(),
    d.getSeconds(),
    d.getMilliseconds(),
  );
}
