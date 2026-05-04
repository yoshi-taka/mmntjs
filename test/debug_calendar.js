import { module, test } from './qunit.js';
import moment from '../moment.js';

module('calendar debug');

test('passing a function', function (assert) {
    const a = moment().hours(13).minutes(0).seconds(0);
    console.log('a hour:', a.hours(), 'minute:', a.minutes(), 'second:', a.seconds());
    console.log('a format:', a.format());
    console.log('a valueOf:', a.valueOf());
    
    const now = moment();
    console.log('now hour:', now.hours(), 'minute:', now.minutes(), 'second:', now.seconds());
    console.log('now format:', now.format());
    console.log('now valueOf:', now.valueOf());
    
    const diff = a.valueOf() - now.valueOf();
    console.log('diff ms:', diff);
    console.log('diff days:', diff / 86400000);
    console.log('floor:', Math.floor(diff / 86400000));
    
    console.log('a is before now?', a.isBefore(now));
    console.log('a is after now?', a.isAfter(now));
    
    const result = moment(a).calendar(null, {
        sameDay: function () {
            return 'h:mmA';
        },
    });
    console.log('DEBUG result:', JSON.stringify(result));
    assert.equal(result, '1:00PM', 'should equate');
});
