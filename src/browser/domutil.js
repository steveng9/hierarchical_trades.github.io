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

/** Push resolved parameter values back into the control panel inputs. */
export function writeParameterInputs(params) {
    document.querySelectorAll('#parameters input').forEach(input => {
        const key = input.id;
        if (!key || !(key in params)) return;
        if (input.type === 'checkbox') input.checked = Boolean(params[key]);
        else input.value = params[key];
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
