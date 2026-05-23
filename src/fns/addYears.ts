import { _addYears } from "./_kernel";
import type { IntegerAmount } from "./_types";

export function addYears(d: Date, n: number): Date {
  return _addYears(d, n as IntegerAmount);
}
