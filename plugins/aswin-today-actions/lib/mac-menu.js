'use strict';
const path = require('path');
const { CalendarFeed } = require('./calendar-feed');
const { visibleEvents, meetingLink } = require('./core');
const { meetingLocation } = require('./meeting-display');

function inboxUnread(api) {
  const accounts = api.AccountStore.accountIds();
  const inboxes = api.CategoryStore.getCategoriesWithRoles(accounts, 'inbox');
  if (inboxes.length !== accounts.length) return null;
  let total = 0;
  for (const inbox of inboxes) {
    const count = api.ThreadCountsStore.unreadCountForCategoryId(inbox.id);
    if (!Number.isSafeInteger(count) || count < 0) return null;
    total += count;
  }
  return total;
}

function label(text, limit = 130) {
  const plain = String(text || '').replace(/[\x00-\x1f\x7f]/g, ' ').trim();
  return plain.length > limit ? `${plain.slice(0, limit - 1)}…` : plain;
}

function agendaTemplate(feed, unread, actions, now = new Date()) {
  const command = name => () => actions.command?.(name);
  const time = unix => new Date(unix * 1000).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const events = visibleEvents(feed.events || [], now).filter(event =>
    event.isAllDay || event.end > now.getTime() / 1000 || event.start >= now.getTime() / 1000);
  const template = [
    { label: unread === null ? 'Unread count unavailable' : `${unread} unread inbox conversation${unread === 1 ? '' : 's'}`, enabled: false },
    { label: 'All connected accounts', enabled: false },
    { label: 'Open Inbox', click: command('application:show-main-window') },
    { type: 'separator' },
    { label: `Rest of today · ${now.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })}`, enabled: false },
    { label: timezone, enabled: false },
  ];
  if (feed.error) template.push({ label: 'Calendar unavailable. Open Calendar to check sync.', enabled: false });
  else if (feed.loading) template.push({ label: 'Loading today’s meetings…', enabled: false });
  else if (!events.length) template.push({ label: 'No meetings left today', enabled: false });
  else for (const event of events) {
    const ongoing = !event.isAllDay && event.start <= now.getTime() / 1000;
    const timing = event.isAllDay ? 'All day' : `${time(event.start)} – ${time(event.end)}`;
    const title = label(event.title || '(Untitled event)');
    const location = label(meetingLocation(event));
    const link = meetingLink(event);
    const submenu = [{ label: title, enabled: false }, { label: timing, enabled: false }];
    if (location) submenu.push({ label: location, enabled: false });
    if (link) submenu.push({ label: 'Join meeting', click: () => actions.join?.(link) });
    submenu.push({ label: 'Open Calendar', click: command('application:show-calendar') });
    template.push({ label: `${event.isAllDay ? 'All day' : ongoing ? 'Now' : time(event.start)}  ${title}`, submenu });
  }
  template.push(
    { label: 'Open Calendar', click: command('application:show-calendar') },
    { type: 'separator' },
    { label: 'New Message', click: command('application:new-message') },
    { label: 'Preferences', click: command('application:open-preferences') },
    { type: 'separator' },
    { label: 'Quit Mailspring', click: command('application:quit') },
  );
  return template;
}

function installMacMenu(api, appEnv, services = {}) {
  if ((services.platform || process.platform) !== 'darwin') return null;
  const remote = services.remote || require(path.join(appEnv.getLoadSettings().resourcePath, 'node_modules/@electron/remote'));
  const { ipcRenderer, shell } = services.ipcRenderer ? services : require('electron');
  const manager = remote.getGlobal('application').systemTrayManager;
  if (!manager) throw new Error('Mailspring menu bar is unavailable.');
  const nativeTray = services.nativeTray || remote.require(path.join(__dirname, 'mac-menu-native.js'));
  const Feed = services.Feed || CalendarFeed;
  const every = services.setInterval || ((fn, ms) => globalThis.setInterval(fn, ms));
  const cancel = services.clearInterval || (id => globalThis.clearInterval(id));
  const windowEvents = services.windowEvents || globalThis.window;
  const subscriptions = [];
  let stopped = false, attached = null, signature = '', timer, menu;
  const actions = {
    command: name => { if (!stopped) ipcRenderer.send('command', name); },
    join: link => { if (!stopped) Promise.resolve(shell.openExternal(link)).catch(() => {}); },
  };
  // Keep a separate today feed: browsing the sidebar must never change the menu's day.
  const feed = new Feed(api, appEnv, update);
  function update() {
    if (stopped) return;
    try {
      const tray = manager._tray;
      if (!tray || tray.isDestroyed?.()) { attached = null; return; }
      let unread = null;
      try { unread = inboxUnread(api); } catch (_) {}
      const template = agendaTemplate(feed, unread, actions);
      // Include links because two invitations can share a title and meeting time.
      const next = JSON.stringify([template, (feed.events || []).map(meetingLink)]);
      tray.setTitle(unread === null ? '–' : String(unread));
      tray.setToolTip(unread === null ? 'Mailspring · unread count unavailable' :
        `${unread} unread inbox conversations · all connected accounts`);
      if (attached === tray && signature === next) return;
      menu = remote.Menu.buildFromTemplate(template);
      tray.setContextMenu(menu);
      attached = tray; signature = next;
    } catch (_) {
      // A tray may disappear while macOS or the user toggles its visibility; retry below.
      signature = '';
    }
  }
  function cleanup() {
    if (stopped) return;
    stopped = true;
    windowEvents?.removeEventListener('unload', cleanup);
    cancel(timer);
    for (const unsubscribe of subscriptions) unsubscribe();
    feed.stop();
    try {
      if (attached && manager._tray === attached && !attached.isDestroyed?.()) {
        // Preserve the status item's position when the renderer reloads or closes.
        nativeTray.restore(attached);
      }
    } catch (_) {}
    menu = null; attached = null;
  }
  try {
    // The host's deactivatePackages is a stub; also release callbacks on a real unload.
    windowEvents?.addEventListener('unload', cleanup);
    for (const store of [api.ThreadCountsStore, api.AccountStore, api.CategoryStore])
      subscriptions.push(store.listen(update));
    feed.start();
    update();
    // Also recover a newly created tray after its native visibility setting changes.
    timer = every(update, 15000);
  } catch (error) { cleanup(); throw error; }
  return { cleanup };
}

module.exports = { inboxUnread, agendaTemplate, installMacMenu };
