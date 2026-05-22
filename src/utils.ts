export function lowerVariant(fmt: string): string {
  return fmt
    .replaceAll("MMMM", "MMM")
    .replaceAll("dddd", "ddd")
    .replaceAll("MM", "M")
    .replaceAll("DD", "D")
    .replaceAll("mm", "m")
    .replaceAll("ss", "s")
    .replaceAll("hh", "h");
}

export function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

export function pad3(n: number): string {
  return n < 10 ? `00${n}` : n < 100 ? `0${n}` : String(n);
}

export function padYear(y: number): string {
  const abs = Math.abs(y);
  const s = abs < 10 ? `000${abs}` : abs < 100 ? `00${abs}` : abs < 1000 ? `0${abs}` : String(abs);
  return y < 0 ? `-${s}` : y > 9999 ? `+${s}` : s;
}

export function zeroFill(num: number, targetLength: number): string {
  const sign = num < 0 ? "-" : "";
  const abs = Math.abs(num).toString();
  const padding = targetLength - abs.length;
  if (padding <= 0) {
    return sign + abs;
  }
  return sign + "0".repeat(padding) + abs;
}

export function isArray(input: unknown): input is unknown[] {
  return Array.isArray(input);
}

export function isObject(input: unknown): input is Record<string, unknown> {
  return typeof input === "object" && input !== null && !Array.isArray(input);
}

export function isNumber(input: unknown): input is number {
  return typeof input === "number" || Object.prototype.toString.call(input) === "[object Number]";
}

export function isDate(input: unknown): input is Date {
  return input instanceof Date || Object.prototype.toString.call(input) === "[object Date]";
}

export function isMoment(input: unknown): input is { _isAMomentObject: boolean } {
  const momentLike =
    typeof input === "object" && input !== null
      ? (input as { _isAMomentObject: boolean })
      : undefined;
  return momentLike?._isAMomentObject === true;
}

export function isString(input: unknown): input is string {
  return typeof input === "string";
}

export function isFunction(input: unknown): input is Function {
  return typeof input === "function";
}

export function isObjectEmpty(obj: object): boolean {
  for (const k in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, k)) {
      return false;
    }
  }
  return true;
}

export function hasOwnProp(obj: object, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(obj, key);
}

export function absFloor(number: number): number {
  if (number < 0) {
    return Math.ceil(number) || 0;
  }
  return Math.floor(number);
}

export function createDate(
  year: number,
  month: number,
  day = 1,
  ...args: [number?, number?, number?, number?]
): Date {
  const [hour, minute, second, ms] = args;
  if (year >= 0 && year <= 99) {
    const d = new Date(0);
    d.setFullYear(year, month, day);
    d.setHours(hour ?? 0, minute ?? 0, second ?? 0, ms ?? 0);
    return d;
  }
  return new Date(year, month, day, hour ?? 0, minute ?? 0, second ?? 0, ms ?? 0);
}

export function createUTCDate(
  year: number,
  month: number,
  day = 1,
  ...args: [number?, number?, number?, number?]
): Date {
  const [hour, minute, second, ms] = args;
  if (year >= 0 && year <= 99) {
    const d = new Date(0);
    d.setUTCFullYear(year, month, day);
    d.setUTCHours(hour ?? 0, minute ?? 0, second ?? 0, ms ?? 0);
    return d;
  }
  return new Date(Date.UTC(year, month, day, hour ?? 0, minute ?? 0, second ?? 0, ms ?? 0));
}

export function createDateSafe(
  ...args: [number, number, number, number, number, number, number, boolean?]
): Date {
  const [year, month, day, hour, minute, second, ms, isUTC] = args;
  if (isUTC) {
    return createUTCDate(year, month, day, hour, minute, second, ms);
  }
  return createDate(year, month, day, hour, minute, second, ms);
}

export function escapeRegex(str: string): string {
  return str.replaceAll(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function parseTwoDigitYear(str: string): number {
  const num = parseInt(str, 10);
  return num > 68 ? 1900 + num : 2000 + num;
}

export class LruMap<K, V> {
  private readonly max: number;
  private readonly map: Map<K, V>;

  constructor(max: number) {
    this.max = max;
    this.map = new Map();
  }

  get(key: K): V | undefined {
    const value = this.map.get(key);
    if (value !== undefined) {
      this.map.delete(key);
      this.map.set(key, value);
    }
    return value;
  }

  set(key: K, value: V): void {
    if (this.map.has(key)) {
      this.map.delete(key);
    }
    this.map.set(key, value);
    if (this.map.size > this.max) {
      const oldest = this.map.keys().next().value;
      if (oldest !== undefined) {
        this.map.delete(oldest);
      }
    }
  }

  clear(): void {
    this.map.clear();
  }

  get size(): number {
    return this.map.size;
  }
}
