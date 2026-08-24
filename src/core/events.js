/**
 * Synchronous event bus connecting the kernel to probes.
 *
 * Measurement must not be hard-coded into the simulation: each research group needs a
 * different set of metrics, and adding one should never mean editing `human.js`. The
 * kernel emits a fixed vocabulary of events; probes subscribe. With no subscribers,
 * `emit` is a map lookup and a return, so an uninstrumented sweep pays almost nothing.
 *
 * Handlers are called synchronously in subscription order and must not throw — a throwing
 * probe would corrupt the tick it fired in. Errors are collected and surfaced by the
 * runner instead.
 */

/** The event vocabulary. Emitting an unlisted name throws, to catch typos at the source. */
export const EVENTS = Object.freeze({
    TICK_START:      'tick:start',
    TICK_END:        'tick:end',
    HUMAN_BORN:      'human:born',
    HUMAN_DIED:      'human:died',
    TRADE_BUILT:     'trade:built',
    TRADE_INVOKED:   'trade:invoked',
    TRADE_DEPRECATED:'trade:deprecated',
    MANAGER_ADDED:   'manager:added',
    SURPLUS_PAID:    'surplus:paid',
});

const VALID_EVENTS = new Set(Object.values(EVENTS));

export class EventBus {
    constructor() {
        this.handlers = new Map();
        this.errors = [];
    }

    /** Subscribe. Returns an unsubscribe function. */
    on(event, handler) {
        if (!VALID_EVENTS.has(event)) {
            throw new Error(`Unknown event "${event}". Add it to EVENTS in src/core/events.js.`);
        }
        if (!this.handlers.has(event)) this.handlers.set(event, []);
        this.handlers.get(event).push(handler);
        return () => {
            const list = this.handlers.get(event);
            const i = list.indexOf(handler);
            if (i >= 0) list.splice(i, 1);
        };
    }

    /**
     * Fire an event. Hot path — called several times per agent per tick — so the
     * no-subscriber case must stay cheap.
     */
    emit(event, payload) {
        const list = this.handlers.get(event);
        if (list === undefined || list.length === 0) return;
        for (let i = 0; i < list.length; i++) {
            try {
                list[i](payload);
            } catch (err) {
                this.errors.push({event, error: err});
            }
        }
    }

    /** True if anything is listening. Lets callers skip building an expensive payload. */
    hasListeners(event) {
        const list = this.handlers.get(event);
        return list !== undefined && list.length > 0;
    }

    clear() {
        this.handlers.clear();
        this.errors = [];
    }
}
