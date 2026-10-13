'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { actionSources, groupForThread, groupGeometry, rowTop, headerTop, indexAtY, dayStarts } = require('../lib/mail-groups');
process.env.TZ = 'Asia/Singapore';
const now = new Date('2026-10-07T14:53:25+08:00');
const thread = (id, instant, extra = {}) => ({ id, accountId: 'work', lastMessageReceivedTimestamp: new Date(instant), ...extra });
test('mail groups use local midnight and yesterday rather than elapsed 24 hours', () => {
  assert.equal(groupForThread(thread('a', '2026-10-06T16:00:00Z'), [], now), 2);
  assert.equal(groupForThread(thread('a', '2026-10-06T15:59:59Z'), [], now), 3);
  assert.equal(groupForThread(thread('a', '2026-10-05T15:59:59Z'), [], now), 4);
  assert.equal(groupForThread(thread('a', '2026-10-05T16:00:00Z'), [], now), 3);
});
test('open linked actions outrank stars; completed/unlinked actions do not pin mail; account must match', () => {
  const sources = actionSources([{ source: { threadId: 'a', accountId: 'work' } },
    { source: { threadId: 'a', accountId: 'work' } }, { completedAt: 'done', source: { threadId: 'b', accountId: 'work' } }, {}]);
  assert.equal(sources.length, 1);
  assert.equal(groupForThread(thread('a', '2020-01-01', { starred: true }), sources, now), 0);
  assert.equal(groupForThread(thread('a', '2020-01-01', { accountId: 'personal', starred: true }), sources, now), 1);
  assert.equal(groupForThread(thread('b', '2020-01-01'), sources, now), 4);
});
test('group headings occupy layout space without adding selectable fake threads, and scrolling maps back to native indexes', () => {
  const groups = groupGeometry([2, 0, 10, 4, 10000]);
  assert.equal(groups.length, 4);
  assert.deepEqual(groups.map(g => g.start), [0, 2, 12, 16]);
  for (const height of [36, 85]) {
    for (const i of [0, 1, 2, 11, 12, 15, 16, 1015])
      assert.equal(indexAtY(rowTop(i, height, groups) + height / 2, height, groups), i);
    for (const g of groups) assert.equal(indexAtY(headerTop(g, height, groups) + 1, height, groups), g.start);
  }
});
test('yesterday uses the local calendar day across daylight saving changes', () => {
  const old = process.env.TZ; process.env.TZ = 'America/New_York';
  try {
    const { today, yesterday } = dayStarts(new Date('2026-11-02T12:00:00-05:00'));
    assert.equal((today - yesterday) / 3600000, 25);
  } finally { process.env.TZ = old; }
});
