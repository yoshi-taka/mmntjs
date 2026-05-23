import { _setYear } from "./_kernel";
import type { YearNumber } from "./_types";

export function setYear(d: Date, year: number): Date {
  return _setYear(d, year as YearNumber);
}
