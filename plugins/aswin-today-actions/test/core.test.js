'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const core = require('../lib/core');

test('due view includes overdue, today and undated actions; preserves future/done filters', () => {
  const make = (id, dueDate, completedAt = null) => ({ id, dueDate, completedAt, createdAt: '2026-10-01T00:00:00Z' });
  const actions = [make('later', '2026-10-08'), make('today', '2026-10-06'), make('late', '2026-10-05'),
    make('undated', ''), make('finished', '2026-10-05', '2026-10-06T00:00:00Z')];
  assert.deepEqual(core.groupActions(actions, 'due', '2026-10-06').map(([name, list]) => [name, list.map(a => a.id)]),
    [['Overdue', ['late']], ['Today', ['today']], ['No due date', ['undated']]]);
  assert.equal(core.groupActions(actions, 'all', '2026-10-06').at(-1)[0], 'Upcoming');
  assert.equal(core.groupActions(actions, 'done', '2026-10-06')[0][1][0].id, 'finished');
});

test('dates validate real calendar days and actions reject invalid input', () => {
  assert.equal(core.validDate('2026-02-29'), false);
  assert.equal(core.validDate('2028-02-29'), true);
  assert.equal(core.validDate('2026-13-01'), false);
  assert.throws(() => core.normalizeAction({ title: '  ' }));
  assert.throws(() => core.normalizeAction({ title: 'Test', dueDate: 'tomorrow' }));
  assert.throws(() => core.normalizeAction({ title: 'x'.repeat(301) }));
  assert.deepEqual(core.normalizeAction({ title: '  Follow up ', owner: '', dueDate: '', notes: ' hi ' }),
    { title: 'Follow up', owner: 'Me', dueDate: '', notes: 'hi', source: null, remindAt: null });
});

test('captured source survives editing and can be explicitly unlinked', () => {
  const source = { threadId: 't1', accountId: 'a1', subject: 'Original' };
  assert.deepEqual(core.normalizeAction({ title: 'Changed' }, { source }).source, source);
  assert.equal(core.normalizeAction({ title: 'Changed', source: null }, { source }).source, null);
  assert.equal(core.normalizeAction({ title: 'Changed', source: { threadId: 't1' } }).source, null);
});

test('meeting links accept recognised HTTPS providers, reject spoofed hosts and credentials', () => {
  assert.equal(core.meetingLink({ description: '<a href="https://teams.microsoft.com/l/meetup-join/abc?x=1&amp;y=2">Join</a>' }),
    'https://teams.microsoft.com/l/meetup-join/abc?x=1&y=2');
  assert.equal(core.meetingLink({ location: 'Join https://meet.google.com/abc-defg-hij.' }), 'https://meet.google.com/abc-defg-hij');
  for (const url of ['http://meet.google.com/abc', 'https://meet.google.com.evil.test/abc',
    'https://evilzoom.us/123', 'https://user:pass@zoom.us/123', 'javascript:alert(1)',
    'https://zoom.us:8443/test', 'file:///secret']) assert.equal(core.meetingLink({ description: url }), null);
  assert.equal(core.meetingLink({ location: 'https://starhub.zoom.us/j/123' }), 'https://starhub.zoom.us/j/123');
});

test('today excludes cancelled/declined and midnight boundaries, keeps past and all-day', () => {
  const now = new Date(2026, 9, 6, 13, 0);
  const { startUnix, endUnix } = core.dayBounds(now);
  const day = Date.UTC(2026, 9, 6) / 86400000;
  const base = { accountId: 'a1', calendarId: 'c1', title: 'Meeting', isAllDay: false };
  const events = [
    { ...base, id: 'past', start: startUnix + 3600, end: startUnix + 7200 },
    { ...base, id: 'next-day', start: endUnix, end: endUnix + 3600 },
    { ...base, id: 'ends-at-start', start: startUnix - 3600, end: startUnix },
    { ...base, id: 'zero', start: startUnix, end: startUnix },
    { ...base, id: 'cancel', start: startUnix + 3600, end: startUnix + 7200, isCancelled: true },
    { ...base, id: 'declined', start: startUnix + 3600, end: startUnix + 7200, declinedByMe: true },
    { ...base, id: 'all-day', isAllDay: true, startDate: day, endDate: day },
  ];
  assert.deepEqual(core.visibleEvents(events, now).map(e => e.id), ['all-day', 'zero', 'past']);
});

test('local day follows Singapore timezone and daylight-saving day boundaries', () => {
  const code = `const c=require(${JSON.stringify(require.resolve('../lib/core'))});
    const d=new Date(process.argv[1]);console.log(JSON.stringify({day:c.localDateKey(d),span:c.dayBounds(d).endUnix-c.dayBounds(d).startUnix}));`;
  const result = (tz, instant) => JSON.parse(execFileSync(process.execPath, ['-e', code, instant],
    { env: { ...process.env, TZ: tz }, encoding: 'utf8' }));
  assert.deepEqual(result('Asia/Singapore', '2026-10-05T17:00:00Z'), { day: '2026-10-06', span: 86400 });
  assert.deepEqual(result('America/New_York', '2026-03-08T16:00:00Z'), { day: '2026-03-08', span: 82800 });
});
