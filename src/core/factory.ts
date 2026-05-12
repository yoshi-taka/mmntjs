import {
  parseString,
  parseArray,
  parseObject,
  isCustomFormatParsingEnabled,
} from "../parse";
import { createMomentFactory } from "./factory-shared";
import { createFromFormattedStringInput } from "./factory-input-format";
import { createFromArrayInput, createFromObjectInput } from "./factory-input-struct";

let momentNowFn: (() => number) | undefined;

export function setMomentNowFunction(fn: (() => number) | undefined): void {
  momentNowFn = fn;
}

export function getMomentNowFunction(): (() => number) | undefined {
  return momentNowFn;
}

export function nowFn(): number {
  return momentNowFn ? momentNowFn() : Date.now();
}

export const moment = createMomentFactory({
  parseString,
  parseArray,
  parseObject,
  isCustomFormatParsingEnabled,
  createFromFormattedStringInput,
  createFromArrayInput,
  createFromObjectInput,
  nowFn,
});
