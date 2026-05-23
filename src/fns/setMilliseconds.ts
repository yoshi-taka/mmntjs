import { _setMilliseconds } from "./_kernel";
import type { Millisecond } from "./_types";

export function setMilliseconds(d: Date, ms: number): Date {
  return _setMilliseconds(d, ms as Millisecond);
}
