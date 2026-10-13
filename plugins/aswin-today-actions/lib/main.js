'use strict';
const path = require('path');
const { EventEmitter } = require('events');
const api = require('mailspring-exports');
const React = api.React;
const { ipcRenderer, shell } = require('electron');
const { ActionStore } = require('./action-store');
const { CalendarFeed } = require('./calendar-feed');
const { installLayout } = require('./layout');
const { installGroupedMail } = require('./grouped-mail');
const { installMailSidebar } = require('./mail-sidebar');
const { localDateKey, groupActions, meetingLink, descriptionText, monthGrid } = require('./core');
const { googleMeetingDraft, googleAccountEmail } = require('./meeting-draft');
const { readDisplay, saveDisplay, normalizeDisplay, meetingLocation, MIN_HEIGHT, MAX_HEIGHT } = require('./meeting-display');
const { createMeetingResizer } = require('./meeting-resizer');
const MeetingResizer = createMeetingResizer(React);
const { ReminderScheduler, localReminderValue, reminderISO, suggestedReminder, snoozeInstant, reminderDue } = require('./reminders');
const h = React.createElement;
let runtime = null;

function sourceFromThread(thread) {
  return thread?.id && thread.accountId ? {
    threadId: thread.id, accountId: thread.accountId, subject: thread.subject || '(No subject)',
  } : null;
}

function notify() { runtime?.events.emit('change'); }
function showPane() {
  if (runtime && api.WorkspaceStore.isLocationHidden(runtime.layout.location))
    api.Actions.toggleWorkspaceLocationHidden(runtime.layout.location);
}
function openEditor(action, thread) {
  if (!runtime || runtime.store.error) return;
  showPane();
  runtime.editor = action ? { ...action } : {
    title: thread?.subject || '', owner: 'Me', dueDate: localDateKey(), notes: '', source: sourceFromThread(thread),
  };
  runtime.editor.reminderEnabled = !!action?.remindAt;
  runtime.editor.reminderLocal = localReminderValue(action?.remindAt);
  runtime.actionsCollapsed = false;
  runtime.editorFocusRequested = true;
  runtime.alert = '';
  notify();
}
function perform(action) {
  try { action(); runtime.alert = ''; } catch (error) { runtime.alert = error.message; }
  notify();
}
function openCalendar() { ipcRenderer.send('command', 'application:show-calendar'); }

async function testNotification() {
  const current = runtime;
  try {
    const handle = await api.NativeNotifications?.displayNotification({ title: 'Today + Actions',
      body: 'Test reminder. Saved actions will alert at the time you choose.', playSound: true,
      onActivate: () => {
        if (runtime !== current) return;
        ipcRenderer.send('command', 'application:show-main-window');
        runtime.reminderStatus = 'Test notification opened successfully.';
        notify();
      } });
    if (!handle) throw new Error('Notification unavailable');
    if (runtime === current) {
      runtime.reminderStatus = 'Test notification issued. If no banner appeared, check Mailspring in macOS Notifications and Focus.';
      runtime.testNotifications.push(handle);
    } else handle.close?.();
  } catch (_) {
    if (runtime === current) runtime.reminderStatus = 'Could not issue a test notification. Check Mailspring in macOS Notifications.';
  }
  notify();
}

async function openMeetingDraft(date) {
  const accounts = api.AccountStore?.accounts() || [];
  const preferredId = api.FocusedContentStore?.focused('thread')?.accountId;
  const url = googleMeetingDraft({ date, email: googleAccountEmail(accounts, preferredId),
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone });
  await shell.openExternal(url);
}

class GoogleMeetingButton extends React.Component {
  constructor(props) { super(props); this.state = { error: '' }; }
  render() {
    return h('div', { className: 'taa-google-meeting' },
      button('New meeting', async () => {
        try { await openMeetingDraft(this.props.date); this.setState({ error: '' }); }
        catch (_) { this.setState({ error: 'Could not open Google Calendar. Try again.' }); }
      }, { className: 'taa-primary', title: 'Open a Google Calendar draft to add Meet, guests and rooms' }),
      this.props.compact ? null : h('span', { className: 'taa-meeting-hint' }, 'Add Meet and book rooms in Google Calendar'),
      this.state.error ? h('span', { role: 'alert' }, this.state.error) : null);
  }
}
GoogleMeetingButton.displayName = 'AswinGoogleMeetingButton';
GoogleMeetingButton.containerRequired = false;

