import { _setMonth } from "./_kernel";
import type { MonthIndex } from "./_types";

export function setMonth(d: Date, month: number): Date {
  return _setMonth(d, month as MonthIndex);
}
