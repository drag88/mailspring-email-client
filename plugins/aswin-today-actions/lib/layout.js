'use strict';
const LOCATION_ID = 'AswinTodayActions';

function installLayout(workspace) {
  const location = { id: LOCATION_ID, Toolbar: { id: `${LOCATION_ID}:Toolbar` } };
  const changed = [];
  workspace.Location[LOCATION_ID] = location;
  for (const name of ['Threads', 'Thread']) {
    const sheet = workspace.Sheet[name];
    if (!sheet) continue;
    for (const [mode, columns] of Object.entries(sheet.columns)) {
      if (columns.some(column => column.id === LOCATION_ID)) continue;
      sheet.columns[mode] = [...columns, location];
      changed.push({ sheet, mode });
    }
  }
  if (!changed.length) {
    delete workspace.Location[LOCATION_ID];
    throw new Error('Mailspring email workspace is unavailable.');
  }
  workspace.trigger();
  return { location, cleanup() {
    for (const { sheet, mode } of changed) sheet.columns[mode] =
      sheet.columns[mode].filter(column => column.id !== LOCATION_ID);
    delete workspace.Location[LOCATION_ID];
    workspace.trigger();
  } };
}

module.exports = { installLayout, LOCATION_ID };
