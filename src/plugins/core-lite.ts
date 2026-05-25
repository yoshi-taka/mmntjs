import { MomentLite } from "../moment-lite";
import { isMoment, isDate, isArray } from "../utils";

type LiteMomentTarget = ((
  input?: unknown,
  format?: unknown,
  localeOrStrict?: unknown,
  fourthArg?: unknown,
) => MomentLite) &
  Record<string, unknown>;

export type LiteCoreApiDeps = {
  getMomentNowFunction: () => (() => number) | undefined;
  setMomentNowFunction: (fn: (() => number) | undefined) => void;
  parseTwoDigitYearInternal: (str: string) => number;
  setParseTwoDigitYear: (fn: ((str: string) => number) | undefined) => void;
  momentUTC: (
    input?: unknown,
    format?: unknown,
    localeOrStrict?: unknown,
    fourthArg?: unknown,
  ) => MomentLite;
};

function attachLiteCoreApi(target: LiteMomentTarget, deps: LiteCoreApiDeps): LiteMomentTarget {
  const momentRecord = target as unknown as Record<string, unknown>;
  const utc = function (
    input?: unknown,
    format?: unknown,
    localeOrStrict?: unknown,
    fourthArg?: unknown,
  ): MomentLite {
    return deps.momentUTC(input, format, localeOrStrict, fourthArg);
  };

  momentRecord.fn = MomentLite.prototype;
  momentRecord.prototype = MomentLite.prototype;
  momentRecord.version = "2.30.1";
  momentRecord.isMoment = isMoment;
  momentRecord.isDate = isDate;
  momentRecord.createFromInputFallback = function (_input?: unknown): void {
    // no-op hook for compatibility
  };
  momentRecord.config = function (_key?: string, _value?: unknown): void {
    // no-op for compatibility
  };
  momentRecord.report = function (_type?: string): void {
    // no-op for compatibility
  };
  momentRecord.ISO_8601 = "ISO_8601";
  momentRecord.unix = function (ts: number): MomentLite {
    return target(ts * 1000);
  };
  momentRecord.invalid = function (input?: unknown): MomentLite {
    const config: Record<string, unknown> = {
      _d: new Date(NaN),
      _isValid: false,
      _userInvalidated: input === undefined,
    };
    if (
      typeof input === "object" &&
      input !== null &&
      !isArray(input) &&
      !isMoment(input) &&
      !isDate(input)
    ) {
      for (const key of Object.keys(input)) {
        config[`_${key}`] = (input as Record<string, unknown>)[key];
      }
      config._i = input;
    } else {
      config._i = input;
    }
    return new MomentLite(config as never);
  };
  momentRecord.utc = utc;
  (utc as unknown as Record<string, unknown>).parseTwoDigitYear = deps.parseTwoDigitYearInternal;

  Object.defineProperty(target, "now", {
    get(): () => number {
      return deps.getMomentNowFunction() ?? (() => Date.now());
    },
    set(v: (() => number) | undefined) {
      deps.setMomentNowFunction(v ?? undefined);
    },
    enumerable: true,
    configurable: true,
  });
  Object.defineProperty(target, "parseTwoDigitYear", {
    get() {
      return (str: string) => {
        const fn = deps.parseTwoDigitYearInternal;
        return fn(str);
      };
    },
    set(v: ((str: string) => number) | undefined) {
      deps.setParseTwoDigitYear(v ?? undefined);
    },
    enumerable: true,
    configurable: true,
  });
  Object.defineProperty(target, "defaultFormat", {
    get(): string {
      return "YYYY-MM-DDTHH:mm:ssZ";
    },
    set(v: string) {
      // lite build: no-op for compatibility
    },
    enumerable: true,
    configurable: true,
  });
  Object.defineProperty(target, "defaultFormatUtc", {
    get(): string {
      return "YYYY-MM-DDTHH:mm:ss[Z]";
    },
    set(v: string) {
      // lite build: no-op for compatibility
    },
    enumerable: true,
    configurable: true,
  });
  return target;
}

export function createLiteCoreApi(
  baseMoment: LiteMomentTarget,
  deps: LiteCoreApiDeps,
): LiteMomentTarget {
  const target = function (
    input?: unknown,
    format?: unknown,
    localeOrStrict?: unknown,
    fourthArg?: unknown,
  ): MomentLite {
    return baseMoment(input, format, localeOrStrict, fourthArg);
  } as LiteMomentTarget;

  return attachLiteCoreApi(target, deps);
}

function registerLiteCoreApi(target: LiteMomentTarget, deps: LiteCoreApiDeps): void {
  attachLiteCoreApi(target, deps);
}
