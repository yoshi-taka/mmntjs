type Brand<T, B extends string> = T & { __brand: B };

/** 0–11 */
export type MonthIndex = Brand<number, "MonthIndex">;
/** 1–31 */
export type DayOfMonth = Brand<number, "DayOfMonth">;
/** 0–23 */
export type Hour = Brand<number, "Hour">;
/** 0–59 */
export type MinuteSecond = Brand<number, "MinuteSecond">;
/** 0–999 */
export type Millisecond = Brand<number, "Millisecond">;
/** any integer */
export type IntegerAmount = Brand<number, "IntegerAmount">;
/** any finite year */
export type YearNumber = Brand<number, "YearNumber">;

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
