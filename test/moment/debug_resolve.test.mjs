import { test } from 'bun:test';

test('check resolve', async () => {
  const resolved = await Bun.resolve('../../moment', import.meta.url);
  console.log('resolved to:', resolved);
  
  const resolvedFile = await Bun.resolve('../../moment/moment.js', import.meta.url);
  console.log('resolved file to:', resolvedFile);
});
