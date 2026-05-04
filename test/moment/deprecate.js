import { module, test } from '../qunit';
import { deprecate } from '../helpers/deprecate';

module('deprecate');

test('deprecate', function (assert) {
    // NOTE: hooks inside deprecate.js and moment are different, so this is can
    // not be test.expectedDeprecations(...)
    var fn = function () {},
        deprecatedFn = deprecate('testing deprecation', fn);
    deprecatedFn();

    assert.expect(0);
});
