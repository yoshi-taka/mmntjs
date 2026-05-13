import moment from "mmntjs";
import { installTimezone } from "./install";

installTimezone(moment as never);

export default moment;
export const tz = (moment as any).tz;
