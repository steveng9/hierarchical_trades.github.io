/**
 * Show only the controls that matter for the mechanics currently chosen in the panel.
 *
 * Driven by the selectors, not by the running simulation: the parameter panel is where the
 * NEXT run is set up, so choosing a mechanic re-shapes the panel at once, before any Reset.
 * (Overlay buttons, which inspect the running simulation, follow the reset instead; see
 * main.js.) The relevance rules themselves live in src/mechanics/relevance.js.
 *
 * Hidden inputs keep their values and are still read on Reset. That is harmless, since by
 * construction nothing the chosen mechanics run reads them, and it means switching a
 * mechanic away and back restores whatever the user had set.
 */
import {PARAM_SCHEMA} from '../core/params.js';
import {isParamRelevant, isFamilyActive} from '../mechanics/relevance.js';
import {readMechanicInputs} from './domutil.js';

const MECHANIC_SELECT = 'select[id^="mechanic_"]';

/** Re-apply visibility to every parameter row, section, and mechanic selector. */
export function refreshParameterPanel() {
    const selection = readMechanicInputs();

    for (const input of document.querySelectorAll('#parameters input[id]')) {
        if (!PARAM_SCHEMA[input.id]) continue;
        const row = input.closest('.param-row, .check-row');
        if (row) row.hidden = !isParamRelevant(input.id, selection);
    }
    // A section whose every row is hidden goes too, heading and all.
    for (const section of document.querySelectorAll('#parameters .parameter-section')) {
        const rows = section.querySelectorAll('.param-row, .check-row');
        section.hidden = rows.length > 0 && [...rows].every(row => row.hidden);
    }
    // A family whose choice cannot matter (e.g. pricing under pairwise) hides its selector.
    for (const select of document.querySelectorAll(MECHANIC_SELECT)) {
        const row = select.closest('.param-row');
        if (row) row.hidden = !isFamilyActive(select.id.replace('mechanic_', ''), selection);
    }
}

/** Refresh whenever a mechanic selector changes. Installed once, at boot. */
export function watchMechanicSelectors() {
    document.addEventListener('change', event => {
        if (event.target.matches?.(MECHANIC_SELECT)) refreshParameterPanel();
    });
}