async function openThread(source) {
  const current = runtime;
  try {
    const thread = await api.DatabaseStore.find(api.Thread, source.threadId);
    if (runtime !== current) return;
    if (!thread || thread.accountId !== source.accountId) throw new Error('Source email is unavailable. The account may be disconnected or the email removed.');
    api.Actions.focusThreadMainWindow(thread);
    runtime.alert = '';
  } catch (_) {
    if (runtime === current) runtime.alert = 'Source email is unavailable. The account may be disconnected or the email removed.';
  }
  notify();
}

class SidebarToggle extends React.Component {
  render() {
    return h('button', { className: 'btn btn-toolbar taa-toggle', title: 'Show or hide Today + Actions',
      onClick: () => runtime && api.Actions.toggleWorkspaceLocationHidden(runtime.layout.location),
      'aria-label': 'Show or hide Today and Actions' }, 'Today + Actions');
  }
}
SidebarToggle.displayName = 'AswinTodayActionsToggle';
SidebarToggle.containerRequired = false;

class AddActionButton extends React.Component {
  render() {
    if (!this.props.items || this.props.items.length !== 1) return null;
    return h('button', { className: 'btn btn-toolbar taa-add-button',
      title: 'Create an action linked to this email', onClick: () => openEditor(null, this.props.items[0]) }, '+ Action');
  }
}
AddActionButton.displayName = 'AswinAddAction';
AddActionButton.containerRequired = false;

function icon(name, size = 14) {
  const paths = {
    calendar: 'M8 3v4M16 3v4M4 10h16M6 5h12a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Z',
    actions: 'M9 12l2 2 4-4M6 3h12a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z',
    video: 'M4 6h10a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2ZM16 10l6-3v10l-6-3',
    plus: 'M12 5v14M5 12h14',
    refresh: 'M20 8a8 8 0 1 0 1 6M20 3v5h-5',
    email: 'M4 5h16a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1ZM3 6l9 7 9-7',
    edit: 'M14 5l5 5M4 20l4-1L20 7a2 2 0 0 0-4-4L4 15v5Z',
    clock: 'M12 8v5l3 2M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z',
    bell: 'M6 9a6 6 0 0 1 12 0v6l2 3H4l2-3V9ZM10 21h4',
    room: 'M5 21V3h14v18M2 21h20M9 7h6M9 11h6M9 15h6',
    chevron: 'M9 5l7 7-7 7',
  };
  return h('svg', { className: 'taa-icon', width: size, height: size, viewBox: '0 0 24 24',
    fill: 'none', stroke: 'currentColor', strokeWidth: 1.6, strokeLinecap: 'round', strokeLinejoin: 'round',
    'aria-hidden': true, focusable: false }, h('path', { d: paths[name] || paths.calendar }));
}

function button(label, onClick, props = {}) {
  const icons = { 'Open Calendar': 'calendar', 'Refresh': 'refresh', '+ New': 'plus', 'New meeting': 'plus',
    'Join meeting': 'video', 'Open email': 'email', 'Edit': 'edit', 'Save action': 'actions' };
  const name = typeof label === 'string' && icons[label];
  return h('button', { type: 'button', onClick, 'aria-label': typeof label === 'string' ? label : undefined, ...props },
    name ? h(React.Fragment, null, icon(name), h('span', null, label === '+ New' ? 'New' : label)) : label);
}

