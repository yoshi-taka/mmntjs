export function setMinutes(d: Date, minutes: number): Date {
  return new Date(
    d.getFullYear(),
    d.getMonth(),
    d.getDate(),
    d.getHours(),
    minutes,
    d.getSeconds(),
    d.getMilliseconds(),
  );
}
