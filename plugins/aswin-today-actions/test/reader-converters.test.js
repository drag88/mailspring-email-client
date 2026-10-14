'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { createReaderConverters } = require('../lib/reader-converters');
const React = { Component: class { constructor() { this.state = {}; } setState(state) { Object.assign(this.state, state); } }, createElement() {} };
function deferred() { let resolve; const promise = new Promise(r => { resolve = r; }); return { promise, resolve }; }
function response(rate = 0.78) { return { ok: true, json: async () => ({ base: 'SGD', quote: 'USD', rate, date: '2026-10-14' }) }; }

test('edited inputs cancel rate request and cannot display a late result', async () => {
  const oldFetch = globalThis.fetch;
  const pending = deferred(); let signal;
  globalThis.fetch = (_, options) => { signal = options.signal; return pending.promise; };
  const panel = new (createReaderConverters(React))({});
  try {
    const run = panel.convert();
    assert.equal(panel.state.loading, true);
    panel.changeCurrency({ quote: 'EUR' });
    assert.equal(signal.aborted, true);
    pending.resolve(response()); await run;
    assert.equal(panel.state.result, null);
    assert.equal(panel.state.loading, false);
    assert.equal(panel.state.error, '');
  } finally { panel.componentWillUnmount(); globalThis.fetch = oldFetch; }
});

test('newer request wins; unmount cancels work without changing state', async () => {
  const oldFetch = globalThis.fetch;
  const pending = deferred(); let firstSignal;
  let calls = 0;
  globalThis.fetch = (_, options) => { calls++; if (calls === 1) { firstSignal = options.signal; return pending.promise; } return Promise.resolve(response(0.8)); };
  const panel = new (createReaderConverters(React))({});
  try {
    const first = panel.convert(); const second = panel.convert();
    await second;
    assert.equal(firstSignal.aborted, true);
    assert.equal(panel.state.result.text, '80.00 USD');
    pending.resolve(response()); await first;
    assert.equal(panel.state.result.text, '80.00 USD');
    const pendingUnmount = deferred(); let unmountSignal;
    globalThis.fetch = (_, options) => { unmountSignal = options.signal; return pendingUnmount.promise; };
    const last = panel.convert(); panel.componentWillUnmount();
    const before = JSON.stringify(panel.state);
    pendingUnmount.resolve(response()); await last;
    assert.equal(unmountSignal.aborted, true);
    assert.equal(JSON.stringify(panel.state), before);
  } finally { panel.componentWillUnmount(); globalThis.fetch = oldFetch; }
});

test('invalid amount never requests a rate and request failures show a recoverable error', async () => {
  const oldFetch = globalThis.fetch; let calls = 0;
  globalThis.fetch = async () => { calls++; throw Error('Offline'); };
  const panel = new (createReaderConverters(React))({});
  try {
    panel.changeCurrency({ amount: '' }); await panel.convert();
    assert.equal(calls, 0); assert.match(panel.state.error, /amount/);
    panel.changeCurrency({ amount: '100' }); await panel.convert();
    assert.equal(calls, 1); assert.equal(panel.state.error, 'Offline'); assert.equal(panel.state.loading, false);
  } finally { panel.componentWillUnmount(); globalThis.fetch = oldFetch; }
});
