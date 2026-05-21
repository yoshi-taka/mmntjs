import { enableCustomFormatParsing } from "../parse";
import { registerCustomFormatParser } from "../parse";
import { parseWithFormatImpl, parseWithFormatsImpl } from "../parse-format";
import {
  enableCustomFormatParsing as enableCustomFormatParsingLite,
  registerCustomFormatParser as registerCustomFormatParserLite,
} from "../parse-lite";
import {
  enableFormattedInput as enableFormattedInputLite,
  setFormattedStringInputHandler as setFormattedStringInputHandlerLite,
} from "../core/factory-lite-impl";
import { createFromFormattedStringInput } from "../core/factory-input-format";

let registered = false;

export function registerFormatParsePlugin(): void {
  if (registered) {
    return;
  }
  registered = true;
  enableFormattedInputLite();
  setFormattedStringInputHandlerLite(createFromFormattedStringInput);
  enableCustomFormatParsing();
  registerCustomFormatParser(parseWithFormatImpl, parseWithFormatsImpl);
  enableCustomFormatParsingLite();
  registerCustomFormatParserLite(parseWithFormatImpl, parseWithFormatsImpl);
}
