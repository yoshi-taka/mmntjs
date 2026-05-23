import { _setSeconds } from "./_kernel";
import type { MinuteSecond } from "./_types";

export function setSeconds(d: Date, seconds: number): Date {
  return _setSeconds(d, seconds as MinuteSecond);
}
