import type { RelTimeRoundingFn, RelTimeThresholdKey } from "../types";

// -------------------------------------------------------------------------
// TYPED INTERNAL API — relative time rounding/thresholds
// -------------------------------------------------------------------------

let relTimeRounding: RelTimeRoundingFn = Math.round;
let relTimeThreshold: Record<RelTimeThresholdKey, number | null> = {
  ss: 44,
  s: 45,
  m: 45,
  h: 22,
  d: 26,
  w: null,
  M: 11,
};

export function getRelTimeRounding(): RelTimeRoundingFn {
  return relTimeRounding;
}

export function setRelTimeRounding(fn?: RelTimeRoundingFn): RelTimeRoundingFn {
  if (fn === undefined) {
    return typeof relTimeRounding === "function" ? relTimeRounding : Math.round;
  }
  if (fn === false) {
    relTimeRounding = false;
    return false;
  }
  relTimeRounding = fn;
  return true;
}

export function getRelTimeThreshold(threshold: RelTimeThresholdKey): number | null {
  return relTimeThreshold[threshold];
}

export function setRelTimeThreshold(
  threshold: RelTimeThresholdKey,
  limit?: number,
): number | boolean | null {
  if (!(threshold in relTimeThreshold)) {
    return false;
  }
  if (limit === undefined) {
    return relTimeThreshold[threshold];
  }
  relTimeThreshold[threshold] = limit;
  if (threshold === "s") {
    relTimeThreshold.ss = limit - 1;
  }
  return true;
}
