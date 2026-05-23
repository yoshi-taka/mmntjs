import { _addMilliseconds } from "./_kernel";
import type { IntegerAmount } from "./_types";

export function addMilliseconds(d: Date, n: number): Date {
  return _addMilliseconds(
    d,
    (Number.isInteger(n) ? n : n < 0 ? Math.round(-n) * -1 : Math.round(n)) as IntegerAmount,
  );
}
