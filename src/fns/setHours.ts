export function setHours(d: Date, hours: number): Date {
  return new Date(
    d.getFullYear(),
    d.getMonth(),
    d.getDate(),
    hours,
    d.getMinutes(),
    d.getSeconds(),
    d.getMilliseconds(),
  );
}
