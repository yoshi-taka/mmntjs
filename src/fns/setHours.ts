import { _setHours } from "./_kernel";
import type { Hour } from "./_types";

export function setHours(d: Date, hours: number): Date {
  return _setHours(d, hours as Hour);
}
