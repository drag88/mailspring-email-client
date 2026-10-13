'use strict';
const path = require('path');
const { dayBounds, localDateKey, visibleEvents, validDate } = require('./core');
const { withConferenceLinks } = require('./conference-links');

class CalendarFeed {
  constructor(api, appEnv, onChange, nativeExpander) {
    this.api = api;
    this.appEnv = appEnv;
    this.onChange = onChange;
    this.expand = nativeExpander || require(path.join(appEnv.getLoadSettings().resourcePath,
      'internal_packages/main-calendar/lib/core/calendar-data-source.js')).occurrencesForEvents;
    this.calendars = [];
    this.events = [];
    this.error = null;
    this.loading = true;
    this.version = 0;
    this.stopped = false;
    this.selectedDateKey = null;
  }

  displayDate() {
    return this.selectedDateKey ? new Date(`${this.selectedDateKey}T12:00:00`) : new Date();
  }

  setDate(key) {
    if (key && !validDate(key)) throw new Error('Choose a valid calendar date.');
    this.selectedDateKey = key || null;
    this.refresh();
  }

  start() {
    const { Rx, DatabaseStore, Calendar } = this.api;
    this.calendarSub = Rx.Observable.fromQuery(DatabaseStore.findAll(Calendar)).subscribe(calendars => {
      if (this.stopped) return;
      this.calendars = calendars;
      this.recompute();
    }, () => this.fail());
    this.configSub = this.appEnv.config.onDidChange('mailspring.disabledCalendars', () => this.recompute());
    this.refresh();
    this.timer = setInterval(() => {
      if (this.day !== localDateKey()) this.refresh();
      else this.onChange();
    }, 60000);
  }

  refresh() {
    if (this.stopped) return;
    this.eventSub?.dispose();
    const version = ++this.version;
    this.day = localDateKey();
    this.loading = true;
    this.error = null;
    this.events = [];
    this.rawEvents = [];
    this.onChange();
    try {
      const { Rx, DatabaseStore, Event, Matcher } = this.api;
      const { startUnix, endUnix } = dayBounds(this.displayDate());
      const start = Event.attributes.recurrenceStart;
      const end = Event.attributes.recurrenceEnd;
      // Same candidate range as the bundled calendar, including ongoing recurrence series.
      const matcher = new Matcher.Or([
        new Matcher.And([start.lte(endUnix), end.gte(startUnix)]),
        new Matcher.And([start.lte(endUnix), start.gte(startUnix)]),
        new Matcher.And([end.gte(startUnix), end.lte(endUnix)]),
      ]);
      this.eventSub = Rx.Observable.fromQuery(DatabaseStore.findAll(Event).where(matcher)).subscribe(results => {
        if (this.stopped || version !== this.version) return;
        this.rawEvents = results;
        this.bounds = { startUnix, endUnix };
        this.loading = false;
        this.recompute();
      }, () => { if (version === this.version) this.fail(); });
    } catch (_) { this.fail(); }
  }

  recompute() {
    if (this.stopped) return;
    try {
      const disabled = new Set(this.appEnv.config.get('mailspring.disabledCalendars') || []);
      const groups = new Map();
      for (const event of this.rawEvents || []) {
        if (disabled.has(event.calendarId)) continue;
        // Identical invitation UIDs in two accounts/calendars must not merge.
        const key = `${event.accountId}:${event.calendarId}`;
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key).push(withConferenceLinks(event, this.api.CalendarUtils?.parseICSString));
      }
      const occurrences = [];
      for (const events of groups.values()) {
        occurrences.push(...this.expand(events, this.bounds));
      }
      this.events = visibleEvents(occurrences.map(event => ({ ...event, declinedByMe:
        (event.attendees || []).some(attendee => {
          const mine = new this.api.Contact({ email: attendee.email }).isMe();
          return mine && String(attendee.partstat).toUpperCase() === 'DECLINED';
        }) })), this.displayDate());
      this.error = null;
      this.onChange();
    } catch (_) { this.fail(); }
  }

  fail() {
    if (this.stopped) return;
    this.loading = false;
    this.error = 'Calendar data is unavailable. Open Calendar to check sync, then try Refresh.';
    this.events = [];
    this.onChange();
  }

  stop() {
    this.stopped = true;
    ++this.version;
    clearInterval(this.timer);
    this.eventSub?.dispose();
    this.calendarSub?.dispose();
    this.configSub?.dispose();
  }
}
module.exports = { CalendarFeed };
