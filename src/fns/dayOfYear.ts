const NL = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334];
const LP = [0, 31, 60, 91, 121, 152, 182, 213, 244, 274, 305, 335];

export function dayOfYear(d: Date): number {
  const y = d.getFullYear();
  const leap = (y & 3) === 0 && (y % 100 !== 0 || (y & 15) === 0);
  const ladder = leap ? LP : NL;
  return ladder[d.getMonth()] + d.getDate();
}
