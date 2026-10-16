'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { inboxUnread, agendaTemplate, installMacMenu } = require('../lib/mac-menu');
const { dayBounds } = require('../lib/core');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function mailFixture() {
  const counts = { a: 2, b: 3 };
  const listeners = new Set();
  const store = { listen(fn) { const listener = () => fn(); listeners.add(listener); return () => listeners.delete(listener); } };
  return { counts, listeners, api: {
    AccountStore: { ...store, accountIds: () => ['one', 'two'] },
    CategoryStore: { ...store, getCategoriesWithRoles(ids, role) {
      assert.deepEqual(ids, ['one', 'two']); assert.equal(role, 'inbox');
      return [{ id: 'a' }, { id: 'b' }];
    } },
    ThreadCountsStore: { ...store, unreadCountForCategoryId: id => counts[id] },
  } };
}
const now = new Date('2026-10-15T16:00:00+08:00');
const unix = text => Date.parse(text) / 1000;
function event(id, start, end, extra = {}) {
  return { id, accountId: 'one', calendarId: 'work', title: id,
    start: unix(start), end: unix(end), ...extra };
}
const sampleEvents = [
  event('Finished', '2026-10-15T15:00:00+08:00', '2026-10-15T16:00:00+08:00'),
  event('Ongoing', '2026-10-15T15:30:00+08:00', '2026-10-15T16:30:00+08:00'),
  event('Later', '2026-10-15T17:00:00+08:00', '2026-10-15T18:00:00+08:00', { location: 'Room A' }),
  event('Tomorrow', '2026-10-16T09:00:00+08:00', '2026-10-16T10:00:00+08:00'),
  event('Cancelled', '2026-10-15T17:00:00+08:00', '2026-10-15T18:00:00+08:00', { isCancelled: true }),
  event('Declined', '2026-10-15T17:00:00+08:00', '2026-10-15T18:00:00+08:00', { declinedByMe: true }),
];

test('unread uses every inbox and preserves zero, unknown and counts above 999', () => {
  const f = mailFixture();
  assert.equal(inboxUnread(f.api), 5);
  f.counts.b = 1400; assert.equal(inboxUnread(f.api), 1402);
  f.counts.a = 0; f.counts.b = 0; assert.equal(inboxUnread(f.api), 0);
  for (const value of [null, undefined, NaN, -1]) {
    f.counts.b = value; assert.equal(inboxUnread(f.api), null);
  }
  f.api.CategoryStore.getCategoriesWithRoles = () => [];
  assert.equal(inboxUnread(f.api), null);
});

test('agenda includes ongoing, upcoming and all-day events, excludes ended and other dates', () => {
  const localDay = Math.floor(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()) / 86400000);
  const feed = { events: [...sampleEvents, { id: 'day', accountId: 'one', calendarId: 'work',
    title: 'All-day', isAllDay: true, startDate: localDay, endDate: localDay }] };
  const menu = agendaTemplate(feed, 5, {}, now);
  assert.match(menu[0].label, /5 unread inbox conversations/);
  const rows = menu.filter(item => item.submenu);
  assert.equal(rows.length, 3);
  assert.match(rows[0].label, /All day.*All-day/);
  assert.match(rows[1].label, /Now.*Ongoing/);
  assert.match(rows[2].label, /Later/);
  assert(rows[2].submenu.some(item => item.label === 'Room A'));
  assert(menu.some(item => /Asia\/Singapore/.test(item.label || '')));
  assert.match(agendaTemplate({ events: [] }, 0, {}, now)[0].label, /^0 unread/);
});

test('calendar loading, failures and empty agenda are distinct; native commands remain', () => {
  for (const [feed, expected] of [[{ loading: true }, /Loading/], [{ error: 'private error' }, /unavailable/],
    [{ events: [] }, /No meetings left/]]) {
    const menu = agendaTemplate(feed, null, {}, now);
    assert.match(menu[0].label, /unavailable/);
    assert(menu.some(item => expected.test(item.label || '')));
    for (const label of ['Open Inbox', 'Open Calendar', 'New Message', 'Preferences', 'Quit Mailspring'])
      assert(menu.some(item => item.label === label));
  }
});

test('meeting titles are plain labels and only supported join links become actions', () => {
  const opened = [];
  const menu = agendaTemplate({ events: [
    { ...sampleEvents[2], title: 'A\n<script> & B', location: 'https://meet.google.com/abc-defg-hij' },
    { ...sampleEvents[2], id: 'unsafe', title: 'Unsafe', location: 'javascript:alert(1)' },
  ] }, 2, { join: link => opened.push(link) }, now);
  const rows = menu.filter(item => item.submenu);
  assert(rows.every(item => !item.label.includes('\n')));
  const join = rows[0].submenu.find(item => item.label === 'Join meeting');
  join.click(); assert.deepEqual(opened, ['https://meet.google.com/abc-defg-hij']);
  assert(!rows[1].submenu.some(item => item.label === 'Join meeting'));
});

