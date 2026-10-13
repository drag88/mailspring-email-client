'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { installLayout, LOCATION_ID } = require('../lib/layout');

test('adds a separate pane in every mail layout and removes only its own column', () => {
  const original = { id: 'ThreadList' };
  const workspace = { Location: {}, Sheet: {
    Threads: { columns: { list: [original], split: [original], splitVertical: [original] } },
    Thread: { columns: { list: [{ id: 'MessageList' }] } },
    Preferences: { columns: { list: [{ id: 'Settings' }] } },
  }, trigger() {} };
  const layout = installLayout(workspace);
  for (const sheet of [workspace.Sheet.Threads, workspace.Sheet.Thread])
    for (const columns of Object.values(sheet.columns)) assert.equal(columns.at(-1).id, LOCATION_ID);
  assert.equal(workspace.Sheet.Preferences.columns.list.length, 1);
  workspace.Sheet.Threads.columns.list.push({ id: 'OtherPlugin' });
  layout.cleanup();
  assert.deepEqual(workspace.Sheet.Threads.columns.list.map(c => c.id), ['ThreadList', 'OtherPlugin']);
  assert.equal(workspace.Location[LOCATION_ID], undefined);
});
