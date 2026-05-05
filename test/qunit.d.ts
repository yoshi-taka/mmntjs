export function test(name: string, fn: (assert: unknown) => void): void;
export function only(name: string, fn: (assert: unknown) => void): void;
export function module(name: string, lifecycle?: unknown): void;
