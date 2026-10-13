'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { CalendarFeed } = require('../lib/calendar-feed');
const { dayBounds } = require('../lib/core');

function fixture(expand) {
  const subscriptions = [];
  const api = {
    Rx: { Observable: { fromQuery: query => ({ subscribe(next, error) {
      const sub = { query, next, error, disposed: false, dispose() { this.disposed = true; } };
      subscriptions.push(sub); return sub;
    } }) } },
    Calendar: 'Calendar', Event: { attributes: {
      recurrenceStart: { lte: value => ({ startLTE: value }), gte: value => ({ startGTE: value }) },
      recurrenceEnd: { lte: value => ({ endLTE: value }), gte: value => ({ endGTE: value }) },
    } },
    Matcher: { And: class { constructor(values) { this.and = values; } }, Or: class { constructor(values) { this.or = values; } } },
    DatabaseStore: { findAll(type) { return { type, where(matcher) { this.matcher = matcher; return this; } }; } },
    Contact: class { constructor({ email }) { this.email = email; } isMe() { return this.email === 'me@example.test'; } },
  };
  const config = { disabled: [], get() { return this.disabled; }, onDidChange(key, callback) {
    this.callback = callback; return { dispose() { config.disposed = true; } };
  } };
  let changes = 0;
  const feed = new CalendarFeed(api, { config }, () => changes++, expand);
  return { feed, api, config, subscriptions, changes: () => changes };
}

test('native expansion is isolated per account/calendar, hidden and declined meetings excluded', t => {
  const calls = [];
  const { startUnix } = dayBounds();
  const f = fixture(events => { calls.push(events); return events.map(e => ({ ...e, title: 'Sample',
    isAllDay: false, start: startUnix + 3600, end: startUnix + 7200 })); });
  t.after(() => f.feed.stop());
  f.feed.start();
  f.subscriptions[0].next([{ id: 'visible' }, { id: 'hidden' }]);
  f.config.disabled = ['hidden'];
  f.subscriptions[1].next([
    { id: 'one', accountId: 'a1', calendarId: 'visible', icsuid: 'same' },
    { id: 'two', accountId: 'a2', calendarId: 'visible', icsuid: 'same' },
    { id: 'three', accountId: 'a1', calendarId: 'hidden', icsuid: 'same' },
    { id: 'declined', accountId: 'a1', calendarId: 'visible', attendees: [{ email: 'me@example.test', partstat: 'DECLINED' }] },
  ]);
  assert.equal(calls.length, 2);
  assert.deepEqual(f.feed.events.map(e => e.id), ['one', 'two']);
  f.config.disabled = ['hidden', 'visible']; f.config.callback();
  assert.equal(f.feed.events.length, 0);
});

test('refresh rejects late emissions from disposed queries and stops timers/listeners', () => {
  const f = fixture(events => events);
  f.feed.start();
  const old = f.subscriptions[1];
  f.feed.refresh();
  assert.equal(old.disposed, true);
  old.next([{ id: 'stale' }]);
  assert.equal(f.feed.events.length, 0);
  assert.equal(f.feed.loading, true);
  f.subscriptions[2].error(new Error('DB failure'));
  assert.ok(f.feed.error);
  assert.equal(f.feed.loading, false);
  const count = f.changes();
  f.feed.stop();
  f.subscriptions[2].next([]);
  assert.equal(f.changes(), count);
  assert.equal(f.config.disposed, true);
});
