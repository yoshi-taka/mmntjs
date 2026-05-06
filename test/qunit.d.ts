export interface Assert {
  ok(val: unknown, msg?: string): void;
  equal(a: unknown, b: unknown, msg?: string): void;
  strictEqual(a: unknown, b: unknown, msg?: string): void;
  deepEqual(a: unknown, b: unknown, msg?: string): void;
  notEqual(a: unknown, b: unknown, msg?: string): void;
  throws(fn: () => void, msg?: string): void;
  expect(n: number): void;
}

export function test(name: string, fn: (assert: Assert) => void): void;
export function only(name: string, fn: (assert: Assert) => void): void;
export function module(
  name: string,
  lifecycle?: { setup?: () => void; teardown?: () => void } | null,
): void;
