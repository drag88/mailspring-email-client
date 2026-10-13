'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { ActionStore } = require('../lib/action-store');

function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'today-actions-test-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  return { root, file: path.join(root, 'private', 'actions.json') };
}

test('actions persist through restart, edit, completion and reopening with source intact', t => {
  const { file } = fixture(t);
  const store = new ActionStore(file);
  const source = { threadId: 't1', accountId: 'a1', subject: 'Sample thread' };
  const action = store.save({ title: 'Follow up', owner: 'Me', dueDate: '2026-10-06', source });
  assert.equal(fs.statSync(file).mode & 0o777, 0o600);
  store.save({ title: 'Follow up again', owner: 'Owner', dueDate: '2026-10-07' }, action.id);
  assert.deepEqual(store.actions[0].source, source);
  assert.equal(JSON.parse(fs.readFileSync(`${file}.bak`)).actions[0].title, 'Follow up');
  store.complete(action.id, true);
  const restarted = new ActionStore(file);
  assert.ok(restarted.actions[0].completedAt);
  restarted.complete(action.id, false);
  assert.equal(new ActionStore(file).actions[0].completedAt, null);
  assert.equal(restarted.actions[0].createdAt, action.createdAt);
});

test('corrupt or incompatible storage is preserved and blocked from overwrites', t => {
  const { root, file } = fixture(t);
  fs.mkdirSync(path.dirname(file));
  for (const bytes of ['{"broken":', JSON.stringify({ version: 99, actions: [] }),
    JSON.stringify({ version: 1, actions: [{ id: '1', title: '', createdAt: 'invalid' }] })]) {
    fs.writeFileSync(file, bytes);
    const store = new ActionStore(file);
    assert.ok(store.error);
    assert.throws(() => store.save({ title: 'New task' }));
    assert.equal(fs.readFileSync(file, 'utf8'), bytes);
    assert.equal(store.actions.length, 0);
  }
  assert.equal(fs.readdirSync(root).length, 1);
});

test('failed writes preserve memory and previously saved file', t => {
  const { root, file } = fixture(t);
  const store = new ActionStore(file);
  store.save({ title: 'Keep me' });
  const before = fs.readFileSync(file, 'utf8');
  const blocker = path.join(root, 'not-a-directory');
  fs.writeFileSync(blocker, 'blocker');
  store.filePath = path.join(blocker, 'actions.json');
  assert.throws(() => store.save({ title: 'Cannot save' }), /Could not save/);
  assert.equal(store.actions.length, 1);
  assert.equal(fs.readFileSync(file, 'utf8'), before);
});

test('validation failures and unknown IDs cannot modify stored tasks', t => {
  const { file } = fixture(t);
  const store = new ActionStore(file);
  store.save({ title: 'Keep me' });
  const before = fs.readFileSync(file, 'utf8');
  assert.throws(() => store.save({ title: 'Bad', dueDate: '2026-02-30' }));
  assert.throws(() => store.save({ title: 'Wrong id' }, 'missing'));
  assert.throws(() => store.complete('missing', true));
  assert.equal(fs.readFileSync(file, 'utf8'), before);
});
