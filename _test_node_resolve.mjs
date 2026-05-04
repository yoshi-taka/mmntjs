import { createRequire } from 'module';
const require = createRequire(import.meta.url);
// Resolve relative to test/moment/create.js location
const resolved = require.resolve('../../moment', { paths: ['/Users/as/var/localrepos/moment2/test/moment'] });
console.log('Node resolves to:', resolved);

// Now test with bun-style import
import moment from '../../moment';
console.log('version:', moment.version);
console.log('clone enum:', Object.getOwnPropertyDescriptor(Object.getPrototypeOf(moment()), 'clone')?.enumerable);
