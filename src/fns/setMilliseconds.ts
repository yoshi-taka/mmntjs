export function setMilliseconds(d: Date, ms: number): Date {
  return new Date(
    d.getFullYear(),
    d.getMonth(),
    d.getDate(),
    d.getHours(),
    d.getMinutes(),
    d.getSeconds(),
    ms,
  );
}
