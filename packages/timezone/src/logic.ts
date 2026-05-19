import * as mmntjs from "mmntjs";
import { installTimezone, type MomentLike, type MomentTz } from "./install";

const momentFactory = ((mmntjs as unknown as Record<string, unknown>).moment ??
  (mmntjs as unknown as Record<string, unknown>).default ??
  mmntjs) as unknown as MomentLike;

installTimezone(momentFactory);

export default momentFactory;
export const tz: MomentTz = momentFactory.tz!;
