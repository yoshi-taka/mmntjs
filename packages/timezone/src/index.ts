// fallow-ignore-next-line unresolved-imports
import * as mmntjs from "mmntjs";
import { installTimezone, type MomentLike, type MomentTz } from "./install-core";
import { Z, L, C, N, V, T } from "./builtin-data.generated";

const momentFactory = ((mmntjs as unknown as Record<string, unknown>).moment ??
  (mmntjs as unknown as Record<string, unknown>).default ??
  mmntjs) as unknown as MomentLike;

installTimezone(momentFactory, {
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
const momentAny = momentFactory as unknown as Record<string, unknown>;
const _wrappedFactory = new Proxy(momentFactory, {
  apply(_target, _thisArg, args: unknown[]) {
    if (args.length === 0 || (args.length === 1 && args[0] == null)) {
      const dz = momentAny.defaultZone as string | null | undefined;
      if (dz) {
        const tzFn = momentAny.tz as (i: unknown, z: string) => unknown;
        return tzFn(args[0], dz);
      }
    }
    return (momentFactory as unknown as (...a: unknown[]) => unknown)(...args);
  },
  get(_target, prop: string) {
    return momentAny[prop];
  },
  set(_target, prop: string, value: unknown) {
    momentAny[prop] = value;
    return true;
  },
  has(_target, prop: string) {
    return prop in momentFactory;
  },
  ownKeys() {
    return Reflect.ownKeys(momentFactory);
  },
  getOwnPropertyDescriptor(_target, prop: string) {
    return Object.getOwnPropertyDescriptor(momentFactory, prop);
  },
});

export default _wrappedFactory;
export const tz: MomentTz = momentFactory.tz!;
