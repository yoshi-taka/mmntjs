import { test } from 'bun:test';
import moment from '../../moment/moment.js';

test('check moment source direct', () => {
  console.log('moment version:', moment.version);
  var now = moment();
  var proto = Object.getPrototypeOf(now);
  var desc = Object.getOwnPropertyDescriptor(proto, 'clone');
  console.log('clone enumerable:', desc?.enumerable);
  
  var extend = function (a, b) { for (var i in b) a[i] = b[i]; return a; };
  var obj = extend({}, now);
  console.log('obj.clone type:', typeof obj.clone);
});
