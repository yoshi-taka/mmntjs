import moment from "mmntjs";
import { installTimezone, type MomentLike, type MomentTz } from "./install";

installTimezone(moment as unknown as MomentLike);

export default moment;
export const tz: MomentTz = (moment as unknown as MomentLike).tz!;
