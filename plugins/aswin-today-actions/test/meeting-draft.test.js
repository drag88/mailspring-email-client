'use strict';
process.env.TZ = 'Asia/Singapore';
const test = require('node:test');
const assert = require('node:assert/strict');
const { googleMeetingDraft, googleAccountEmail } = require('../lib/meeting-draft');

test('Google draft preserves the selected Singapore day and is not a save or invitation request', () => {
  const chooser = new URL(googleMeetingDraft({ date: new Date('2026-10-07T12:00:00+08:00'),
    now: new Date('2026-10-06T14:41:00+08:00'), email: 'work@example.com', timezone: 'Asia/Singapore' }));
  assert.equal(chooser.origin, 'https://accounts.google.com');
  assert.equal(chooser.pathname, '/AccountChooser');
  assert.equal(chooser.searchParams.get('Email'), 'work@example.com');
  const url = new URL(chooser.searchParams.get('continue'));
  assert.equal(url.origin, 'https://calendar.google.com');
  assert.equal(url.searchParams.get('action'), 'TEMPLATE');
  assert.equal(url.searchParams.get('dates'), '20261007T010000Z/20261007T013000Z');
  assert.equal(url.searchParams.get('authuser'), 'work@example.com');
  assert.equal(url.searchParams.get('ctz'), 'Asia/Singapore');
  assert(!url.searchParams.has('text'));
  assert(!url.searchParams.has('add'));
  assert(!url.searchParams.has('details'));
});

test('today draft rounds forward and handles midnight rollover', () => {
  const now = new Date('2026-10-06T23:45:00+08:00');
  const url = new URL(new URL(googleMeetingDraft({ date: now, now })).searchParams.get('continue'));
  assert.equal(url.searchParams.get('dates'), '20261006T160000Z/20261006T163000Z');
  assert.throws(() => googleMeetingDraft({ date: 'invalid' }));
});

test('Google account selection avoids silently using a different account', () => {
  const accounts = [{ id: 'a', provider: 'gmail', emailAddress: 'a@example.com' },
    { id: 'b', provider: 'gmail', emailAddress: 'b@example.com' },
    { id: 'm', provider: 'office365', emailAddress: 'm@example.com' }];
  assert.equal(googleAccountEmail(accounts, 'b'), 'b@example.com');
  assert.equal(googleAccountEmail(accounts, 'm'), '');
  assert.equal(googleAccountEmail(accounts.slice(0, 1)), 'a@example.com');
  assert.equal(googleAccountEmail([]), '');
});
