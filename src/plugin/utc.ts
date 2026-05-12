import { moment, nowFn } from "../core/factory-lite";
import { registerUtcApi } from "../plugins/utc";

registerUtcApi(moment as never, { nowFn });

export {};
