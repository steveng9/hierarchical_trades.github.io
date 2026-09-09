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
    // Attributes live in a mutable bag: `min`/`max`/`step` are IDL properties that write
    // through to the attribute, and the code under test relaxes them so a loaded value stays
    // representable. A shim with frozen attributes would hide exactly that.
    const attrs = {min, max, step};
    const input = {
        id, type, _value: '', dataset: {},
        getAttribute: name => attrs[name],
        get min() { return attrs.min; }, set min(v) { attrs.min = String(v); },
        get max() { return attrs.max; }, set max(v) { attrs.max = String(v); },
        get step() { return attrs.step; }, set step(v) { attrs.step = String(v); },
        get value() { return this._value; },
        set value(v) {
            const n = Number(v);
            if (type !== 'range' || !Number.isFinite(n)) { this._value = String(v); return; }
            // Real range-input semantics: clamp to the ends, then snap to the step grid.
            const lo = attrs.min === undefined ? -Infinity : Number(attrs.min);
            const hi = attrs.max === undefined ? Infinity : Number(attrs.max);
            let out = Math.min(hi, Math.max(lo, n));
            if (attrs.step !== undefined && attrs.step !== 'any' && Number.isFinite(lo)) {
                out = lo + Math.round((out - lo) / Number(attrs.step)) * Number(attrs.step);
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

test('readout and slider agree on a value far outside the authored range', async () => {
    // maxHumanAge's slider stops at 10000; a config may legitimately carry more.
    const {inputs, readouts} = installPanel([{id: 'maxHumanAge', min: '100', max: '10000', step: '100'}]);
    const {writeParameterInputs} = await import('../src/browser/domutil.js');

    writeParameterInputs({maxHumanAge: 1000000});
    assert.equal(readouts.maxHumanAge_val.textContent, '1000000',
        'the readout tells the truth about the running value');
    assert.equal(Number(inputs.maxHumanAge.value), 1000000,
        'and the control follows it rather than pegging at its authored maximum');
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

/**
 * The slider itself must land on the loaded value, not merely be described by the readout.
 *
 * The authored `min`/`max` are a comfortable drag range, not the parameter's real domain —
 * the schema owns that. A config carrying a value outside the range used to leave the control
 * clamped to an end while the number beside it read something else, so the panel contradicted
 * itself in the one moment the user is checking what got loaded.
 */
test('a config value outside the authored range still moves the slider onto it', async () => {
    const {inputs, readouts} = installPanel([{id: 'initialHumans', min: '20', max: '500', step: '10'}]);
    const {writeParameterInputs} = await import('../src/browser/domutil.js');

    writeParameterInputs({initialHumans: 1200});

    assert.equal(readouts.initialHumans_val.textContent, '1200', 'readout must show the loaded value');
    assert.equal(Number(inputs.initialHumans.value), 1200,
        'slider must sit on the loaded value, not clamp to max');
});

/** Same contract below the floor. */
test('a config value under the authored minimum moves the slider onto it', async () => {
    const {inputs, readouts} = installPanel([{id: 'initialHumans', min: '20', max: '500', step: '10'}]);
    const {writeParameterInputs} = await import('../src/browser/domutil.js');

    writeParameterInputs({initialHumans: 5});

    assert.equal(readouts.initialHumans_val.textContent, '5');
    assert.equal(Number(inputs.initialHumans.value), 5);
});

/**
 * An off-grid value must not be silently rounded by the control either, and relaxing the step
 * to make that possible must not cost the readout its authored precision.
 */
test('an off-step config value is shown exactly, keeping the authored readout precision', async () => {
    const {inputs, readouts} = installPanel([{id: 'undulation_cutuff', min: '0', max: '0.9', step: '0.05'}]);
    const {writeParameterInputs} = await import('../src/browser/domutil.js');

    writeParameterInputs({undulation_cutuff: 0.37});

    assert.equal(Number(inputs.undulation_cutuff.value), 0.37,
        'slider must sit on 0.37, not snap to the 0.05 grid');
    assert.equal(readouts.undulation_cutuff_val.textContent, '0.37',
        'readout keeps the 2 decimals implied by the authored step="0.05"');
});

/** Values already representable must leave the authored range and step untouched. */
test('an in-range, on-step value does not relax the slider', async () => {
    const {inputs} = installPanel([{id: 'initialHumans', min: '20', max: '500', step: '10'}]);
    const {writeParameterInputs} = await import('../src/browser/domutil.js');

    writeParameterInputs({initialHumans: 300});

    assert.equal(Number(inputs.initialHumans.value), 300);
    assert.equal(inputs.initialHumans.getAttribute('min'), '20', 'min must not be widened');
    assert.equal(inputs.initialHumans.getAttribute('max'), '500', 'max must not be widened');
    assert.equal(inputs.initialHumans.getAttribute('step'), '10', 'step must stay snapped for dragging');
});
