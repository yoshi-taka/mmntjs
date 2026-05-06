import type { Moment } from "../moment_fixed";

interface TemporalRegistrableMoment {
  fn: Record<string, unknown>;
  fromTemporal?: (t: unknown) => unknown;
}

let toTemporalFn: ((t: unknown) => unknown) | null = null;
let fromTemporalFn: ((t: unknown) => unknown) | null = null;

function ensureTemporal(): void {
  if (!toTemporalFn) {
    const mod = require("../temporal");
    toTemporalFn = mod.toTemporal;
    fromTemporalFn = mod.fromTemporal;
  }
}

export function registerTemporalBridge(moment: TemporalRegistrableMoment): void {
  moment.fn.toTemporal = function (this: Moment): unknown {
    ensureTemporal();
    return toTemporalFn!(this);
  };
  moment.fromTemporal = function (t: unknown): unknown {
    ensureTemporal();
    return fromTemporalFn!(t);
  };
}
