import { addMonths } from "./addMonths";

export function addYears(d: Date, n: number): Date {
  return addMonths(d, n * 12);
}
