import type { Moment } from "../moment2";

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
    const factory = momentFactory;
    if (factory) {
      mod.setTemporalMomentFactory?.((...args: unknown[]) => factory(...args));
    }
  }
}

let momentFactory: ((...args: unknown[]) => unknown) | null = null;

export function registerTemporalBridge(moment: TemporalRegistrableMoment): void {
  momentFactory = moment as unknown as (...args: unknown[]) => unknown;
  moment.fn.toTemporal = function (this: Moment): unknown {
    ensureTemporal();
    return toTemporalFn!(this);
  };
  moment.fromTemporal = function (t: unknown): unknown {
    ensureTemporal();
    return fromTemporalFn!(t);
  };
}
