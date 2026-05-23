import { _addMinutes } from "./_kernel";
import type { IntegerAmount } from "./_types";

export function addMinutes(d: Date, n: number): Date {
  return _addMinutes(
    d,
    (Number.isInteger(n) ? n : n < 0 ? Math.round(-n) * -1 : Math.round(n)) as IntegerAmount,
  );
}
