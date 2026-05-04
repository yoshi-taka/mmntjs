import moment from './moment/moment.js';
var now = moment();
var proto = Object.getPrototypeOf(now);
var desc = Object.getOwnPropertyDescriptor(proto, 'clone');
console.log('enumerable:', desc ? desc.enumerable : 'not found on proto');
console.log('has clone:', 'clone' in now)
var extend = function (a, b) { for (var i in b) a[i] = b[i]; return a; };
var obj = extend({}, now);
console.log('clone on obj:', typeof obj.clone);
try { console.log(+obj.clone()); } catch(e) { console.log(e.message); }
