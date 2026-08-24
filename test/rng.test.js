import test from 'node:test';
import assert from 'node:assert/strict';
import {Random} from '../src/core/rng.js';

test('same seed produces the same stream', () => {
    const a = new Random(42);
    const b = new Random(42);
    for (let i = 0; i < 1000; i++) assert.equal(a.next(), b.next());
});

test('different seeds diverge', () => {
    const a = new Random(1);
    const b = new Random(2);
    const xs = Array.from({length: 100}, () => a.next());
    const ys = Array.from({length: 100}, () => b.next());
    assert.notDeepEqual(xs, ys);
});

test('string seeds are accepted and stable', () => {
    const a = new Random('control');
    const b = new Random('control');
    const c = new Random('treatment');
    assert.equal(a.next(), b.next());
    assert.notEqual(a.next(), c.next());
});

test('next() stays in [0, 1)', () => {
    const rng = new Random(7);
    for (let i = 0; i < 10000; i++) {
        const x = rng.next();
        assert.ok(x >= 0 && x < 1, `out of range: ${x}`);
    }
});

test('int(n) covers [0, n) and never exceeds it', () => {
    const rng = new Random(9);
    const seen = new Set();
    for (let i = 0; i < 5000; i++) {
        const v = rng.int(6);
        assert.ok(Number.isInteger(v) && v >= 0 && v < 6);
        seen.add(v);
    }
    assert.equal(seen.size, 6);
});

test('normal() has approximately the requested mean and sd', () => {
    const rng = new Random(11);
    const xs = Array.from({length: 50000}, () => rng.normal(5, 2));
    const mean = xs.reduce((a, b) => a + b, 0) / xs.length;
    const sd = Math.sqrt(xs.reduce((a, b) => a + (b - mean) ** 2, 0) / xs.length);
    assert.ok(Math.abs(mean - 5) < 0.05, `mean was ${mean}`);
    assert.ok(Math.abs(sd - 2) < 0.05, `sd was ${sd}`);
});

test('rightSkew() is positive and right-skewed', () => {
    const rng = new Random(13);
    const xs = Array.from({length: 20000}, () => rng.rightSkew(1));
    assert.ok(xs.every(x => x >= 0));
    const mean = xs.reduce((a, b) => a + b, 0) / xs.length;
    const median = [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)];
    assert.ok(mean > median, 'mean should exceed median for a right-skewed sample');
});

test('shuffle() permutes without mutating the input', () => {
    const rng = new Random(17);
    const original = [1, 2, 3, 4, 5, 6, 7, 8];
    const copy = [...original];
    const shuffled = rng.shuffle(original);
    assert.deepEqual(original, copy, 'input must not be mutated');
    assert.deepEqual([...shuffled].sort((a, b) => a - b), copy);
});

test('fork() is deterministic in the label and independent of draw history', () => {
    const parent = new Random(100);
    const first = parent.fork('forest');

    const other = new Random(100);
    for (let i = 0; i < 500; i++) other.next();   // advance the parent stream
    const second = other.fork('forest');

    // A substream must not depend on how much the parent has drawn.
    assert.equal(first.next(), second.next());

    // Different labels must give different streams.
    const agents = new Random(100).fork('agents');
    assert.notEqual(new Random(100).fork('forest').next(), agents.next());
});

test('getState/setState round-trips the stream position', () => {
    const rng = new Random(23);
    for (let i = 0; i < 50; i++) rng.next();
    const state = rng.getState();
    const expected = Array.from({length: 10}, () => rng.next());

    rng.setState(state);
    const replayed = Array.from({length: 10}, () => rng.next());
    assert.deepEqual(replayed, expected);
});

test('drawCount tracks every draw', () => {
    const rng = new Random(29);
    rng.next();
    rng.normal();          // two draws
    rng.int(10);
    assert.equal(rng.drawCount, 4);
});
