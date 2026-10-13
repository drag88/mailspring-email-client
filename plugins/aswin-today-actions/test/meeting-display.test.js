'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { normalizeDisplay, readDisplay, saveDisplay, DISPLAY_KEY, meetingLocation } = require('../lib/meeting-display');

test('hybrid locations keep physical rooms while online-only locations do not repeat join URLs', () => {
  const description = 'Join https://meet.google.com/abc-defg-hij';
  assert.equal(meetingLocation({ location: 'Ubi Room 3', description }), 'Ubi Room 3');
  assert.equal(meetingLocation({ location: 'https://meet.google.com/abc-defg-hij\nUbi Room 3', description }), 'Ubi Room 3');
  assert.equal(meetingLocation({ location: 'meet.google.com/abc-defg-hij' }), '');
  assert.equal(meetingLocation({ location: 'Google Meet', description }), '');
  assert.equal(meetingLocation({ location: '<b>Ubi &amp; Ayer Rajah</b>' }), 'Ubi & Ayer Rajah');
  assert.equal(meetingLocation({ location: 'https://maps.example.test/office' }), 'https://maps.example.test/office');
});

test('display settings recover invalid data, bound heights and persist separately from actions', () => {
  assert.deepEqual(normalizeDisplay(null), { compact: true, height: 320 });
  assert.deepEqual(normalizeDisplay({ height: 'bad' }), { compact: true, height: 320 });
  assert.deepEqual(normalizeDisplay({ height: 8000, compact: false }), { compact: false, height: 720 });
  assert.equal(normalizeDisplay({ height: 5 }).height, 180);
  assert.equal(normalizeDisplay({ height: 333 }).height, 333);
  const values = new Map(), config = { get: key => values.get(key), set: (key, value) => values.set(key, value) };
  saveDisplay(config, { compact: false, height: 480 });
  assert.deepEqual(readDisplay(config), { compact: false, height: 480 });
  assert.deepEqual([...values.keys()], [DISPLAY_KEY]);
  assert.deepEqual(readDisplay({ get() { throw new Error('Config unavailable'); } }), { compact: true, height: 320 });
});
