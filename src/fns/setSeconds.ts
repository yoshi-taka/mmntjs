export function setSeconds(d: Date, seconds: number): Date {
  return new Date(
    d.getFullYear(),
    d.getMonth(),
    d.getDate(),
    d.getHours(),
    d.getMinutes(),
    seconds,
    d.getMilliseconds(),
  );
}
