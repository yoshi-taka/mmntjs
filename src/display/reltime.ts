let relTimeRounding: Function | boolean = Math.round;
let relTimeThreshold: Record<string, number | null> = {
  ss: 44,
  s: 45,
  m: 45,
  h: 22,
  d: 26,
  w: null,
  M: 11,
};

export function getRelTimeRounding(): Function | boolean {
  return relTimeRounding;
}

export function setRelTimeRounding(fn?: Function | boolean): Function | boolean {
  if (fn === undefined) {
    return typeof relTimeRounding === "function" ? relTimeRounding : Math.round;
  }
  if (fn === false) {
    relTimeRounding = false;
    return false;
  }
  relTimeRounding = fn;
  return relTimeRounding;
}

export function getRelTimeThreshold(threshold: string): number | null | undefined {
  return relTimeThreshold[threshold];
}

export function setRelTimeThreshold(threshold: string, limit?: number): number | boolean | undefined {
  if (relTimeThreshold[threshold] === null) {
    return undefined;
  }
  if (limit === undefined) {
    return (relTimeThreshold as Record<string, number | undefined>)[threshold];
  }
  (relTimeThreshold as Record<string, number | undefined>)[threshold] = limit;
  if (threshold === "s") {
    relTimeThreshold.ss = limit - 1;
  }
  return (relTimeThreshold as Record<string, number | undefined>)[threshold];
}
