import { test, describe } from 'bun:test';
import moment from './moment/moment.js';

test('clone enumerable', () => {
    var now = moment();
    var extend = function (a, b) { for (var i in b) a[i] = b[i]; return a; };
    var obj = extend({}, now);
    if (typeof obj.clone !== 'function') {
        throw new Error('clone not a function: ' + typeof obj.clone);
    }
    console.log('clone works:', +obj.clone() === +now);
});
