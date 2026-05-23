import { _addSeconds } from "./_kernel";
import type { IntegerAmount } from "./_types";

export function addSeconds(d: Date, n: number): Date {
  return _addSeconds(
    d,
    (Number.isInteger(n) ? n : n < 0 ? Math.round(-n) * -1 : Math.round(n)) as IntegerAmount,
  );
}
