import { test } from 'bun:test';
import moment from '../../moment';

test('check moment source', () => {
  console.log('moment version:', moment.version);
  var now = moment();
  var proto = Object.getPrototypeOf(now);
  var desc = Object.getOwnPropertyDescriptor(proto, 'clone');
  console.log('clone enumerable:', desc?.enumerable);

  // Check if moment has _isAMomentObject
  console.log('_isAMomentObject:', now._isAMomentObject);
  
  var extend = function (a, b) { for (var i in b) a[i] = b[i]; return a; };
  var obj = extend({}, now);
  console.log('obj.clone type:', typeof obj.clone);
  console.log('Object.keys(obj):', Object.keys(obj).length);
  console.log('moment.prototype keys:', Object.keys(proto).length);
});
