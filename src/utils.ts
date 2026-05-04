export function zeroFill(num: number, targetLength: number): string {
  const sign = num < 0 ? "-" : "";
  const abs = Math.abs(num).toString();
  const padding = targetLength - abs.length;
  if (padding <= 0) {return sign + abs;}
  return sign + "0".repeat(padding) + abs;
}

export function isArray(input: any): input is any[] {
  return Array.isArray(input);
}

export function isObject(input: any): input is Record<string, any> {
  return typeof input === "object" && input !== null && !Array.isArray(input);
}

export function isNumber(input: any): input is number {
  return typeof input === "number" || Object.prototype.toString.call(input) === "[object Number]";
}

export function isDate(input: any): input is Date {
  return input instanceof Date || Object.prototype.toString.call(input) === "[object Date]";
}

export function isMoment(input: any): input is { _isAMomentObject: boolean } {
  return input !== null && input !== undefined && input._isAMomentObject === true;
}

export function isString(input: any): input is string {
  return typeof input === "string";
}

export function isUndefined(input: any): input is undefined {
  return input === void 0;
}

export function isBoolean(input: any): input is boolean {
  return typeof input === "boolean";
}

export function isFunction(input: any): input is Function {
  return typeof input === "function";
}

export function isObjectEmpty(obj: any): boolean {
  for (const k in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, k)) {return false;}
  }
  return true;
}

export function hasOwnProp(obj: any, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(obj, key);
}

export function extend(a: any, b: any, ...others: any[]): any {
  for (let i = 0; i < others.length; i++) {
    const source = others[i];
    if (source != null) {
      for (const key in source) {
        if (hasOwnProp(source, key)) {
          a[key] = source[key];
        }
      }
    }
  }
  if (b != null) {
    for (const key in b) {
      if (hasOwnProp(b, key)) {
        a[key] = b[key];
      }
    }
  }
  return a;
}

export function absFloor(number: number): number {
  if (number < 0) {
    return Math.ceil(number) || 0;
  }
  return Math.floor(number);
}

export function absRound(number: number): number {
  if (number < 0) {
    return Math.round(number * -1) * -1;
  }
  return Math.round(number);
}

// eslint-disable-next-line max-params
export function createDate(
  year: number,
  month: number,
  day: number,
  hour?: number,
  minute?: number,
  second?: number,
  ms?: number,
): Date {
  if (year >= 0 && year <= 99) {
    const d = new Date(0);
    d.setFullYear(year, month, day ?? 1);
    d.setHours(hour ?? 0, minute ?? 0, second ?? 0, ms ?? 0);
    return d;
  }
  return new Date(year, month, day ?? 1, hour ?? 0, minute ?? 0, second ?? 0, ms ?? 0);
}

// eslint-disable-next-line max-params
export function createUTCDate(
  year: number,
  month: number,
  day: number,
  hour?: number,
  minute?: number,
  second?: number,
  ms?: number,
): Date {
  if (year >= 0 && year <= 99) {
    const d = new Date(0);
    d.setUTCFullYear(year, month, day ?? 1);
    d.setUTCHours(hour ?? 0, minute ?? 0, second ?? 0, ms ?? 0);
    return d;
  }
  return new Date(Date.UTC(year, month, day ?? 1, hour ?? 0, minute ?? 0, second ?? 0, ms ?? 0));
}

// eslint-disable-next-line max-params
export function createDateSafe(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  second: number,
  ms: number,
  isUTC?: boolean,
): Date {
  if (isUTC) {
    return createUTCDate(year, month, day, hour, minute, second, ms);
  }
  return createDate(year, month, day, hour, minute, second, ms);
}

export function escapeRegex(str: string): string {
  return str.replaceAll(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export class LruMap<K, V> {
  private max: number;
  private map: Map<K, V>;

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
      if (oldest !== undefined) {this.map.delete(oldest);}
    }
  }

  clear(): void {
    this.map.clear();
  }

  get size(): number {
    return this.map.size;
  }
}
