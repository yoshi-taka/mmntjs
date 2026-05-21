import { moment, nowFn } from "../core/factory-lite";
import { MomentLite } from "../moment-lite";
import { registerUtcApi } from "../plugins/utc";

registerUtcApi(moment as never, { nowFn, ctor: MomentLite });

export {};
