import { addDays } from "./addDays";

export function subtractDays(d: Date, n: number): Date {
  return addDays(d, -n);
}
