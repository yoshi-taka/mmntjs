import { _setMinutes } from "./_kernel";
import type { MinuteSecond } from "./_types";

export function setMinutes(d: Date, minutes: number): Date {
  return _setMinutes(d, minutes as MinuteSecond);
}
