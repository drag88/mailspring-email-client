'use strict';
const { Menu } = require('electron');

function restore(tray) {
  const application = global.application;
  if (!application || tray.isDestroyed()) return;
  const command = name => () => application.emit(name);
  // These callbacks live in the main process, so they survive the renderer closing.
  const menu = Menu.buildFromTemplate([
    { label: 'Open Inbox', click: command('application:show-main-window') },
    { label: 'New Message', click: command('application:new-message') },
    { label: 'Preferences', click: command('application:open-preferences') },
    { type: 'separator' },
    { label: 'Quit Mailspring', click: command('application:quit') },
  ]);
  tray.setContextMenu(menu);
  tray.setTitle('');
  const unread = application.systemTrayManager._unreadString;
  tray.setToolTip(unread ? `${unread} unread messages` : '');
}

module.exports = { restore };
