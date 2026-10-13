'use strict';
const { validReminderInstant, reminderDue } = require('./reminders');

function localDateKey(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function validDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [y, m, d] = value.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  return date.getFullYear() === y && date.getMonth() === m - 1 && date.getDate() === d;
}

function normalizeAction(input, previous = {}) {
  const title = String(input.title || '').trim();
  const owner = String(input.owner || '').trim() || 'Me';
  const dueDate = String(input.dueDate || '');
  const notes = String(input.notes || '').trim();
  const remindAt = input.remindAt === undefined ? previous.remindAt || null : input.remindAt || null;
  if (!title || title.length > 300) throw new Error('Enter an action title (up to 300 characters).');
  if (owner.length > 80) throw new Error('Owner must be 80 characters or fewer.');
  if (notes.length > 2000) throw new Error('Notes must be 2,000 characters or fewer.');
  if (dueDate && !validDate(dueDate)) throw new Error('Choose a valid due date.');
  if (remindAt && !validReminderInstant(remindAt)) throw new Error('Choose a valid reminder date and time.');
  const source = input.source === undefined ? previous.source : input.source;
  const cleanSource = source && typeof source.threadId === 'string' && source.threadId &&
    typeof source.accountId === 'string' && source.accountId ? {
      threadId: source.threadId, accountId: source.accountId,
      subject: String(source.subject || '(No subject)').slice(0, 500),
    } : null;
  return { title, owner, dueDate, notes, source: cleanSource, remindAt };
}

function actionGroup(action, today, now = Date.now()) {
  if (action.completedAt) return 'Done';
  if (reminderDue(action, now)) return 'Reminders';
  if (!action.dueDate) return 'No due date';
  if (action.dueDate < today) return 'Overdue';
  return action.dueDate === today ? 'Today' : 'Upcoming';
}

function groupActions(actions, filter, today, now = Date.now()) {
  const groups = new Map();
  const order = filter === 'done' ? ['Done'] : ['Reminders', 'Overdue', 'Today', 'No due date', 'Upcoming'];
  for (const group of order) groups.set(group, []);
  for (const action of actions) {
    const group = actionGroup(action, today, now);
    if (filter === 'done' ? group !== 'Done' : group === 'Done') continue;
    if (filter === 'due' && group === 'Upcoming') continue;
    groups.get(group)?.push(action);
  }
  for (const list of groups.values()) list.sort((a, b) =>
    (a.dueDate || '9999').localeCompare(b.dueDate || '9999') || a.createdAt.localeCompare(b.createdAt));
  return [...groups].filter(([, list]) => list.length);
}

function dayBounds(now = new Date()) {
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  return { startUnix: start.getTime() / 1000, endUnix: end.getTime() / 1000 };
}

function calendarDay(date) {
  return Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / 86400000;
}

function monthGrid(year, month, selectedKey, todayKey = localDateKey()) {
  const first = new Date(year, month, 1, 12);
  const offset = (first.getDay() + 6) % 7;
  const days = new Date(year, month + 1, 0).getDate();
  const size = Math.ceil((offset + days) / 7) * 7;
  return Array.from({ length: size }, (_, index) => {
    const date = new Date(year, month, index - offset + 1, 12);
    const key = localDateKey(date);
    return { key, day: date.getDate(), inMonth: date.getMonth() === month,
      isToday: key === todayKey, isSelected: key === selectedKey };
  });
}

function visibleEvents(events, now = new Date()) {
  const { startUnix, endUnix } = dayBounds(now);
  const day = calendarDay(now);
  const unique = new Map();
  for (const event of events) {
    if (event.isCancelled) continue;
    const inDay = event.isAllDay ? event.startDate <= day && event.endDate >= day :
      event.start < endUnix && (event.end > startUnix || event.end === event.start && event.start >= startUnix);
    if (!inDay) continue;
    // A declined invitation should not look like an upcoming commitment.
    if (event.declinedByMe) continue;
    const key = `${event.accountId}:${event.calendarId}:${event.id}`;
    unique.set(key, event);
  }
  return [...unique.values()].sort((a, b) =>
    Number(!a.isAllDay) - Number(!b.isAllDay) || (a.start || 0) - (b.start || 0) || a.title.localeCompare(b.title));
}

function meetingLink(event) {
  const content = `${event.location || ''}\n${event.description || ''}`.replace(/&amp;/g, '&');
  const candidates = content.match(/[a-z][a-z0-9+.-]*:\/\/[^\s<>"'\\]+|(?<![\w@./:-])(?:meet\.google\.com|(?:[a-z0-9-]+\.)?zoom\.us|teams\.microsoft\.com)\/[^\s<>"'\\]+/gi) || [];
  for (const candidate of candidates) {
    const clean = candidate.replace(/[\]),.;]+$/, '');
    try {
      let url = new URL(/^[a-z][a-z0-9+.-]*:\/\//i.test(clean) ? clean : `https://${clean}`);
      // Google Calendar sometimes wraps the actual destination in a redirect URL.
      if ((url.hostname === 'www.google.com' || url.hostname === 'google.com') && url.pathname === '/url') {
        url = new URL(url.searchParams.get('q') || url.searchParams.get('url'));
      }
      const host = url.hostname.toLowerCase();
      const known = host === 'meet.google.com' || host === 'teams.microsoft.com' ||
        host === 'teams.live.com' || host === 'teams.cloud.microsoft' ||
        host === 'zoom.us' || host.endsWith('.zoom.us') ||
        host === 'webex.com' || host.endsWith('.webex.com');
      if (url.protocol === 'https:' && known && !url.username && !url.password && (!url.port || url.port === '443')) return url.href;
    } catch (_) { /* Unrecognised or malformed location text isn't a join link. */ }
  }
  return null;
}

function descriptionText(value) {
  return String(value || '').replace(/<\s*(script|style)\b[^>]*>[\s\S]*?<\s*\/\s*\1\s*>/gi, '')
    .replace(/<br\s*\/?\s*>|<\/(?:p|div|li|tr|h[1-6])\s*>/gi, '\n').replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/gi, ' ').replace(/&quot;/gi, '"').replace(/&#(?:39|x27);/gi, "'")
    .replace(/&lt;/gi, '<').replace(/&gt;/gi, '>').replace(/&amp;/gi, '&')
    .replace(/\n{3,}/g, '\n\n').trim();
}

module.exports = { localDateKey, validDate, normalizeAction, actionGroup, groupActions, dayBounds, visibleEvents, meetingLink, descriptionText, monthGrid };
