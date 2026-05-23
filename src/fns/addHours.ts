import { _addHours } from "./_kernel";
import type { IntegerAmount } from "./_types";

export function addHours(d: Date, n: number): Date {
  return _addHours(
    d,
    (Number.isInteger(n) ? n : n < 0 ? Math.round(-n) * -1 : Math.round(n)) as IntegerAmount,
  );
}
