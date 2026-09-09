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
    // `data-step` holds the authored step when `fitRange` has had to relax the live one to
    // "any"; the readout width must keep following what the panel was designed to show.
    const step = input.dataset.step || input.getAttribute('step');
    if (!step || step === 'any') return 0;
    const dot = step.indexOf('.');
    return dot === -1 ? 0 : step.length - dot - 1;
}

/**
 * Widen an input's bounds so it can actually sit on `value`.
 *
 * A range input silently clamps to `min`/`max` and snaps to `step`, so a config carrying a
 * value the authored range cannot express leaves the control parked somewhere else entirely
 * while the readout reports the truth — the panel then contradicts itself, which is exactly
 * the mismatch this is here to prevent. The authored bounds are a convenient drag range, not
 * a constraint (the schema validates the real limits), so stretching them to admit a value
 * the simulation is genuinely running loses nothing.
 *
 * Relaxing `step` to "any" is likewise only about representability: the authored value is
 * kept in `data-step` so the readout's precision, and any later re-tightening, still follow it.
 */
function fitRange(input, value) {
    const min = parseFloat(input.getAttribute('min'));
    const max = parseFloat(input.getAttribute('max'));
    if (Number.isFinite(min) && value < min) input.min = String(value);
    if (Number.isFinite(max) && value > max) input.max = String(value);

    const step = input.getAttribute('step');
    if (!step || step === 'any') return;
    const stepSize = parseFloat(step);
    if (!Number.isFinite(stepSize) || stepSize <= 0) return;
    const base = Number.isFinite(parseFloat(input.getAttribute('min'))) ? parseFloat(input.getAttribute('min')) : 0;
    const offset = (value - base) / stepSize;
    if (Math.abs(offset - Math.round(offset)) > 1e-9) {
        if (!input.dataset.step) input.dataset.step = step;
        input.step = 'any';
    }
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
        if (typeof value === 'number' && Number.isFinite(value)) fitRange(input, value);
        input.value = value;

        // The readout is taken from `params`, not from `input.value`. `fitRange` above makes
        // the control able to sit on the real value in every case it can, but this stays the
        // authoritative source: if a bound ever cannot be stretched, the number beside the
        // slider is still the one the simulation is actually running.
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
