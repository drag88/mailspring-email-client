'use strict';

function validReminderInstant(value) {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value) &&
    Number.isFinite(Date.parse(value)) && new Date(value).toISOString() === value;
}

function localReminderValue(instant) {
  if (!instant) return '';
  const d = new Date(instant);
  const pad = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function reminderISO(localValue) {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(localValue || '')) throw new Error('Choose a reminder date and time.');
  const d = new Date(localValue);
  if (!Number.isFinite(d.getTime()) || localReminderValue(d) !== localValue)
    throw new Error('Choose a valid reminder date and time.');
  return d.toISOString();
}

function suggestedReminder(dueDate, now = Date.now()) {
  const due = dueDate && new Date(`${dueDate}T09:00:00`).getTime();
  return localReminderValue(new Date(due > now ? due : Math.ceil((now + 15 * 60000) / 60000) * 60000));
}

function snoozeInstant(choice, now = Date.now()) {
  if (choice === 'tomorrow') {
    const d = new Date(now);
    d.setDate(d.getDate() + 1);
    d.setHours(9, 0, 0, 0);
    return d.toISOString();
  }
  if (![15, 60].includes(choice)) throw new Error('Choose a valid snooze interval.');
  return new Date(now + choice * 60000).toISOString();
}

function reminderDue(action, now = Date.now()) {
  return !action.completedAt && !!action.remindAt && Date.parse(action.remindAt) <= now;
}

class ReminderScheduler {
  constructor(store, notifications, { clock = Date.now, onOpen = () => {}, onUpdate = () => {},
    setTimer = (callback, ms) => globalThis.setInterval(callback, ms),
    clearTimer = timer => globalThis.clearInterval(timer) } = {}) {
    Object.assign(this, { store, notifications, clock, onOpen, onUpdate, setTimer, clearTimer });
    this.active = false;
    this.running = false;
    this.handles = new Map();
    this.delivered = new Map();
    this.error = '';
    this.changed = () => { this.prune(); void this.tick(); };
  }
  start() {
    if (this.active) return;
    this.active = true;
    this.store.on('change', this.changed);
    this.timer = this.setTimer(() => { void this.tick(); }, 30000);
    this.timer?.unref?.();
    void this.tick();
  }
  close(handle) { try { handle?.close?.(); } catch (_) {} }
  prune() {
    for (const [id, entry] of this.handles) {
      const current = this.store.actions.find(action => action.id === id);
      if (!current || current.completedAt || current.remindAt !== entry.remindAt) {
        this.close(entry.handle); this.handles.delete(id);
      }
    }
  }
  async tick() {
    if (!this.active) return;
    if (this.running) { this.again = true; return; }
    this.running = true;
    try {
      for (const item of [...this.store.actions].sort((a, b) => (a.remindAt || '').localeCompare(b.remindAt || ''))) {
        if (!this.active) break;
        const action = this.store.actions.find(a => a.id === item.id);
        if (!action || !reminderDue(action, this.clock()) || action.reminderNotifiedFor === action.remindAt ||
            this.delivered.get(action.id) === action.remindAt || this.store.error) continue;
        const { id, remindAt } = action;
        try {
          const handle = await this.notifications?.displayNotification({
            title: 'Action reminder', body: action.title, tag: `today-action-${id}`, playSound: true,
            actions: [{ type: 'button', text: 'Snooze 15 min' }],
            onActivate: activation => {
              if (!this.active) return;
              const current = this.store.actions.find(a => a.id === id);
              if (!current || current.completedAt || current.remindAt !== remindAt) return;
              try {
                if (activation.activationType === 'action' && activation.actionIndex === 0)
                  this.store.snooze(id, snoozeInstant(15, this.clock()));
                else if (activation.activationType === 'clicked') this.onOpen(current);
              } catch (error) { this.error = error.message; this.onUpdate(); }
            },
          });
          if (!handle) throw new Error('Notification unavailable');
          const current = this.store.actions.find(a => a.id === id);
          if (!this.active || !current || current.completedAt || current.remindAt !== remindAt) {
            this.close(handle); continue;
          }
          this.handles.set(id, { remindAt, handle });
          this.delivered.set(id, remindAt);
          this.store.markReminderNotified(id, remindAt);
          this.error = '';
        } catch (_) {
          this.error = 'Could not issue a Mac notification. Due reminders remain in Actions; check notification settings or use Test notification.';
        }
      }
    } finally {
      this.running = false;
      if (this.active) this.onUpdate();
      if (this.again) { this.again = false; void this.tick(); }
    }
  }
  stop() {
    this.active = false;
    this.clearTimer(this.timer);
    this.store.removeListener('change', this.changed);
    for (const { handle } of this.handles.values()) this.close(handle);
    this.handles.clear();
  }
}

module.exports = { validReminderInstant, localReminderValue, reminderISO, suggestedReminder, snoozeInstant, reminderDue, ReminderScheduler };
