import { _setDate } from "./_kernel";
import type { DayOfMonth } from "./_types";

export function setDate(d: Date, date: number): Date {
  return _setDate(d, date as DayOfMonth);
}
