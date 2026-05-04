import { module, test } from '../qunit';
import moment from '../../moment';

module('days in year');

// https://github.com/moment/moment/issues/3717
test('YYYYDDD should not parse DDD=000', function (assert) {
    assert.equal(moment(7000000, moment.ISO_8601, true).isValid(), false, 'test1');
    assert.equal(moment('7000000', moment.ISO_8601, true).isValid(), false, 'test2');
    assert.equal(moment(7000000, moment.ISO_8601, false).isValid(), false, 'test3');
});
