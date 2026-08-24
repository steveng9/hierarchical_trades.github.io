/** CSS colour helpers for the canvas layer. */
export function rgb(r, g, b) { return `rgb(${r},${g},${b})`; }
export function hsl(h, s, l) { return `hsl(${h},${s}%,${l}%)`; }

/** Per-resource palette, indexed by resource. Shared by every panel so colours agree. */
export const RESOURCE_COLORS = ['#cc3333', '#33aa44', '#3355cc', '#cc9922', '#993399'];
export const RESOURCE_LABELS = ['R', 'G', 'B', 'Y', 'P'];
