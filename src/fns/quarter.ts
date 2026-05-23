export function quarter(d: Date): number {
  return ((d.getMonth() / 3) | 0) + 1;
}