test('menu attaches to existing tray, updates counts, recovers a replaced tray and cleans up', () => {
  const f = mailFixture();
  const built = [], timers = new Set(), commands = [], windowHandlers = new Map(), restored = [];
  function tray() { return { setTitle(value) { this.title = value; }, setToolTip(value) { this.tooltip = value; },
    setContextMenu(menu) { this.menu = menu; } }; }
  const manager = { _tray: tray(), destroyTray() { this._tray = null; }, initTray() { this._tray = tray(); } };
  class Feed {
    constructor(api, env, onChange) { this.changed = onChange; this.events = []; Feed.instance = this; }
    start() { this.started = true; this.changed(); }
    stop() { this.stopped = true; }
    displayDate() { return new Date(); }
  }
  const menu = installMacMenu(f.api, {}, { platform: 'darwin', Feed,
    nativeTray: { restore(tray) { restored.push(tray); tray.setTitle(''); tray.setContextMenu(['native menu']); } },
    remote: { getGlobal: () => ({ systemTrayManager: manager }), Menu: { buildFromTemplate(template) {
      built.push(template); return template;
    } } },
    ipcRenderer: { send: (...args) => commands.push(args) }, shell: {},
    setInterval: fn => { timers.add(fn); return fn; }, clearInterval: fn => timers.delete(fn),
    windowEvents: { addEventListener: (name, fn) => windowHandlers.set(name, fn),
      removeEventListener: name => windowHandlers.delete(name) },
  });
  assert.equal(Feed.instance.started, true);
  assert.equal(manager._tray.title, '5');
  assert.equal(f.listeners.size, 3);
  const firstMenu = manager._tray.menu;
  firstMenu.find(item => item.label === 'Open Inbox').click();
  assert.deepEqual(commands.pop(), ['command', 'application:show-main-window']);
  f.counts.a = 7; for (const listener of f.listeners) listener();
  assert.equal(manager._tray.title, '10');
  const unchanged = built.length;
  manager._tray.tooltip = 'native tooltip';
  for (const tick of timers) tick();
  assert.match(manager._tray.tooltip, /^10 unread inbox conversations/);
  assert.equal(built.length, unchanged);
  manager._tray = null; for (const tick of timers) tick();
  manager._tray = tray(); for (const tick of timers) tick();
  assert.equal(manager._tray.title, '10');
  const attached = manager._tray;
  windowHandlers.get('unload')(); menu.cleanup();
  assert.equal(attached.title, ''); assert.equal(manager._tray, attached, 'unload must retain the status item and its position');
  assert.deepEqual(restored, [attached]); assert.deepEqual(attached.menu, ['native menu']);
  assert.equal(Feed.instance.stopped, true); assert.equal(f.listeners.size, 0); assert.equal(timers.size, 0);
  assert.equal(windowHandlers.size, 0);
  const count = built.length; Feed.instance.changed(); assert.equal(built.length, count);
});

test('agenda changes day after midnight without retaining yesterday’s all-day entries', () => {
  const tomorrow = new Date(dayBounds(now).endUnix * 1000 + 60000);
  const menu = agendaTemplate({ events: sampleEvents }, 1, {}, tomorrow);
  const rows = menu.filter(item => item.submenu);
  assert.equal(rows.length, 1); assert.match(rows[0].label, /Tomorrow/);
});

test('native restoration retains the icon and provides commands after the renderer closes', () => {
  const commands = [], module = { exports: {} };
  const application = { systemTrayManager: { _unreadString: '4' }, emit: name => commands.push(name) };
  const file = path.join(__dirname, '../lib/mac-menu-native.js');
  vm.runInNewContext(fs.readFileSync(file, 'utf8'), { module, global: { application },
    require: () => ({ Menu: { buildFromTemplate: items => items } }) }, { filename: file });
  const tray = { isDestroyed: () => false, setContextMenu(menu) { this.menu = menu; },
    setTitle(title) { this.title = title; }, setToolTip(tooltip) { this.tooltip = tooltip; } };
  module.exports.restore(tray);
  assert.equal(tray.title, ''); assert.equal(tray.tooltip, '4 unread messages');
  for (const item of tray.menu) item.click?.();
  assert.deepEqual(commands, ['application:show-main-window', 'application:new-message',
    'application:open-preferences', 'application:quit']);
  tray.isDestroyed = () => true;
  tray.setContextMenu = () => assert.fail('destroyed tray must not be touched');
  module.exports.restore(tray);
});
