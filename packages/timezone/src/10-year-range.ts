import * as mmntjs from "mmntjs";
import { installTimezone, type MomentLike, type MomentTz } from "./install-core";
import { Z, L, C, N, V, T } from "./builtin-data-10-year-range.generated";

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

export default momentFactory;
export const tz: MomentTz = momentFactory.tz!;
