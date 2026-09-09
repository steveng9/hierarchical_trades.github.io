/**
 * DOM helpers used only by the browser shell.
 *
 * Separated from the numeric helpers that moved to `src/core/mathutil.js`: those are used by
 * the kernel and must stay free of any `document` reference.
 */

/** Trigger a client-side file download. */
export function download(filename, text) {
    const a = document.createElement('a');
    a.setAttribute('href', 'data:text/plain;charset=utf-8,' + encodeURIComponent(text));
    a.setAttribute('download', filename);
    a.click();
}

/**
 * Read every parameter input in the control panel.
 *
 * Returns overrides rather than mutating a global, so the values flow through the schema's
 * validation on the next simulation construction. Inputs whose id is not a known parameter
 * are ignored here and rejected later by `resolveParams`.
 */
export function readParameterInputs() {
    const overrides = {};
    document.querySelectorAll('#parameters input').forEach(input => {
        const key = input.id;
        if (!key) return;
        if (input.type === 'checkbox') {
            overrides[key] = input.checked;
        } else {
            const value = parseFloat(input.value);
            if (!Number.isNaN(value)) overrides[key] = value;
        }
    });
    return overrides;
}

/**
 * Decimal places a parameter's readout should show, derived from its input's `step`.
 *
 * Each slider's `oninput` attribute carries its own hand-written `toFixed(n)` for the live
 * drag case; deriving the same width from `step` here keeps the two in agreement by
 * construction instead of by maintenance (it reproduces all 32 of them exactly today).
 */
function readoutDecimals(input) {
    const step = input.getAttribute('step');
    if (!step || step === 'any') return 0;
    const dot = step.indexOf('.');
    return dot === -1 ? 0 : step.length - dot - 1;
}

/**
 * Push resolved parameter values back into the control panel inputs.
 *
 * Also refreshes each parameter's `<span id="<key>_val">` readout. Those spans are otherwise
 * only written by the slider's own `oninput` handler, which fires on user input but NOT on a
 * programmatic assignment to `input.value` — so without this, loading a saved config moved
 * every slider while leaving all the numbers beside them showing the previous run's values.
 */
export function writeParameterInputs(params) {
    document.querySelectorAll('#parameters input').forEach(input => {
        const key = input.id;
        if (!key || !(key in params)) return;
        const value = params[key];
        if (input.type === 'checkbox') {
            input.checked = Boolean(value);
            return;
        }
        input.value = value;

        // The readout is taken from `params`, not from `input.value`: a range input silently
        // snaps to its `step` and clamps to its `min`/`max`, so whenever the panel cannot
        // represent a value exactly the control is only an approximation and the readout is
        // the one place the true number can still be shown.
        const readout = document.getElementById(key + '_val');
        if (readout && typeof value === 'number' && Number.isFinite(value)) {
            readout.textContent = value.toFixed(readoutDecimals(input));
        }
    });
}

/** Read mechanic selections from any <select> elements with id="mechanic_*". */
export function readMechanicInputs() {
    const overrides = {};
    document.querySelectorAll('select[id^="mechanic_"]').forEach(sel => {
        const mechanic = sel.id.replace('mechanic_', '');
        if (sel.value) overrides[mechanic] = sel.value;
    });
    return overrides;
}

export function setDatabaseIndicator(connected) {
    const el = document.getElementById('db');
    if (!el) return;
    el.classList.toggle('db-connected', connected);
    el.classList.toggle('db-disconnected', !connected);
}
