import moment from "mmntjs";
import { installTimezone, type MomentLike, type MomentTz } from "./install-core";
import { BUILTIN_TZDATA } from "./builtin-data-1970-2030.generated";

installTimezone(moment as unknown as MomentLike, BUILTIN_TZDATA);

export default moment;
export const tz: MomentTz = (moment as unknown as MomentLike).tz!;