function ActionForm({ editor, formRef, titleRef }) {
  const change = field => event => { runtime.editor = { ...runtime.editor, [field]: event.target.value }; notify(); };
  return h('form', { className: 'taa-editor', ref: formRef, onSubmit: event => {
    event.preventDefault();
    perform(() => {
      runtime.store.save({ ...runtime.editor,
        remindAt: runtime.editor.reminderEnabled ?
          runtime.editor.remindAt && runtime.editor.reminderLocal === localReminderValue(runtime.editor.remindAt) ?
            runtime.editor.remindAt : reminderISO(runtime.editor.reminderLocal) : null }, runtime.editor.id);
      runtime.editor = null;
    });
  } },
    h('div', { className: 'taa-editor-heading' }, editor.id ? 'Edit action' : 'New action'),
    h('label', null, 'Action', h('input', { ref: titleRef, required: true, maxLength: 300,
      value: editor.title, onChange: change('title'), placeholder: 'What needs to happen?' })),
    h('div', { className: 'taa-form-row' },
      h('label', null, 'Owner', h('input', { maxLength: 80, value: editor.owner, onChange: change('owner') })),
      h('label', null, 'Due date', h('input', { type: 'date', value: editor.dueDate, onChange: change('dueDate') }))),
    h('label', { className: 'taa-reminder-check' }, h('input', { type: 'checkbox', checked: !!editor.reminderEnabled,
      onChange: event => {
        runtime.editor = { ...runtime.editor, reminderEnabled: event.target.checked,
          reminderLocal: runtime.editor.reminderLocal || suggestedReminder(runtime.editor.dueDate) };
        notify();
      } }), icon('bell'), 'Remind me'),
    editor.reminderEnabled ? h('label', null, 'Reminder date and time',
      h('input', { type: 'datetime-local', required: true, value: editor.reminderLocal, onChange: change('reminderLocal') }),
      h('span', { className: 'taa-reminder-hint' }, `${Intl.DateTimeFormat().resolvedOptions().timeZone} · Alerts while Mailspring is running`)) : null,
    h('label', null, 'Notes', h('textarea', { rows: 2, maxLength: 2000, value: editor.notes, onChange: change('notes'),
      placeholder: 'Optional context' })),
    editor.source ? h('div', { className: 'taa-source-preview' },
      h('span', null, 'Linked email: ', editor.source.subject),
      button('Open email', () => openThread(editor.source), { className: 'taa-link' }),
      button('Unlink', () => { runtime.editor = { ...runtime.editor, source: null }; notify(); }, { className: 'taa-link' })) :
      button('Link selected email', () => {
        const source = sourceFromThread(api.FocusedContentStore.focused('thread'));
        if (source) { runtime.editor = { ...runtime.editor, source }; notify(); }
      }, { className: 'taa-link', disabled: !api.FocusedContentStore.focused('thread') }),
    h('div', { className: 'taa-form-controls' },
      button('Cancel', () => { runtime.editor = null; runtime.alert = ''; notify(); }, { className: 'taa-secondary' }),
      h('button', { type: 'submit', className: 'taa-primary' }, 'Save action')));
}

