import { test, expect } from 'bun:test';
import { existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

test('check resolve', () => {
  const dir = dirname(fileURLToPath(import.meta.url));
  const momentDir = resolve(dir, '../../moment');
  console.log('moment dir:', momentDir);
  expect(existsSync(momentDir)).toBe(true);

  const momentFile = resolve(dir, '../../moment/moment.js');
  console.log('moment file:', momentFile);
  expect(existsSync(momentFile)).toBe(true);
});
