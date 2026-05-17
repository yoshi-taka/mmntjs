import moment from "mmntjs";
import { installTimezone, type MomentLike, type MomentTz } from "./install-core";
import { Z, L, C, N, V, T } from "./builtin-data.generated";

installTimezone(moment as unknown as MomentLike, {
  version: V,
  tzVersion: T,
  zonesBlob: Z,
  linksBlob: L,
  countriesBlob: C,
  namesBlob: N,
});

// Wrap moment factory to respect moment.defaultZone
// When moment() is called with no args and defaultZone is set, redirect to moment.tz()
// Internal timezone functions use the original (un-proxied) moment, so no infinite recursion.
const momentAny = moment as unknown as Record<string, unknown>;
const _wrappedFactory = new Proxy(moment, {
  apply(_target, _thisArg, args: unknown[]) {
    if (args.length === 0 || (args.length === 1 && args[0] == null)) {
      const dz = momentAny.defaultZone as string | null | undefined;
      if (dz) {
        const tzFn = momentAny.tz as (i: unknown, z: string) => unknown;
        return tzFn(args[0], dz);
      }
    }
    return (moment as unknown as (...a: unknown[]) => unknown)(...args);
  },
  get(_target, prop: string) {
    return momentAny[prop];
  },
  set(_target, prop: string, value: unknown) {
    momentAny[prop] = value;
    return true;
  },
  has(_target, prop: string) {
    return prop in moment;
  },
  ownKeys() {
    return Reflect.ownKeys(moment);
  },
  getOwnPropertyDescriptor(_target, prop: string) {
    return Object.getOwnPropertyDescriptor(moment, prop);
  },
});

export default _wrappedFactory;
export const tz: MomentTz = (moment as unknown as MomentLike).tz!;
