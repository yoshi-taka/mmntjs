import moment from '../../moment';
import { readFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';

// Try to figure out which file was loaded by checking the actual moment factory source
var now = moment();
var proto = Object.getPrototypeOf(now);
var desc = Object.getOwnPropertyDescriptor(proto, 'clone');
console.log('clone enumerable:', desc?.enumerable);
console.log('clone source length:', moment.fn.clone.toString().length);
console.log('clone source:', moment.fn.clone.toString().slice(0, 100));

// Check if we can get the current module's path
console.log('this module:', import.meta.url);

// The string "clone was assigned with proto.clone = clone" appears in the file
// Let's check the full prototype
console.log('all proto own names:', Object.getOwnPropertyNames(proto).join(', '));

// Check the dist moment
import momentDist from '../../moment/dist/moment.js';
console.log('momentDist version:', momentDist.version);
var desc2 = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(momentDist()), 'clone');
console.log('dist clone enumerable:', desc2?.enumerable);
console.log('are same (dir vs dist)?', moment === momentDist);
