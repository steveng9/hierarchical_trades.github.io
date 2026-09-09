/**
 * Control-panel writeback.
 *
 * The bug these lock in: loading a saved config moved every slider but left the number
 * beside it showing the previous run's value. The `<span id="<key>_val">` readouts are
 * written only by each slider's inline `oninput` handler, and that does not fire on a
 * programmatic assignment to `input.value` — which is exactly how the config-load path
 * writes them. Reported as "I loaded a config with 300 initial agents and the slider read
 * 500" (500 being the schema default left over from boot).
 *
 * The shim models the two range-input behaviours that matter and are easy to forget:
 * assigning to `.value` snaps to `step` and clamps to `min`/`max`.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

/** One control-panel row: the input plus its readout span. */
function makeInput({id, type = 'range', min, max, step}) {
    const readout = {textContent: ''};
    const input = {
        id, type, _value: '',
        getAttribute: name => ({min, max, step}[name]),
        get value() { return this._value; },
        set value(v) {
            const n = Number(v);
            if (type !== 'range' || !Number.isFinite(n)) { this._value = String(v); return; }
            // Real range-input semantics: clamp to the ends, then snap to the step grid.
            const lo = min === undefined ? -Infinity : Number(min);
            const hi = max === undefined ? Infinity : Number(max);
            let out = Math.min(hi, Math.max(lo, n));
            if (step !== undefined && step !== 'any' && Number.isFinite(lo)) {
                out = lo + Math.round((out - lo) / Number(step)) * Number(step);
                out = Math.min(hi, Math.max(lo, Number(out.toFixed(10))));
            }
            this._value = String(out);
        },
    };
    return {input, readout};
}

function installPanel(rows) {
    const inputs = [], readouts = {};
    for (const spec of rows) {
        const {input, readout} = makeInput(spec);
        inputs.push(input);
        readouts[spec.id + '_val'] = readout;
    }
    globalThis.document = {
        querySelectorAll: sel => (sel === '#parameters input' ? inputs : []),
        getElementById: id => readouts[id] ?? null,
    };
    return {inputs: Object.fromEntries(inputs.map(i => [i.id, i])), readouts};
}

test('config load writes the readout, not just the slider', async () => {
    // initialHumans as it is actually declared in index.html.
    const {inputs, readouts} = installPanel([{id: 'initialHumans', min: '20', max: '500', step: '10'}]);
    const {writeParameterInputs} = await import('../src/browser/domutil.js');

    writeParameterInputs({initialHumans: 500});          // boot default
    assert.equal(readouts.initialHumans_val.textContent, '500');

    writeParameterInputs({initialHumans: 300});          // then load a 300-agent config
    assert.equal(inputs.initialHumans.value, '300', 'slider position follows the config');
    assert.equal(readouts.initialHumans_val.textContent, '300',
        'readout must follow too — this is the reported bug: it stayed at 500');
});

test('readout reports the true value when the slider cannot represent it', async () => {
    // maxHumanAge's slider stops at 10000; a config may legitimately carry more.
    const {inputs, readouts} = installPanel([{id: 'maxHumanAge', min: '100', max: '10000', step: '100'}]);
    const {writeParameterInputs} = await import('../src/browser/domutil.js');

    writeParameterInputs({maxHumanAge: 1000000});
    assert.equal(inputs.maxHumanAge.value, '10000', 'the control pegs at its maximum');
    assert.equal(readouts.maxHumanAge_val.textContent, '1000000',
        'the readout still tells the truth about the running value');
});

test('readout precision follows the input step', async () => {
    const {readouts} = installPanel([
        {id: 'undulation_cutuff', min: '0', max: '1', step: '0.01'},
        {id: 'resourceRegenRate', min: '0', max: '0.02', step: '0.0001'},
        {id: 'numResources', min: '2', max: '10', step: '1'},
    ]);
    const {writeParameterInputs} = await import('../src/browser/domutil.js');

    writeParameterInputs({undulation_cutuff: 0.25, resourceRegenRate: 0.0045, numResources: 4});
    assert.equal(readouts.undulation_cutuff_val.textContent, '0.25');
    assert.equal(readouts.resourceRegenRate_val.textContent, '0.0045');
    assert.equal(readouts.numResources_val.textContent, '4');
});

test('checkboxes are written and carry no readout', async () => {
    const {inputs} = installPanel([{id: 'resourceDepletion', type: 'checkbox'}]);
    const {writeParameterInputs} = await import('../src/browser/domutil.js');

    writeParameterInputs({resourceDepletion: false});
    assert.equal(inputs.resourceDepletion.checked, false);
    writeParameterInputs({resourceDepletion: true});
    assert.equal(inputs.resourceDepletion.checked, true);
});
