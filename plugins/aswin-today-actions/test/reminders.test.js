'use strict';
process.env.TZ = 'Asia/Singapore';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const vm = require('vm');
const { execFileSync } = require('child_process');
const { ActionStore } = require('../lib/action-store');
const { groupActions } = require('../lib/core');
const { reminderISO, localReminderValue, suggestedReminder, snoozeInstant, ReminderScheduler } = require('../lib/reminders');
const now = Date.parse('2026-10-07T03:00:00.000Z');
const due = '2026-10-07T03:00:00.000Z';

test('browser timers keep their global receiver instead of being invoked on the scheduler', () => {
  vm.runInNewContext(fs.readFileSync(require.resolve('../lib/reminders'), 'utf8') + `
    let cleared = false;
    globalThis.setInterval = function(callback, ms) {
      if (this !== globalThis) throw new TypeError('Illegal invocation');
      if (ms !== 30000) throw new Error('Incorrect interval');
      return 42;
    };
    globalThis.clearInterval = function(timer) {
      if (this !== globalThis) throw new TypeError('Illegal invocation');
      if (timer !== 42) throw new Error('Incorrect timer');
      cleared = true;
    };
    const scheduler = new module.exports.ReminderScheduler({ actions: [], on() {}, removeListener() {} }, {});
    scheduler.start(); scheduler.stop();
    if (!cleared) throw new Error('Timer was not cleared');
  `, { module: { exports: {} } });
});

function fixture(t, display) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'taa-reminders-'));
  const file = path.join(root, 'actions.json');
  const store = new ActionStore(file);
  const notices = [], opened = [];
  let time = now, closed = 0;
  const scheduler = new ReminderScheduler(store, { displayNotification: async options => {
    notices.push(options);
    return display ? display(options) : { close() { closed++; } };
  } }, { clock: () => time, onOpen: a => opened.push(a), setTimer: () => ({ unref() {} }), clearTimer() {} });
  scheduler.active = true;
  t.after(() => { scheduler.stop(); fs.rmSync(root, { recursive: true, force: true }); });
  return { store, file, scheduler, notices, opened, setTime: value => { time = value; }, get closed() { return closed; } };
}

test('reminder time conversion validates dates, uses local timezone and rejects nonexistent DST time', () => {
  assert.equal(reminderISO('2026-10-12T09:00'), '2026-10-12T01:00:00.000Z');
  assert.equal(localReminderValue('2026-10-12T01:00:00.000Z'), '2026-10-12T09:00');
  for (const value of ['', '2026-02-30T09:00', '2026-10-12T25:00', '2026-10-12', 'tomorrow'])
    assert.throws(() => reminderISO(value));
  assert.equal(suggestedReminder('2026-10-12', now), '2026-10-12T09:00');
  assert.equal(suggestedReminder('2026-10-06', now), '2026-10-07T11:15');
  const code = `const r=require(${JSON.stringify(require.resolve('../lib/reminders'))});
    try{r.reminderISO('2026-03-08T02:30');process.exit(1)}catch(_){}
    console.log(r.snoozeInstant('tomorrow',Date.parse('2026-03-07T15:00:00Z')));`;
  assert.equal(execFileSync(process.execPath, ['-e', code], { env: { ...process.env, TZ: 'America/New_York' }, encoding: 'utf8' }).trim(),
    '2026-03-08T13:00:00.000Z');
});

test('old action files load without changing existing data or enabling reminders', t => {
  const { file } = fixture(t);
  const payload = JSON.stringify({ version: 1, actions: [{ id: 'old', title: 'Existing', dueDate: '2026-10-12', createdAt: due }] });
  fs.writeFileSync(file, payload);
  const store = new ActionStore(file);
  assert.equal(store.error, null);
  assert.equal(store.actions[0].remindAt, null);
  assert.equal(store.actions[0].reminderNotifiedFor, null);
  assert.equal(fs.readFileSync(file, 'utf8'), payload);
});

test('reminder persistence survives restart, edits preserve delivery state, rescheduling rearms and completion cancels', t => {
  const { store, file } = fixture(t);
  const a = store.save({ title: 'Follow up', dueDate: '2026-10-12', remindAt: due });
  store.markReminderNotified(a.id, due);
  const restarted = new ActionStore(file);
  restarted.save({ ...restarted.actions[0], title: 'Updated title' }, a.id);
  assert.equal(restarted.actions[0].reminderNotifiedFor, due);
  restarted.snooze(a.id, snoozeInstant(15, now));
  assert.equal(restarted.actions[0].dueDate, '2026-10-12');
  assert.equal(restarted.actions[0].reminderNotifiedFor, null);
  restarted.markReminderNotified(a.id, due); // A stale notification must not mark the new schedule.
  assert.equal(restarted.actions[0].reminderNotifiedFor, null);
  restarted.complete(a.id, true);
  restarted.complete(a.id, false);
  assert.equal(restarted.actions[0].remindAt, null);
  assert.throws(() => restarted.snooze('missing', due));
});

test('due reminder is visible in Due even when the action deadline is in the future', t => {
  const { store } = fixture(t);
  const a = store.save({ title: 'Reminder first', dueDate: '2026-10-12', remindAt: due });
  assert.equal(groupActions(store.actions, 'due', '2026-10-07', now)[0][0], 'Reminders');
  store.snooze(a.id, snoozeInstant(60, now));
  assert.equal(groupActions(store.actions, 'due', '2026-10-07', now).length, 0);
});