function MonthCalendar({ feed }) {
  const selected = feed?.displayDate ? feed.displayDate() : new Date();
  const cursor = runtime.monthCursor ? new Date(`${runtime.monthCursor}-01T12:00:00`) : selected;
  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const selectedKey = localDateKey(selected);
  const changeMonth = delta => {
    runtime.monthCursor = localDateKey(new Date(year, month + delta, 1, 12)).slice(0, 7); notify();
  };
  const selectDate = key => {
    runtime.monthCursor = key.slice(0, 7);
    perform(() => feed?.setDate?.(key === localDateKey() ? null : key));
  };
  return h('section', { className: 'taa-month', 'aria-label': 'Month calendar' },
    h('div', { className: 'taa-month-heading' },
      h('h2', { className: 'taa-icon-heading' }, icon('calendar'), cursor.toLocaleDateString([], { month: 'long', year: 'numeric' })),
      h('div', { className: 'taa-month-controls' },
        button('Today', () => selectDate(localDateKey()), { className: 'taa-link' }),
        button('‹', () => changeMonth(-1), { className: 'taa-month-arrow', 'aria-label': 'Previous month' }),
        button('›', () => changeMonth(1), { className: 'taa-month-arrow', 'aria-label': 'Next month' }))),
    h('div', { className: 'taa-weekdays', 'aria-hidden': true },
      ...['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((name, i) => h('span', { key: i }, name))),
    h('div', { className: 'taa-month-grid', role: 'group', 'aria-label': 'Choose a day to view meetings' },
      ...monthGrid(year, month, selectedKey).map(day => button(day.day, () => selectDate(day.key), {
        key: day.key, disabled: !feed?.setDate,
        className: `taa-day${day.inMonth ? '' : ' taa-other-month'}${day.isToday ? ' taa-today' : ''}${day.isSelected ? ' taa-selected-day' : ''}`,
        'aria-label': new Date(`${day.key}T12:00:00`).toLocaleDateString([], { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }),
        'aria-pressed': day.isSelected, 'aria-current': day.isToday ? 'date' : undefined,
      }))));
}

function CalendarSection({ feed }) {
  const nowUnix = Date.now() / 1000;
  const calendars = new Map((feed?.calendars || []).map(calendar => [calendar.id, calendar]));
  const events = feed?.events || [];
  const showCalendarNames = new Set(events.map(event => `${event.accountId}:${event.calendarId}`)).size > 1;
  const time = unix => new Date(unix * 1000).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const displayDate = feed?.displayDate ? feed.displayDate() : new Date();
  const isToday = localDateKey(displayDate) === localDateKey();
  const heading = isToday ? 'Today’s calendar' : displayDate.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
  const collapsed = runtime.calendarCollapsed;
  const display = runtime.meetingDisplay;
  const updateDisplay = change => { runtime.meetingDisplay = saveDisplay(AppEnv.config, { ...display, ...change }); notify(); };
  return h('section', { className: `taa-calendar${display.compact ? ' taa-compact' : ''}`, 'aria-labelledby': 'taa-calendar-title' },
    h('div', { className: 'taa-section-heading' }, h('h2', { id: 'taa-calendar-title' },
      button(h(React.Fragment, null,
        h('span', { className: `taa-disclosure${collapsed ? '' : ' taa-expanded'}` }, icon('chevron', 12)), heading),
      () => { runtime.calendarCollapsed = !collapsed; notify(); }, {
        className: 'taa-section-toggle', 'aria-label': collapsed ? 'Expand meetings' : 'Collapse meetings',
        'aria-expanded': !collapsed, 'aria-controls': 'taa-calendar-content',
      })),
      button('Open', openCalendar, { className: 'taa-link', 'aria-label': 'Open Calendar', title: 'Open Calendar' })),
    h('div', { id: 'taa-calendar-content', className: 'taa-calendar-content', hidden: collapsed },
    h('p', { className: 'taa-muted taa-zone' }, timezone),
    h('div', { className: 'taa-calendar-tools' },
      h(GoogleMeetingButton, { date: displayDate, compact: true }),
      button('Display', () => { runtime.meetingDisplayOpen = !runtime.meetingDisplayOpen; notify(); }, {
        className: 'taa-link', 'aria-expanded': !!runtime.meetingDisplayOpen,
        'aria-controls': 'taa-meeting-display', title: 'Adjust meeting spacing and panel height' })),
    runtime.meetingDisplayOpen ? h('div', { id: 'taa-meeting-display', className: 'taa-meeting-display', role: 'group', 'aria-label': 'Meeting display settings' },
      h('label', { className: 'taa-compact-setting' }, h('input', { type: 'checkbox', checked: display.compact,
        onChange: event => updateDisplay({ compact: event.target.checked }) }), 'Compact meetings'),
      h('label', { className: 'taa-height-setting' }, h('span', null, 'Meeting list height', h('output', null, `${display.height}px`)),
        h('input', { type: 'range', min: MIN_HEIGHT, max: MAX_HEIGHT, step: 1, value: display.height,
          'aria-label': 'Meeting list height', 'aria-valuetext': `${display.height} pixels`,
          onChange: event => updateDisplay({ height: event.target.value }) }))) : null,
    feed?.error || runtime?.calendarError ? h('div', { className: 'taa-notice', role: 'status' }, feed?.error || runtime.calendarError) :
      feed?.loading ? h('p', { className: 'taa-muted' }, 'Loading your calendar…') :
      !events.length ? h('div', { className: 'taa-empty' },
        h('p', null, feed?.calendars.length ? `No events ${isToday ? 'today' : 'on this day'} in your visible calendars.` : 'No calendars have synced yet.'),
        h('p', { className: 'taa-muted' }, 'Open Calendar to check sync or choose visible calendars.')) :
      h('div', { className: 'taa-event-viewport', style: { height: display.height, maxHeight: display.height }, role: 'region',
        'aria-label': 'Meetings list', tabIndex: 0 }, h('ol', { className: 'taa-event-list' }, events.map(event => {
        const past = !event.isAllDay && event.end <= nowUnix;
        const active = !event.isAllDay && event.start <= nowUnix && event.end > nowUnix;
        const link = meetingLink(event);
        const calendar = calendars.get(event.calendarId);
        const key = `${event.accountId}:${event.calendarId}:${event.id}`;
        const expanded = runtime.expandedEvent === key;
        const notes = descriptionText(event.description);
        const location = meetingLocation(event);
        const calendarName = calendar?.name || 'Calendar';
        return h('li', { key, className: `taa-event${past ? ' taa-past' : ''}${active ? ' taa-now' : ''}${expanded ? ' taa-event-expanded' : ''}` },
          button(h(React.Fragment, null,
          h('span', { className: 'taa-event-time' }, icon(event.isAllDay ? 'calendar' : 'clock', 12), event.isAllDay ? 'All day' : `${time(event.start)} – ${time(event.end)}`,
            active ? h('span', { className: 'taa-badge' }, 'Now') : null,
            event.isPending ? h('span', { className: 'taa-pending' }, 'Tentative / RSVP') : null),
          h('span', { className: 'taa-event-title' }, event.title || '(Untitled event)'),
          showCalendarNames && (!display.compact || !calendarName.includes('@')) ? h('span', { className: 'taa-event-meta' }, calendarName) : null,
          location ? h('span', { className: 'taa-event-meta taa-location', title: location }, icon('room', 12), h('span', null, location)) : null,
          h('span', { className: 'taa-event-disclosure', 'aria-hidden': true }, expanded ? '−' : '›')),
          () => { runtime.expandedEvent = expanded ? null : key; notify(); }, {
            className: 'taa-event-open', 'aria-expanded': expanded,
            'aria-label': `View meeting details: ${event.title || '(Untitled event)'}`,
            title: 'Click to view meeting details',
          }),
          link ? button('Join meeting', () => {
            shell.openExternal(link).catch(() => {
              if (runtime) { runtime.alert = 'Could not open the meeting link.'; notify(); }
            });
          }, { className: 'taa-join', title: new URL(link).hostname }) : null,
          expanded ? h('div', { className: 'taa-event-details' },
            !link ? h('p', { className: 'taa-muted' }, 'No online meeting link is included in this synced invitation.') : null,
            notes ? h('p', { className: 'taa-event-notes' }, notes) : h('p', { className: 'taa-muted' }, 'No additional meeting notes.'),
            event.attendees?.length ? h('details', { className: 'taa-attendees' },
              h('summary', null, `Attendees (${event.attendees.length})`),
              h('ul', null, event.attendees.map((attendee, index) =>
                h('li', { key: index }, attendee.name || attendee.email)))) : null) : null);
      }))),
    button('Refresh', () => runtime.feed?.refresh(), { className: 'taa-link taa-refresh' })));
}

function ActionReminder({ action }) {
  if (!action.remindAt || action.completedAt) return null;
  const due = reminderDue(action);
  const label = new Date(action.remindAt).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
  return h('div', { className: 'taa-action-reminder' },
    h('div', { className: due ? 'taa-reminder-due' : '' }, icon('bell', 12), ` ${due ? 'Reminder due' : 'Remind'}: ${label}`),
    due ? h('div', { className: 'taa-snooze-controls', role: 'group', 'aria-label': `Reminder controls: ${action.title}` },
      ...[[15, '15 min'], [60, '1 hour'], ['tomorrow', 'Tomorrow 9am']].map(([choice, label]) =>
        button(label, () => perform(() => runtime.store.snooze(action.id, snoozeInstant(choice))), {
          key: choice, className: 'taa-link', disabled: !!runtime.store.error, 'aria-label': `Snooze ${label}`, title: `Snooze ${label}` })),
      button('Dismiss', () => perform(() => runtime.store.dismissReminder(action.id)), {
        className: 'taa-link', disabled: !!runtime.store.error, title: 'Remove reminder; keep action and due date', 'aria-label': 'Dismiss reminder' })) : null);
}

function ActionsSection({ actions, filter, editor, formRef, titleRef }) {
  const groups = groupActions(actions, filter, localDateKey());
  const counts = { due: groupActions(actions, 'due', localDateKey()).reduce((sum, [, list]) => sum + list.length, 0),
    all: actions.filter(action => !action.completedAt).length, done: actions.filter(action => action.completedAt).length };
  const collapsed = runtime.actionsCollapsed;
  return h('section', { className: 'taa-actions', 'aria-labelledby': 'taa-actions-title' },
    h('div', { className: 'taa-section-heading' }, h('h2', { id: 'taa-actions-title' },
      button(h(React.Fragment, null,
        h('span', { className: `taa-disclosure${collapsed ? '' : ' taa-expanded'}` }, icon('chevron', 12)),
        icon('actions'), 'Actions', h('span', { className: 'taa-action-count' }, counts.all)),
      () => { runtime.actionsCollapsed = !collapsed; notify(); }, {
        className: 'taa-section-toggle', 'aria-label': collapsed ? 'Expand actions' : 'Collapse actions',
        'aria-expanded': !collapsed, 'aria-controls': 'taa-actions-content',
      })),
      button('+ New', () => openEditor(null, api.FocusedContentStore.focused('thread')), {
        className: 'taa-link', disabled: !!runtime.store.error })),
    h('div', { id: 'taa-actions-content', className: 'taa-actions-content', hidden: collapsed },
    editor ? h(ActionForm, { editor, formRef, titleRef }) : null,
    h('div', { className: 'taa-filters', role: 'group', 'aria-label': 'Filter actions' },
      ...[['due', 'Due'], ['all', 'All open'], ['done', 'Done']].map(([key, label]) => button(`${label} ${counts[key]}`,
        () => { runtime.filter = key; notify(); }, { key, className: filter === key ? 'taa-filter active' : 'taa-filter',
          'aria-pressed': filter === key }))),
    h('div', { className: 'taa-reminder-info' },
      h('span', null, 'Alerts while Mailspring is running.'),
      button('Test notification', testNotification, { className: 'taa-link' })),
    runtime.reminders?.error || runtime.reminderStatus ? h('p', { className: 'taa-reminder-hint', role: 'status' },
      runtime.reminders?.error || runtime.reminderStatus) : null,
    groups.length ? groups.map(([group, items]) => h('div', { key: group, className: 'taa-action-group' },
      h('h3', { className: group === 'Overdue' ? 'taa-overdue' : '' }, group),
      ...items.map(action => h('article', { key: action.id, className: 'taa-action-card' },
        h('div', { className: 'taa-action-top' },
          h('input', { type: 'checkbox', checked: !!action.completedAt, disabled: !!runtime.store.error,
            'aria-label': `${action.completedAt ? 'Reopen' : 'Complete'} action: ${action.title}`,
            onChange: event => perform(() => runtime.store.complete(action.id, event.target.checked)) }),
          h('span', { className: `taa-action-title${action.completedAt ? ' taa-done' : ''}` }, action.title)),
        h('div', { className: 'taa-action-meta' }, `${action.owner} · ${action.dueDate || 'No due date'}`),
        h(ActionReminder, { action }),
        action.notes ? h('p', { className: 'taa-action-notes' }, action.notes) : null,
        h('div', { className: 'taa-action-controls' },
          action.source ? button('Open email', () => openThread(action.source), { className: 'taa-link', title: action.source.subject }) :
            h('span', { className: 'taa-muted' }, 'Standalone action'),
          button('Edit', () => openEditor(action), { className: 'taa-link', disabled: !!runtime.store.error })))))) :
      h('div', { className: 'taa-empty' }, filter === 'done' ? 'Completed actions appear here. You can reopen them.' :
        filter === 'due' && counts.all ? 'Nothing due. Choose All open to see future actions.' :
          'Select an email and click + Action, or create a standalone action.')));
}

class TodayActionsSidebar extends React.Component {
  constructor(props) { super(props); this.state = { revision: 0 }; }
  componentDidMount() {
    this.instance = runtime;
    this.update = () => this.setState(state => ({ revision: state.revision + 1 }));
    this.instance?.events.on('change', this.update);
    this.unlistenFocus = api.FocusedContentStore.listen(this.update);
    this.revealEditor();
  }
  componentDidUpdate() { this.revealEditor(); }
  revealEditor() {
    if (!runtime?.editorFocusRequested || !runtime.editor || !this.scroll || !this.editorForm || !this.editorInput) return;
    // Scroll only this pane, including when an already-open editor is replaced.
    this.scroll.scrollTop += this.editorForm.getBoundingClientRect().top - this.scroll.getBoundingClientRect().top - 72;
    this.editorInput.focus({ preventScroll: true });
    runtime.editorFocusRequested = false;
  }
  componentWillUnmount() {
    this.instance?.events.removeListener('change', this.update);
    this.unlistenFocus?.();
  }
  render() {
    if (!runtime) return null;
    const instance = runtime;
    return h('aside', { className: 'taa-pane', 'aria-label': 'Today and Actions' },
      h('header', { className: 'taa-header' },
        h('div', null, h('h1', null, 'Today + Actions'),
          h('p', null, new Date().toLocaleDateString([], { weekday: 'long', month: 'short', day: 'numeric' }))),
        button('×', () => api.Actions.toggleWorkspaceLocationHidden(runtime.layout.location), {
          className: 'taa-close', 'aria-label': 'Hide Today and Actions' })),
      h('div', { className: 'taa-scroll', ref: node => { this.scroll = node; } },
        runtime.alert || runtime.store.error ? h('div', { className: 'taa-notice taa-error', role: 'alert' }, runtime.store.error || runtime.alert) : null,
        h(MonthCalendar, { feed: runtime.feed }),
        h(CalendarSection, { feed: runtime.feed }),
        !runtime.calendarCollapsed && runtime.feed?.events.length ? h(MeetingResizer, {
          height: runtime.meetingDisplay.height,
          onResize: (height, commit) => {
            if (runtime !== instance) return;
            runtime.meetingDisplay = normalizeDisplay({ ...runtime.meetingDisplay, height });
            if (commit) runtime.meetingDisplay = saveDisplay(AppEnv.config, runtime.meetingDisplay);
            notify();
          },
        }) : null,
        h(ActionsSection, { actions: runtime.store.actions, filter: runtime.filter, editor: runtime.editor,
          formRef: node => { this.editorForm = node; }, titleRef: node => { this.editorInput = node; } })),
      h('footer', { className: 'taa-footer' }, 'Actions saved on this Mac'));
  }
}
TodayActionsSidebar.displayName = 'AswinTodayActionsSidebar';
TodayActionsSidebar.containerStyles = { minWidth: 300, maxWidth: 460 };

function activate() {
  if (runtime) return;
  if (AppEnv.getLoadSettings().windowType === 'calendar') {
    runtime = { calendarWindow: true };
    api.ComponentRegistry.register(GoogleMeetingButton, { location: api.WorkspaceStore.Sheet.Main.Header });
    return;
  }
  const layout = installLayout(api.WorkspaceStore);
  runtime = { layout, events: new EventEmitter(), filter: 'due', editor: null, alert: '', feed: null,
    actionsCollapsed: false, calendarCollapsed: false, editorFocusRequested: false, testNotifications: [],
    meetingDisplay: readDisplay(AppEnv.config), meetingDisplayOpen: false };
  runtime.store = new ActionStore(path.join(AppEnv.getLoadSettings().configDirPath, 'today-actions', 'actions.json'));
  runtime.store.on('change', notify);
  runtime.reminders = new ReminderScheduler(runtime.store, api.NativeNotifications, { onOpen: action => {
    ipcRenderer.send('command', 'application:show-main-window');
    openEditor(action);
  }, onUpdate: notify });
  try { runtime.reminders.start(); } catch (_) {
    runtime.reminders.stop();
    runtime.reminders.error = 'Reminder scheduling is unavailable. Your saved actions are still accessible.';
  }
  try {
    runtime.feed = new CalendarFeed(api, AppEnv, notify);
    runtime.feed.start();
  } catch (_) {
    runtime.feed?.stop();
    runtime.feed = null;
    runtime.calendarError = 'Calendar integration is unavailable in this Mailspring version. Actions still work.';
  }
  api.ComponentRegistry.register(TodayActionsSidebar, { location: layout.location });
  api.ComponentRegistry.register(SidebarToggle, { location: api.WorkspaceStore.Sheet.Global.Toolbar.Right });
  api.ComponentRegistry.register(AddActionButton, { role: 'ThreadActionsToolbarButton' });
  try { runtime.groupedMail = installGroupedMail(api, AppEnv, runtime.store); }
  catch (error) { console.warn('Today + Actions: grouped mail is unavailable', error); }
  try { runtime.mailSidebar = installMailSidebar(api, AppEnv); }
  catch (error) { console.warn('Today + Actions: mailbox sidebar is unavailable', error); }
  notify();
}

function deactivate() {
  if (!runtime) return;
  if (runtime.calendarWindow) {
    api.ComponentRegistry.unregister(GoogleMeetingButton);
    runtime = null;
    return;
  }
  api.ComponentRegistry.unregister(TodayActionsSidebar);
  api.ComponentRegistry.unregister(SidebarToggle);
  api.ComponentRegistry.unregister(AddActionButton);
  runtime.mailSidebar?.cleanup();
  runtime.groupedMail?.cleanup();
  runtime.feed?.stop();
  runtime.reminders.stop();
  for (const handle of runtime.testNotifications) { try { handle.close?.(); } catch (_) {} }
  runtime.store.removeListener('change', notify);
  runtime.layout.cleanup();
  runtime.events.removeAllListeners();
  runtime = null;
}

module.exports = { activate, deactivate };
