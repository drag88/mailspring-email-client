'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { monthGrid, meetingLink, descriptionText, dayBounds } = require('../lib/core');
const { CalendarFeed } = require('../lib/calendar-feed');

test('month grid covers leap days, Monday alignment and year boundaries', () => {
  const feb = monthGrid(2028, 1, '2028-02-29', '2028-02-03');
  assert.equal(feb.length, 35);
  assert.equal(feb[0].key, '2028-01-31');
  assert.equal(feb.at(-1).key, '2028-03-05');
  assert.equal(feb.filter(d => d.inMonth).length, 29);
  assert.equal(feb.find(d => d.isSelected).day, 29);
  assert.equal(feb.find(d => d.isToday).key, '2028-02-03');
  const dec = monthGrid(2026, 11, '2026-12-31');
  assert.equal(dec[0].key, '2026-11-30');
  assert.equal(dec.at(-1).key, '2027-01-03');
});

test('calendar selection changes query bounds and invalid dates preserve selection', () => {
  const bounds = [];
  const range = { lte: value => value, gte: value => value };
  const api = { Event: { attributes: { recurrenceStart: range, recurrenceEnd: range } },
    Matcher: { And: class { constructor(values) { this.values = values; } }, Or: class { constructor(values) { this.values = values; } } },
    DatabaseStore: { findAll: () => ({ where(matcher) { bounds.push(matcher.values[0].values); return this; } }) },
    Rx: { Observable: { fromQuery: () => ({ subscribe: () => ({ dispose() {} }) }) } },
  };
  const feed = new CalendarFeed(api, {}, () => {}, () => []);
  feed.setDate('2027-01-02');
  const selectedBounds = dayBounds(new Date('2027-01-02T12:00:00'));
  assert.deepEqual(bounds[0], [selectedBounds.endUnix, selectedBounds.startUnix]);
  assert.throws(() => feed.setDate('2027-02-30'));
  assert.equal(feed.selectedDateKey, '2027-01-02');
  feed.setDate(null);
  assert.equal(feed.selectedDateKey, null);
  const todayBounds = dayBounds();
  assert.deepEqual(bounds[1], [todayBounds.endUnix, todayBounds.startUnix]);
  feed.stop();
});

test('meeting links resolve Google-wrapped and bare links while rejecting unsafe destinations', () => {
  assert.equal(meetingLink({ description: 'https://www.google.com/url?q=https%3A%2F%2Fmeet.google.com%2Fabc-defg-hij&amp;sa=D' }), 'https://meet.google.com/abc-defg-hij');
  assert.equal(meetingLink({ location: 'meet.google.com/abc-defg-hij' }), 'https://meet.google.com/abc-defg-hij');
  assert.equal(meetingLink({ location: 'HTTPS://teams.microsoft.com/meet/123' }), 'https://teams.microsoft.com/meet/123');
  for (const destination of ['javascript:alert(1)', 'https://evil.test/path', 'http://meet.google.com/abc', 'https://user:pass@zoom.us/j/1']) {
    assert.equal(meetingLink({ location: `https://www.google.com/url?q=${encodeURIComponent(destination)}` }), null);
  }
});

test('description text strips markup and scripts without interpreting content', () => {
  assert.equal(descriptionText('<p>Hello &amp; welcome</p><script>alert(1)</script><p>Join<br>soon</p>'), 'Hello & welcome\nJoin\nsoon');
  assert.equal(descriptionText('plain <img src="https://remote.test/pixel"> text'), 'plain  text');
});
