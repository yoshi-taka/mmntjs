import { addHours } from "./addHours";

export function subtractHours(d: Date, n: number): Date {
  return addHours(d, -n);
}
