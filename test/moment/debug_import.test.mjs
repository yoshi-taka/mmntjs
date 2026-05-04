import { test } from 'bun:test';
import moment from '../../moment';

test('check moment source', () => {
  console.log('moment version:', moment.version);
  var now = moment();
  var proto = Object.getPrototypeOf(now);
  var desc = Object.getOwnPropertyDescriptor(proto, 'clone');
  console.log('clone enumerable:', desc?.enumerable);
  console.log('clone writable:', desc?.writable);

  var extend = function (a, b) { for (var i in b) a[i] = b[i]; return a; };
  var obj = extend({}, now);
  console.log('obj.clone type:', typeof obj.clone);
  if (typeof obj.clone !== 'function') {
    console.log('FAIL: clone not a function');
    console.log('now own keys:', Object.getOwnPropertyNames(now).slice(0, 10));
    console.log('proto keys:', Object.getOwnPropertyNames(proto).slice(0, 10));
  }
});