test('scheduler issues once per saved schedule and persists deduplication across restart', async t => {
  const f = fixture(t);
  f.store.save({ title: 'Catch up', remindAt: due, notes: 'Private notes', source: { threadId: 't', accountId: 'a', subject: 'Private subject' } });
  await Promise.all([f.scheduler.tick(), f.scheduler.tick()]);
  assert.equal(f.notices.length, 1);
  assert.equal(f.notices[0].body, 'Catch up');
  assert.equal(f.notices[0].threadId, undefined);
  assert(!JSON.stringify(f.notices[0]).includes('Private'));
  assert.equal(f.store.actions[0].reminderNotifiedFor, due);
  f.scheduler.store = new ActionStore(f.file);
  await f.scheduler.tick();
  assert.equal(f.notices.length, 1);
});

test('future, completed and disabled reminders do not notify; elapsed reminders catch up after reopen', async t => {
  const f = fixture(t);
  f.store.save({ title: 'Future', remindAt: snoozeInstant(60, now) });
  f.store.save({ title: 'Disabled' });
  const done = f.store.save({ title: 'Done', remindAt: due });
  f.store.complete(done.id, true);
  await f.scheduler.tick();
  assert.equal(f.notices.length, 0);
  f.setTime(now + 2 * 3600000);
  await f.scheduler.tick();
  assert.equal(f.notices.length, 1);
  assert.equal(f.notices[0].body, 'Future');
});

test('notification click opens the action, Snooze rearms it and stale buttons cannot alter new schedules', async t => {
  const f = fixture(t);
  const a = f.store.save({ title: 'Follow up', dueDate: '2026-10-12', remindAt: due });
  await f.scheduler.tick();
  const activate = f.notices[0].onActivate;
  activate({ activationType: 'clicked' });
  assert.equal(f.opened[0].id, a.id);
  activate({ activationType: 'action', actionIndex: 0 });
  assert.equal(f.store.actions[0].remindAt, snoozeInstant(15, now));
  assert.equal(f.store.actions[0].dueDate, '2026-10-12');
  activate({ activationType: 'action', actionIndex: 0 });
  assert.equal(f.store.actions[0].remindAt, snoozeInstant(15, now));
  f.setTime(now + 16 * 60000);
  await f.scheduler.tick();
  assert.equal(f.notices.length, 2);
  f.store.dismissReminder(a.id);
  await f.scheduler.tick();
  assert.equal(f.notices.length, 2);
  assert.equal(f.store.actions[0].title, 'Follow up');
});

test('suppressed or failed notification remains eligible for retry and visible in Actions', async t => {
  let available = false;
  const f = fixture(t, () => available ? { close() {} } : null);
  f.store.save({ title: 'Retry', remindAt: due });
  await f.scheduler.tick();
  assert(f.scheduler.error);
  assert.equal(f.store.actions[0].reminderNotifiedFor, null);
  available = true;
  await f.scheduler.tick();
  assert.equal(f.notices.length, 2);
  assert.equal(f.scheduler.error, '');
  assert.equal(f.store.actions[0].reminderNotifiedFor, due);
});

test('completion while notification is in flight closes it without stale persistence', async t => {
  let resolve, closed = 0;
  const f = fixture(t, () => new Promise(r => { resolve = r; }));
  const a = f.store.save({ title: 'Cancel during send', remindAt: due });
  const pending = f.scheduler.tick();
  f.store.complete(a.id, true);
  resolve({ close() { closed++; } });
  await pending;
  assert.equal(closed, 1);
  assert.equal(f.store.actions[0].reminderNotifiedFor, null);
});

test('timer/listeners are cleaned up and rescheduling/completing closes obsolete banners', async t => {
  const f = fixture(t);
  let cleared = 0, interval;
  f.scheduler.active = false;
  f.scheduler.setTimer = (_, ms) => { interval = ms; return 123; };
  f.scheduler.clearTimer = timer => { assert.equal(timer, 123); cleared++; };
  f.scheduler.start();
  const a = f.store.save({ title: 'Timer cleanup', remindAt: due });
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(interval, 30000);
  assert.equal(f.notices.length, 1);
  f.store.complete(a.id, true);
  assert.equal(f.closed, 1);
  f.scheduler.stop();
  assert.equal(cleared, 1);
  assert.equal(f.store.listenerCount('change'), 0);
  // Make the fixture's final stop harmless for its timer assertion.
  f.scheduler.clearTimer = () => {};
});

test('invalid schedule cannot write and failed delivery-state write avoids repeated banners in the same session', async t => {
  const f = fixture(t);
  const a = f.store.save({ title: 'Keep', remindAt: due });
  const bytes = fs.readFileSync(f.file, 'utf8');
  assert.throws(() => f.store.save({ ...a, remindAt: '2026-02-30T03:00:00.000Z' }, a.id));
  assert.equal(fs.readFileSync(f.file, 'utf8'), bytes);
  f.store.markReminderNotified = () => { throw new Error('Disk full'); };
  await f.scheduler.tick();
  await f.scheduler.tick();
  assert.equal(f.notices.length, 1);
  assert(f.scheduler.error);
  assert.equal(f.store.actions[0].reminderNotifiedFor, null);
});
