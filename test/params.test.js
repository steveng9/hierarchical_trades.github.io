import test from 'node:test';
import assert from 'node:assert/strict';
import {resolveParams, defaultParams, paramsFingerprint, PARAM_SCHEMA, dynamicsKeys} from '../src/core/params.js';

test('defaults fill every schema key', () => {
    const p = defaultParams();
    for (const key of Object.keys(PARAM_SCHEMA)) assert.ok(key in p, `missing ${key}`);
});

test('unknown keys throw in strict mode and are ignored otherwise', () => {
    assert.throws(() => resolveParams({nonsense: 1}), /Unknown parameter/);
    assert.doesNotThrow(() => resolveParams({nonsense: 1}, {strict: false}));
});

test('range violations throw', () => {
    assert.throws(() => resolveParams({numResources: 99}), /above its maximum/);
    assert.throws(() => resolveParams({initialHumans: 0}), /below its minimum/);
});

test('types are coerced', () => {
    const p = resolveParams({initialHumans: '250', resourceDepletion: 'true', surplus_multiplier: '0.5'});
    assert.equal(p.initialHumans, 250);
    assert.equal(p.resourceDepletion, true);
    assert.equal(p.surplus_multiplier, 0.5);
});

test('corrected spellings alias onto canonical keys', () => {
    assert.equal(resolveParams({undulation_cutoff: 0.7}).undulation_cutuff, 0.7);
});

test('maxTradeLevel accepts null for unlimited depth', () => {
    assert.equal(resolveParams({maxTradeLevel: null}).maxTradeLevel, null);
    assert.equal(resolveParams({maxTradeLevel: 2}).maxTradeLevel, 2);
});

test('fingerprint tracks dynamics params and ignores display params', () => {
    const base = resolveParams({});
    assert.equal(paramsFingerprint(base), paramsFingerprint(resolveParams({})));
    assert.notEqual(paramsFingerprint(base), paramsFingerprint(resolveParams({surplus_multiplier: 0.9})));
    // Display-only changes must not create a new run identity.
    assert.equal(paramsFingerprint(base), paramsFingerprint(resolveParams({margin: 99, show_social_reach: true})));
});

test('display params are excluded from the dynamics key set', () => {
    const keys = dynamicsKeys();
    assert.ok(!keys.includes('margin'));
    assert.ok(keys.includes('surplus_multiplier'));
});
