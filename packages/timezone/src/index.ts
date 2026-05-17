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

export default moment;
export const tz: MomentTz = (moment as unknown as MomentLike).tz!;
