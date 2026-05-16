import moment from "mmntjs";
import { installTimezone, type MomentLike } from "./install";

installTimezone(moment as unknown as MomentLike);

export default moment;
export const tz = (moment as unknown as MomentLike).tz!;
