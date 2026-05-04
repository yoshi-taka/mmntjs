import moment from '../../moment';
import momentFile from '../../moment/moment.js';

console.log('moment (dir):', moment?.version, moment?.fn?.clone?.name);
console.log('moment (file):', momentFile?.version, momentFile?.fn?.clone?.name);
console.log('are same?', moment === momentFile);

// Check module URL
console.log('import.meta.url:', import.meta.url);

// Check if moment.fn has clone as enumerable
console.log('fn keys (dir):', Object.getOwnPropertyDescriptor(moment?.fn || {}, 'clone')?.enumerable);
console.log('fn keys (file):', Object.getOwnPropertyDescriptor(momentFile?.fn || {}, 'clone')?.enumerable);
