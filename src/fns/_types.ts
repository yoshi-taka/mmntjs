type Brand<T, B extends string> = T & { __brand: B };

/** 0–11 */
export type MonthIndex = Brand<number, "MonthIndex">;
/** 1–31 */
export type DayOfMonth = Brand<number, "DayOfMonth">;
/** 1–28 — safe range, no month overflow */
export type Date28 = Brand<number, "Date28">;
/** 0–23 */
export type Hour = Brand<number, "Hour">;
/** 0–59 (minutes and seconds) */
export type MinuteSecond = Brand<number, "MinuteSecond">;
/** 0–59 (minutes only) */
export type Minute = Brand<number, "Minute">;
/** 0–999 */
export type Millisecond = Brand<number, "Millisecond">;
/** any integer */
export type IntegerAmount = Brand<number, "IntegerAmount">;
/** any finite year */
export type YearNumber = Brand<number, "YearNumber">;

/** Cast number to Minute — caller guarantees 0–59 */
export function asMinute(n: number): Minute {
  return n as Minute;
}
/** Cast number to Date28 — caller guarantees 1–28 */
export function asDate28(n: number): Date28 {
  return n as Date28;
}
/** Cast number to Millisecond — caller guarantees 0–999 */
export function asMillisecond(n: number): Millisecond {
  return n as Millisecond;
}

// ── Parse result discriminated union ────────────────────────────────────────

interface FastLocalISO {
  kind: "local";
  year: number;
  month: number;
  day: number;
  hour: number;
  min: number;
  sec: number;
  ms: number;
}

interface FastZonedISO {
  kind: "zoned";
  year: number;
  month: number;
  day: number;
  hour: number;
  min: number;
  sec: number;
  ms: number;
  offset: number;
}

interface InvalidISO {
  kind: "fail";
}

export type FastISOResult = FastLocalISO | FastZonedISO | InvalidISO;
