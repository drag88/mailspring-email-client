'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { amountValue, currencyResult, fetchRate, zonedInstants, timezoneResult } = require('../lib/converters');

test('currency validates amounts, handles zero and rounds using currency minor units', () => {
  assert.equal(amountValue('0'), 0);
  assert.equal(amountValue('1,000.50'), 1000.50);
  assert.equal(amountValue('-20.5'), -20.5);
  assert.equal(currencyResult('100', { base: 'SGD', quote: 'USD', rate: 0.78 }), '78.00 USD');
  assert.equal(currencyResult('1', { base: 'USD', quote: 'JPY', rate: 150.25 }), '150 JPY');
  for (const value of ['', ' ', '1,00', 'Infinity', '1e999', '1000000000001', 'oops']) assert.throws(() => amountValue(value));
});

test('rate request sends only currency codes and validates pair, date and positive rate', async () => {
  let request;
  const mockFetch = async (url, options) => { request = { url, options }; return { ok: true,
    json: async () => ({ base: 'SGD', quote: 'USD', rate: 0.78, date: '2026-10-13' }) }; };
  assert.equal((await fetchRate('SGD', 'USD', null, mockFetch)).rate, 0.78);
  assert.equal(request.url, 'https://api.frankfurter.dev/v2/rate/SGD/USD');
  assert.equal(request.options.credentials, 'omit');
  for (const bad of [{ base: 'USD' }, { rate: 0 }, { rate: '0.78' }, { date: '2026-02-30' }]) {
    await assert.rejects(fetchRate('SGD', 'USD', null, async () => ({ ok: true,
      json: async () => ({ base: 'SGD', quote: 'USD', rate: 0.78, date: '2026-10-13', ...bad }) })));
  }
  await assert.rejects(fetchRate('SGD', 'USD', null, async () => ({ ok: false })));
});

test('same currency needs no network', async () => {
  const rate = await fetchRate('SGD', 'SGD', null, () => { throw Error('network used'); });
  assert.equal(rate.rate, 1);
  assert.equal(currencyResult('100', rate), '100.00 SGD');
});

test('timezone conversion uses the selected source date and handles date rollover', () => {
  assert.deepEqual(zonedInstants('2026-10-14T09:00', 'Asia/Singapore'), [Date.parse('2026-10-14T01:00Z')]);
  const result = timezoneResult('2026-10-14T09:00', 'Asia/Singapore', 'America/Los_Angeles');
  assert.equal(result.local, '2026-10-13T18:00');
  assert.equal(result.offset, 'UTC−07:00');
  assert.equal(timezoneResult('2026-01-14T09:00', 'Asia/Singapore', 'Europe/London').local, '2026-01-14T01:00');
  assert.equal(timezoneResult('2026-07-14T09:00', 'Asia/Singapore', 'Europe/London').local, '2026-07-14T02:00');
});

test('timezone rejects invalid dates and DST gaps; repeated hours require an explicit choice', () => {
  for (const value of ['', '2026-02-30T09:00', '2026-01-01T24:00']) assert.throws(() => zonedInstants(value, 'Asia/Singapore'));
  assert.deepEqual(zonedInstants('2026-03-08T02:30', 'America/New_York'), []);
  assert.throws(() => timezoneResult('2026-03-08T02:30', 'America/New_York', 'Asia/Singapore'), /does not exist/);
  assert.deepEqual(zonedInstants('2026-11-01T01:30', 'America/New_York'), [Date.parse('2026-11-01T05:30Z'), Date.parse('2026-11-01T06:30Z')]);
  assert.throws(() => timezoneResult('2026-11-01T01:30', 'America/New_York', 'Asia/Singapore'), /occurs twice/);
  assert.equal(timezoneResult('2026-11-01T01:30', 'America/New_York', 'Asia/Singapore', 'later').local, '2026-11-01T14:30');
  assert.equal(zonedInstants('2026-10-04T02:15', 'Australia/Lord_Howe').length, 0);
  assert.equal(zonedInstants('2026-04-05T01:45', 'Australia/Lord_Howe').length, 2);
});
