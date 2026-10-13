'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { EventEmitter } = require('events');
const { normalizeAction } = require('./core');

class ActionStore extends EventEmitter {
  constructor(filePath) {
    super();
    this.filePath = filePath;
    this.actions = [];
    this.error = null;
    try {
      const payload = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      if (payload.version !== 1 || !Array.isArray(payload.actions)) throw new Error('Invalid file format');
      const ids = new Set();
      this.actions = payload.actions.map(action => {
        if (!action || typeof action.id !== 'string' || ids.has(action.id) ||
            typeof action.createdAt !== 'string' || !Number.isFinite(Date.parse(action.createdAt)) ||
            action.completedAt && !Number.isFinite(Date.parse(action.completedAt))) throw new Error('Invalid action');
        ids.add(action.id);
        if (action.reminderNotifiedFor && action.reminderNotifiedFor !== action.remindAt) throw new Error('Invalid reminder delivery state');
        return { ...normalizeAction(action), id: action.id, createdAt: action.createdAt,
          updatedAt: action.updatedAt || action.createdAt, completedAt: action.completedAt || null,
          reminderNotifiedFor: action.reminderNotifiedFor || null };
      });
    } catch (error) {
      if (error.code !== 'ENOENT') this.error = 'Your saved actions could not be read. The existing file has been preserved.';
    }
  }

  save(input, id) {
    const previous = id ? this.actions.find(action => action.id === id) : null;
    if (id && !previous) throw new Error('That action no longer exists.');
    const now = new Date().toISOString();
    const normalized = normalizeAction(input, previous || {});
    const action = { ...normalized, id: id || crypto.randomUUID(),
      createdAt: previous?.createdAt || now, updatedAt: now, completedAt: previous?.completedAt || null,
      reminderNotifiedFor: normalized.remindAt === previous?.remindAt ? previous?.reminderNotifiedFor || null : null };
    this.commit(id ? this.actions.map(item => item.id === id ? action : item) : [...this.actions, action]);
    return action;
  }

  complete(id, completed) {
    if (!this.actions.some(action => action.id === id)) throw new Error('That action no longer exists.');
    const now = new Date().toISOString();
    this.commit(this.actions.map(action => action.id === id ?
      { ...action, completedAt: completed ? now : null, updatedAt: now,
        remindAt: completed ? null : action.remindAt, reminderNotifiedFor: completed ? null : action.reminderNotifiedFor } : action));
  }

  markReminderNotified(id, remindAt) {
    const action = this.actions.find(item => item.id === id);
    if (!action || action.completedAt || action.remindAt !== remindAt || action.reminderNotifiedFor === remindAt) return;
    this.commit(this.actions.map(item => item.id === id ? { ...item, reminderNotifiedFor: remindAt } : item));
  }

  snooze(id, remindAt) {
    const action = this.actions.find(item => item.id === id);
    if (!action || action.completedAt) throw new Error('Only open actions can be snoozed.');
    return this.save({ ...action, remindAt }, id);
  }

  dismissReminder(id) {
    const action = this.actions.find(item => item.id === id);
    if (!action) throw new Error('That action no longer exists.');
    return this.save({ ...action, remindAt: null }, id);
  }

  commit(actions) {
    if (this.error) throw new Error(this.error);
    const directory = path.dirname(this.filePath);
    let tempPath;
    try {
      fs.mkdirSync(directory, { recursive: true, mode: 0o700 });
      tempPath = `${this.filePath}.${crypto.randomUUID()}.tmp`;
      fs.writeFileSync(tempPath, JSON.stringify({ version: 1, actions }, null, 2) + '\n', { mode: 0o600, flag: 'wx' });
      if (fs.existsSync(this.filePath)) {
        fs.copyFileSync(this.filePath, `${this.filePath}.bak`);
        fs.chmodSync(`${this.filePath}.bak`, 0o600);
      }
      fs.renameSync(tempPath, this.filePath);
      this.actions = actions;
      this.emit('change');
    } catch (_) {
      if (tempPath) { try { fs.unlinkSync(tempPath); } catch (_) {} }
      throw new Error('Could not save the action. Your previous actions are unchanged.');
    }
  }
}
module.exports = { ActionStore };
