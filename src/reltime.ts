let relTimeRounding: Function | boolean = Math.round;
let relTimeThreshold: Record<string, any> = {
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

export function getRelTimeThreshold(threshold: string): any {
  return relTimeThreshold[threshold];
}

export function setRelTimeThreshold(threshold: string, limit?: number): number | boolean {
  if (relTimeThreshold[threshold] === undefined) {
    return undefined as any;
  }
  if (limit === undefined) {
    return relTimeThreshold[threshold];
  }
  relTimeThreshold[threshold] = limit;
  if (threshold === "s") {
    relTimeThreshold.ss = limit - 1;
  }
  return relTimeThreshold[threshold];
}
